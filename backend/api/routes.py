"""
Owner: Dev C. POST /cases, GET /cases/{id}/stream, POST /cases/{id}/confirm,
GET /cases/{id}. See docs/00-CONTRACTS.md #4 for the call sequence and
docs/04-dev-C-api-sse-evaluators.md for the task breakdown.
"""
from __future__ import annotations

import base64
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

import events
import store
from api.schemas import (
    BaselineRequest,
    BaselineResponse,
    ConfirmCaseRequest,
    ConfirmCaseResponse,
    CreateCaseRequest,
    IngestImageRequest,
    IngestPdfRequest,
    IngestResponse,
    IngestUrlRequest,
)
from core.loop import extract_claims, handle_confirm, run_baseline
from core.models import Case
from ingestion import ingest_image, ingest_pdf, ingest_url
from providers import get_provider
from providers.base import LLMProvider


router = APIRouter()


def get_llm_provider() -> LLMProvider:
    """Dependency provider for LLM calls (can be overridden in tests)."""
    return get_provider()



@router.post(
    "/cases",
    response_model=Case,
    status_code=status.HTTP_200_OK,
)
async def create_case(
    payload: CreateCaseRequest,
    provider: Annotated[LLMProvider, Depends(get_llm_provider)],
) -> Case:
    """
    POST /cases: Extract claims from raw input, store case with status awaiting_confirmation,
    and publish claim_map_ready + awaiting_confirmation SSE events per docs/00-CONTRACTS.md §3.
    """
    case = await extract_claims(
        payload.raw_input,
        provider,
        context=payload.context,
        agent_mode=payload.agent_mode or "auto",
        selected_agents=payload.selected_agents,
    )
    store.set(case)

    # An input that named no concrete decision never enters the pipeline — the
    # frontend shows gate_message and asks again instead of testing invented claims.
    if case.status == "needs_input":
        await events.publish(case.id, "needs_input", {"message": case.gate_message})
        return case

    # Emit initial SSE events so early stream subscribers receive them
    await events.publish(
        case.id,
        "claim_map_ready",
        {"claims": [c.model_dump() for c in case.claims]},
    )
    await events.publish(case.id, "awaiting_confirmation", {})

    return case


SSE_PING_INTERVAL_SECONDS: float = 15.0


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
        # Fast path if case has already finished and no event history exists to replay
        if case.status == "done" and not events.get_history(case_id):
            yield f"event: run_complete\ndata: {json.dumps({'case_id': case_id})}\n\n"
            return
        if case.status == "error" and not events.get_history(case_id):
            yield f"event: error\ndata: {json.dumps({'stage': 'run_pipeline', 'message': 'Case previously failed'})}\n\n"
            return
        if case.status == "testing" and not events.get_history(case_id):
            yield f"event: error\ndata: {json.dumps({'stage': 'run_pipeline', 'message': 'Run interrupted or server restarted'})}\n\n"
            return


        async for item in events.subscribe(case_id, timeout=SSE_PING_INTERVAL_SECONDS):
            if item is None:
                yield ": ping\n\n"
                continue
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

    if payload and payload.selected_agents is not None:
        if len(payload.selected_agents) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot confirm case with empty selected_agents list. At least one agent must be selected.",
            )
        valid_agents = []
        for a in payload.selected_agents:
            normalized = "operator" if a == "overthinker" else ("receipts" if a == "researcher" else a)
            if normalized in ("devils_advocate", "receipts", "builder", "operator"):
                if normalized not in valid_agents:
                    valid_agents.append(normalized)
        if not valid_agents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid agent IDs provided in selected_agents.",
            )
        case.selected_agents = valid_agents

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


@router.post(
    "/baseline",
    response_model=BaselineResponse,
    status_code=status.HTTP_200_OK,
)
async def create_baseline(
    payload: BaselineRequest,
    provider: Annotated[LLMProvider, Depends(get_llm_provider)],
) -> BaselineResponse:
    """
    POST /baseline: one plain, un-engineered model call on the same raw input.

    This exists so "better than a good prompt" is demonstrable rather than
    asserted (direction doc §10). It is deliberately not sandbagged.
    """
    answer = await run_baseline(payload.raw_input, provider, context=payload.context)
    return BaselineResponse(raw_input=payload.raw_input, answer=answer)


@router.post(
    "/ingest/url",
    response_model=IngestResponse,
    status_code=status.HTTP_200_OK,
)
async def handle_ingest_url(
    payload: IngestUrlRequest,
    provider: Annotated[LLMProvider, Depends(get_llm_provider)],
) -> IngestResponse:
    """
    POST /ingest/url: Ingests content from a URL, curates it, and returns context.
    """
    try:
        context = await ingest_url(
            url=payload.url,
            claim_statement=payload.claim_statement,
            provider=provider,
        )
        return IngestResponse(context=context, character_count=len(context))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest URL: {exc}",
        )


@router.post(
    "/ingest/pdf",
    response_model=IngestResponse,
    status_code=status.HTTP_200_OK,
)
async def handle_ingest_pdf(
    payload: IngestPdfRequest,
    provider: Annotated[LLMProvider, Depends(get_llm_provider)],
) -> IngestResponse:
    """
    POST /ingest/pdf: Ingests base64-encoded PDF content, curates it, and returns context.
    """
    try:
        pdf_bytes = base64.b64decode(payload.pdf_base64, validate=True)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 PDF data: {exc}",
        )

    try:
        context = await ingest_pdf(
            source=pdf_bytes,
            claim_statement=payload.claim_statement,
            provider=provider,
        )
        return IngestResponse(context=context, character_count=len(context))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest PDF: {exc}",
        )


@router.post(
    "/ingest/image",
    response_model=IngestResponse,
    status_code=status.HTTP_200_OK,
)
async def handle_ingest_image(
    payload: IngestImageRequest,
    provider: Annotated[LLMProvider, Depends(get_llm_provider)],
) -> IngestResponse:
    """
    POST /ingest/image: Ingests base64-encoded image content (PNG, JPG, WEBP),
    extracts text via RapidOCR, curates it, and returns context.
    """
    try:
        image_bytes = base64.b64decode(payload.image_base64, validate=True)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image data: {exc}",
        )

    try:
        context = await ingest_image(
            source=image_bytes,
            claim_statement=payload.claim_statement,
            provider=provider,
        )
        if not context or not context.strip():
            raise ValueError(
                "No extractable text found in image: OCR detected no recognizable text or confidence was below threshold."
            )
        return IngestResponse(context=context, character_count=len(context))
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest image: {exc}",
        )


