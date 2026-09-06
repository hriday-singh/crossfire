"""
Owner: Dev A. Lightweight, zero-overhead activity stream emitter.
Publishes granular, non-blocking telemetry events for the live investigation feed.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import events

logger = logging.getLogger(__name__)


async def emit_activity(
    case_id: str | None,
    tag: str,
    text: str,
    claim_id: str | None = None,
    action: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Publishes a short, human-readable activity event to the SSE stream.
    Never raises; runs in microsecond in-memory queues without adding pipeline latency.
    """
    if not case_id:
        return
    try:
        payload: dict[str, Any] = {
            "tag": tag,
            "text": text,
            "claim_id": claim_id,
            "action": action,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if extra:
            payload.update(extra)
        await events.publish(case_id, "activity", payload)
    except Exception as exc:
        logger.debug("Failed to emit activity for case %s: %s", case_id, exc)
