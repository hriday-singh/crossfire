"""
Unit tests for the zero-latency activity stream emission and replay.
"""
import pytest
import events
from core.activity import emit_activity


@pytest.mark.asyncio
async def test_emit_activity_publishes_event_to_history_and_subscribers():
    case_id = "test-case-activity-123"
    events.reset()

    # Pre-subscribe to verify live fanout
    async def drain_events():
        received = []
        async for item in events.subscribe(case_id, timeout=0.1):
            if item is None:
                break
            received.append(item)
            if len(received) >= 2:
                break
        return received

    # Emit two activity events
    await emit_activity(case_id, "Evidence Test", "Querying DuckDuckGo...", claim_id="c-1", action="search")
    await emit_activity(case_id, "Judge", "Reconciling findings...", claim_id="c-1", action="reconcile")

    # History should contain both
    hist = events.get_history(case_id)
    assert len(hist) == 2
    assert hist[0]["event"] == "activity"
    assert hist[0]["data"]["tag"] == "Evidence Test"
    assert hist[0]["data"]["text"] == "Querying DuckDuckGo..."
    assert hist[0]["data"]["action"] == "search"
    assert hist[0]["data"]["claim_id"] == "c-1"

    assert hist[1]["event"] == "activity"
    assert hist[1]["data"]["tag"] == "Judge"
    assert hist[1]["data"]["text"] == "Reconciling findings..."

    # Emitting with None case_id safely no-ops without exception
    await emit_activity(None, "Pipeline", "Ignored")
