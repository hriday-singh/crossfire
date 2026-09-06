"""
Owner: Dev C. POST /cases, GET /cases/{id}/stream, POST /cases/{id}/confirm,
GET /cases/{id}. See docs/00-CONTRACTS.md #4 for the call sequence and
docs/04-dev-C-api-sse-evaluators.md for the task breakdown.
"""
from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

import events
import store
from api.schemas import ConfirmCaseRequest, ConfirmCaseResponse, CreateCaseRequest
from core.loop import extract_claims, handle_confirm
from core.models import Case
from providers.base import LLMProvider
from providers.gemini import GeminiProvider

router = APIRouter()


def get_llm_provider() -> LLMProvider:
    """Dependency provider for LLM calls (can be overridden in tests)."""
    return GeminiProvider()


@router.post("/cases", response_model=Case, status_code=status.HTTP_200_OK)
async def create_case(
    payload: CreateCaseRequest,
    provider: Annotated[LLMProvider, Depends(get_llm_provider)],
) -> Case:
    """
    POST /cases: Extract claims from raw input, store case with status awaiting_confirmation,
    and publish claim_map_ready + awaiting_confirmation SSE events per docs/00-CONTRACTS.md §3.
    """
    case = await extract_claims(payload.raw_input, provider)
    if payload.context:
        case.context = payload.context
    store.set(case)

    # Emit initial SSE events so early stream subscribers receive them
    await events.publish(
        case.id,
        "claim_map_ready",
        {"claims": [c.model_dump() for c in case.claims]},
    )
    await events.publish(case.id, "awaiting_confirmation", {})

    return case


@router.get("/cases/{case_id}/stream")
async def stream_case(case_id: str) -> StreamingResponse:
    """
    GET /cases/{id}/stream: Opens immediately and yields whatever the pipeline
    publishes, as SSE frames.

    The transport is `events` (Dev A) — the same module `run_pipeline` writes to.
    `events.subscribe()` buffers regardless of when a consumer attaches, swallows
    the private end-of-stream sentinel, and drops the queue once drained, so this
    handler owns no queue state of its own.
    """
    case = store.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    async def event_generator():
        # If the case already completed and its queue has been drained/closed,
        # emit the terminal event immediately so the client does not hang indefinitely.
        queue = events.get_queue(case_id)
        if case.status in ("done", "error") and queue.empty():
            if case.status == "done":
                yield f"event: run_complete\ndata: {json.dumps({'case_id': case_id})}\n\n"
            else:
                yield f"event: error\ndata: {json.dumps({'stage': 'execution', 'message': 'Case finished with error'})}\n\n"
            return

        async for item in events.subscribe(case_id):
            event_name = item["event"]
            data = item.get("data", {})
            yield f"event: {event_name}\ndata: {json.dumps(data, default=str)}\n\n"

            # run_pipeline always close()s in a finally, which ends the iteration
            # on its own. This is the belt-and-braces terminator for a run that
            # died without closing — otherwise the client hangs on an open stream.
            if event_name in ("run_complete", "error"):
                break

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

    if payload and payload.claims is not None:
        if len(payload.claims) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot confirm case with empty claims list.",
            )
        case.claims = payload.claims

    if not case.claims:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm case with no claims.",
        )

    case.status = "testing"
    store.set(case)

    # Launch in background via core.loop, which holds a strong reference to the
    # task. A bare asyncio.create_task() here would be weakly referenced by the
    # event loop and could be garbage-collected mid-run.
    await handle_confirm(case.id)

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
