"""
Owner: Dev A. One asyncio.Queue per case_id, for the SSE stream.

Write side: `run_pipeline()` calls `publish()`. Read side: Dev C's
`GET /cases/{id}/stream` calls `subscribe()` and yields each item as an SSE
frame. The queue is created by whoever touches it first, so it buffers
whether or not a consumer has attached yet (docs/00-CONTRACTS.md §4).
"""
from __future__ import annotations

import asyncio

_DONE = object()  # end-of-stream sentinel, never yielded to a consumer

_queues: dict[str, asyncio.Queue] = {}


def get_queue(case_id: str) -> asyncio.Queue:
    return _queues.setdefault(case_id, asyncio.Queue())


async def publish(case_id: str, event: str, data: dict) -> None:
    """Event names and payload shapes are fixed by docs/00-CONTRACTS.md §3."""
    await get_queue(case_id).put({"event": event, "data": data})


async def close(case_id: str) -> None:
    """Signal end-of-stream. Does NOT drop the queue — a consumer is allowed to
    attach after the run finished (§4: it buffers regardless of when a consumer
    attaches), and dropping here would hand that consumer a fresh empty queue it
    would wait on forever. `subscribe()` drops it once drained.
    """
    await get_queue(case_id).put(_DONE)


async def subscribe(case_id: str):
    """Async-iterate a case's events until the pipeline closes the stream.

    ponytail: an unconsumed case leaves one queue behind until the process exits
    — the same lifetime `store` already gives every Case, so no reaper task.
    Bounded by case count, not by run count.
    """
    queue = get_queue(case_id)
    try:
        while True:
            item = await queue.get()
            if item is _DONE:
                return
            yield item
    finally:
        _queues.pop(case_id, None)
