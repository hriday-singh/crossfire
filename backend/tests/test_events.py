"""
Unit tests for events.py (SSE event queue and replay history).
Tests multi-consumer and non-destructive event history guarantees.
"""
from __future__ import annotations

import asyncio
import pytest
import events


@pytest.fixture(autouse=True)
def clean_events():
    events.reset()
    yield
    events.reset()


@pytest.mark.asyncio
async def test_reconnecting_subscriber_receives_full_history():
    case_id = "case-reconnect-test"

    # Publish events before any consumer has subscribed
    await events.publish(case_id, "claim_map_ready", {"count": 2})
    await events.publish(case_id, "test_started", {"test_id": "t1"})
    await events.close(case_id)

    # First consumer connects and receives all events
    first_consumer_events = [item["event"] async for item in events.subscribe(case_id)]
    assert first_consumer_events == ["claim_map_ready", "test_started"]

    # Second consumer connects (e.g. page refresh / second tab) and STILL receives all events
    second_consumer_events = [item["event"] async for item in events.subscribe(case_id)]
    assert second_consumer_events == ["claim_map_ready", "test_started"]


@pytest.mark.asyncio
async def test_multiple_concurrent_subscribers_both_receive_events():
    case_id = "case-concurrent-test"

    results_a: list[str] = []
    results_b: list[str] = []

    async def consumer_a():
        async for item in events.subscribe(case_id):
            results_a.append(item["event"])

    async def consumer_b():
        async for item in events.subscribe(case_id):
            results_b.append(item["event"])

    # Start both consumers concurrently
    task_a = asyncio.create_task(consumer_a())
    task_b = asyncio.create_task(consumer_b())

    await asyncio.sleep(0.01)

    # Publish events
    await events.publish(case_id, "event_1", {"data": 1})
    await events.publish(case_id, "event_2", {"data": 2})
    await events.close(case_id)

    await asyncio.gather(task_a, task_b)

    assert results_a == ["event_1", "event_2"]
    assert results_b == ["event_1", "event_2"]


@pytest.mark.asyncio
async def test_mid_run_reconnect_receives_history_and_live_events():
    case_id = "case-mid-run-test"

    # Event 1 published
    await events.publish(case_id, "history_event", {"n": 1})

    collected: list[str] = []

    async def consumer():
        async for item in events.subscribe(case_id):
            collected.append(item["event"])

    consumer_task = asyncio.create_task(consumer())
    await asyncio.sleep(0.01)

    # Event 2 published live while consumer is connected
    await events.publish(case_id, "live_event", {"n": 2})
    await events.close(case_id)

    await consumer_task
    assert collected == ["history_event", "live_event"]
