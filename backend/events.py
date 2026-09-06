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
_closed_cases: set[str] = set()


def get_queue(case_id: str) -> asyncio.Queue:
    return _queues.setdefault(case_id, asyncio.Queue())


def is_closed(case_id: str) -> bool:
    return case_id in _closed_cases


async def publish(case_id: str, event: str, data: dict) -> None:
    """Event names and payload shapes are fixed by docs/00-CONTRACTS.md §3."""
    await get_queue(case_id).put({"event": event, "data": data})


async def close(case_id: str) -> None:
    """Signal end-of-stream. Does NOT drop the queue — a consumer is allowed to
    attach after the run finished (§4: it buffers regardless of when a consumer
    attaches), and dropping here would hand that consumer a fresh empty queue it
    would wait on forever. `subscribe()` drops it once drained.
    """
    _closed_cases.add(case_id)
    await get_queue(case_id).put(_DONE)


async def subscribe(case_id: str, timeout: float | None = None):
    """Async-iterate a case's events until the pipeline closes the stream.

    Yields None on timeout to allow the caller to emit heartbeat pings.
    If the case is already marked closed and its queue is empty, returns immediately.
    """
    queue = get_queue(case_id)
    if queue.empty() and case_id in _closed_cases:
        return

    try:
        while True:
            if timeout is not None:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=timeout)
                except asyncio.TimeoutError:
                    yield None
                    continue
            else:
                item = await queue.get()

            if item is _DONE:
                return
            yield item
    finally:
        if queue.empty() or case_id in _closed_cases:
            _queues.pop(case_id, None)

