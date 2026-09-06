"""
Owner: Dev C. POST /cases, GET /cases/{id}/stream, POST /cases/{id}/confirm,
GET /cases/{id}. See docs/00-CONTRACTS.md #4 for the call sequence and
docs/04-dev-C-api-sse-evaluators.md for the task breakdown.
"""
from __future__ import annotations

import asyncio
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

import store
from api.schemas import ConfirmCaseRequest, ConfirmCaseResponse, CreateCaseRequest
from core.loop import extract_claims, run_pipeline
from core.models import Case
from providers.base import LLMProvider
from providers.gemini import GeminiProvider

router = APIRouter()

# SSE Queue Registry for streaming events per case
_case_queues: dict[str, asyncio.Queue] = {}


def get_case_queue(case_id: str) -> asyncio.Queue:
    """Retrieve or create an asyncio.Queue for streaming SSE events for a case."""
    try:
        from core.loop import get_case_queue as _core_get_case_queue

        return _core_get_case_queue(case_id)
    except (ImportError, AttributeError):
        pass

    if case_id not in _case_queues:
        _case_queues[case_id] = asyncio.Queue()
    return _case_queues[case_id]


def remove_case_queue(case_id: str) -> None:
    """Clean up queue when run is complete."""
    _case_queues.pop(case_id, None)


def get_llm_provider() -> LLMProvider:
    """Dependency provider for LLM calls (can be overridden in tests)."""
    return GeminiProvider()


@router.post("/cases", response_model=Case, status_code=status.HTTP_200_OK)
async def create_case(
    payload: CreateCaseRequest,
    provider: Annotated[LLMProvider, Depends(get_llm_provider)],
) -> Case:
    """
    POST /cases: Extract claims from raw input, store case with status awaiting_confirmation.
    """
    case = await extract_claims(payload.raw_input, provider)
    if payload.context:
        case.context = payload.context
    store.set(case)
    return case


@router.get("/cases/{case_id}/stream")
async def stream_case(case_id: str) -> StreamingResponse:
    """
    GET /cases/{id}/stream: Opens immediately, reads from asyncio.Queue, emits as SSE.
    """
    if store.get(case_id) is None and case_id not in _case_queues:
        raise HTTPException(status_code=404, detail="Case not found")

    queue = get_case_queue(case_id)

    async def event_generator():
        try:
            while True:
                item = await queue.get()
                queue.task_done()
                if item is None:
                    break

                if isinstance(item, tuple) and len(item) == 2:
                    event_name, data = item
                elif isinstance(item, dict) and "event" in item:
                    event_name = item["event"]
                    data = item.get("data", {})
                else:
                    event_name = "message"
                    data = item

                if hasattr(data, "model_dump_json"):
                    data_str = data.model_dump_json()
                elif isinstance(data, (dict, list)):
                    data_str = json.dumps(data)
                else:
                    data_str = str(data)

                yield f"event: {event_name}\ndata: {data_str}\n\n"

                if event_name in ("run_complete", "error"):
                    break
        finally:
            remove_case_queue(case_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/cases/{case_id}/confirm",
    response_model=ConfirmCaseResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def confirm_case(
    case_id: str,
    payload: ConfirmCaseRequest | None = None,
) -> ConfirmCaseResponse:
    """
    POST /cases/{id}/confirm: Validates claims, transitions to 'testing',
    launches background run_pipeline, and returns 202 Accepted immediately.
    """
    case = store.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    if case.status != "awaiting_confirmation":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm case in status '{case.status}'. Must be 'awaiting_confirmation'.",
        )

    if payload and payload.claims:
        case.claims = payload.claims

    case.status = "testing"
    store.set(case)

    # Launch pipeline in background (fire-and-forget, non-blocking)
    asyncio.create_task(run_pipeline(case.id))

    return ConfirmCaseResponse(
        case_id=case.id,
        status="testing",
        message="Case confirmed and pipeline launched",
    )


@router.get("/cases/{case_id}", response_model=Case)
async def get_case(case_id: str) -> Case:
    """
    GET /cases/{id}: Returns full Case object for the evidence drawer.
    """
    case = store.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case
