"""
Unit tests for token usage and execution telemetry tracking (core/telemetry.py).
"""
import pytest
from core.models import CaseTelemetry, AgentTokenUsage
from core.telemetry import (
    TelemetryTracker,
    calculate_cost_usd,
    estimate_tokens_from_messages,
    estimate_tokens_from_output,
    estimate_tokens_from_text,
)


def test_estimate_tokens_from_text():
    assert estimate_tokens_from_text("") == 0
    assert estimate_tokens_from_text(None) == 0
    assert estimate_tokens_from_text("12345678901234567890") == 5
    assert estimate_tokens_from_text("abc") == 1


def test_estimate_tokens_from_messages():
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Evaluate this proposition."},
    ]
    tokens = estimate_tokens_from_messages("System prompt", messages)
    assert tokens > 0


def test_calculate_cost_usd():
    cost = calculate_cost_usd(1_000_000, 1_000_000)
    assert cost == 0.375


def test_telemetry_tracker_aggregates_and_sorts():
    tracker = TelemetryTracker()

    tracker.record(
        agent="builder",
        prompt_text="Detailed prompt about architecture constraints",
        output="Feasibility confirmed with minor friction",
    )
    tracker.record(
        agent="receipts",
        prompt_text="Search queries and scraped webpage results",
        output="Empirical evidence found in regulatory filings",
    )
    tracker.record(
        agent="builder",
        prompt_text="Follow-up question",
        output="No Day-1 blocker found",
    )

    telemetry = tracker.build_telemetry()

    assert isinstance(telemetry, CaseTelemetry)
    assert telemetry.total_prompt_tokens > 0
    assert telemetry.total_completion_tokens > 0
    assert telemetry.total_tokens == telemetry.total_prompt_tokens + telemetry.total_completion_tokens
    assert telemetry.total_estimated_cost_usd > 0.0
    assert telemetry.duration_ms >= 0.0

    agents = {a.agent: a for a in telemetry.agent_breakdown}
    assert "builder" in agents
    assert "receipts" in agents
    assert agents["builder"].total_tokens > agents["receipts"].total_tokens


@pytest.mark.asyncio
async def test_run_pipeline_emits_telemetry_ready_event(sample_case):
    import events
    import store
    from core.loop import run_pipeline
    from tests.core.test_loop import SchemaProvider

    store.set(sample_case)
    events.get_queue(sample_case.id)

    await run_pipeline(sample_case.id, provider=SchemaProvider())

    seen = [item["event"] async for item in events.subscribe(sample_case.id)]
    assert "telemetry_ready" in seen
    assert seen.index("telemetry_ready") < seen.index("run_complete")

    updated_case = store.get(sample_case.id)
    assert updated_case is not None
    assert updated_case.telemetry is not None
    assert updated_case.telemetry.total_tokens > 0
    assert len(updated_case.telemetry.agent_breakdown) > 0
