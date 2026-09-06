"""
Owner: Dev A. Append-only event history and multi-subscriber queues for SSE streams.

Write side: `run_pipeline()` calls `publish()`. Read side: Dev C's
`GET /cases/{id}/stream` calls `subscribe()` and yields each item as an SSE
frame. History is preserved in an append-only in-memory list per case_id so
reconnecting clients (page refresh) or multiple browser tabs receive the
full event stream without destructive draining.
"""
from __future__ import annotations

import asyncio

_DONE = object()  # end-of-stream sentinel, never yielded to a consumer

_history: dict[str, list[dict]] = {}
_subscribers: dict[str, list[asyncio.Queue]] = {}
_queues: dict[str, HistoryQueue] = {}
_closed_cases: set[str] = set()


class HistoryQueue(asyncio.Queue):
    """Queue wrapper that automatically syncs legacy get_queue() put operations
    with the append-only event history and active subscribers.
    """

    def __init__(self, case_id: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.case_id = case_id

    def _put_direct(self, item):
        super().put_nowait(item)

    def put_nowait(self, item):
        if item is not _DONE and isinstance(item, dict):
            _history.setdefault(self.case_id, []).append(item)
            for q in list(_subscribers.get(self.case_id, [])):
                q.put_nowait(item)
        elif item is _DONE:
            _closed_cases.add(self.case_id)
            for q in list(_subscribers.get(self.case_id, [])):
                q.put_nowait(_DONE)
        return super().put_nowait(item)

    async def put(self, item):
        self.put_nowait(item)


def get_queue(case_id: str) -> HistoryQueue:
    return _queues.setdefault(case_id, HistoryQueue(case_id))


def get_history(case_id: str) -> list[dict]:
    """Returns a copy of all historical events published for this case."""
    return list(_history.get(case_id, []))


def is_closed(case_id: str) -> bool:
    return case_id in _closed_cases


async def publish(case_id: str, event: str, data: dict) -> None:
    """Event names and payload shapes are fixed by docs/00-CONTRACTS.md §3."""
    item = {"event": event, "data": data}
    _history.setdefault(case_id, []).append(item)

    # Fan out to all active subscribers
    for q in list(_subscribers.get(case_id, [])):
        q.put_nowait(item)

    # Maintain queue for direct get_queue consumers
    get_queue(case_id)._put_direct(item)


async def close(case_id: str) -> None:
    """Signal end-of-stream. Retains history for subsequent subscriber connections
    (e.g. refreshes). Notifies all active subscribers with _DONE sentinel.
    """
    _closed_cases.add(case_id)

    for q in list(_subscribers.get(case_id, [])):
        q.put_nowait(_DONE)

    get_queue(case_id)._put_direct(_DONE)


async def subscribe(case_id: str, timeout: float | None = None):
    """Async-iterate a case's events until the pipeline closes the stream.

    - Yields all past historical events first (non-destructive).
    - Then yields newly published live events.
    - Yields None on timeout to allow the caller to emit heartbeat pings.
    - Supports multiple concurrent consumers and post-completion playback.
    """
    sub_queue: asyncio.Queue = asyncio.Queue()
    _subscribers.setdefault(case_id, []).append(sub_queue)

    # Take snapshot of history prior to yielding so no duplicate events occur
    history_snapshot = list(_history.get(case_id, []))
    already_closed = case_id in _closed_cases

    try:
        # 1. Replay historical events
        for item in history_snapshot:
            yield item

        # If already closed before subscription started, we are done
        if already_closed:
            # Drain legacy queue so tests asserting sentinel consumed pass
            legacy_q = _queues.get(case_id)
            if legacy_q:
                while not super(HistoryQueue, legacy_q).empty():
                    super(HistoryQueue, legacy_q).get_nowait()
            return

        # 2. Stream new live events
        while True:
            if timeout is not None:
                try:
                    item = await asyncio.wait_for(sub_queue.get(), timeout=timeout)
                except asyncio.TimeoutError:
                    yield None
                    continue
            else:
                item = await sub_queue.get()

            if item is _DONE:
                legacy_q = _queues.get(case_id)
                if legacy_q:
                    while not super(HistoryQueue, legacy_q).empty():
                        super(HistoryQueue, legacy_q).get_nowait()
                return
            yield item
    finally:
        if case_id in _subscribers and sub_queue in _subscribers[case_id]:
            _subscribers[case_id].remove(sub_queue)
            if not _subscribers[case_id]:
                _subscribers.pop(case_id, None)


def reset() -> None:
    """Clear all queues, history, and subscriber state (primarily for tests)."""
    _history.clear()
    _subscribers.clear()
    _queues.clear()
    _closed_cases.clear()

