"""Stream sequencing contract: the SSE frames must describe the run as
"claim N of M, these agents, each result as it lands, claim done" so the frontend
can pace the bullpen animation without guessing.
"""
from __future__ import annotations

import asyncio

import pytest

import events as events_module


@pytest.mark.asyncio
async def test_stream_sequences_claims_agents_and_findings(monkeypatch, sample_case, sample_finding):
    import core.loop as loop

    events_module.reset()

    async def fake_dispatch(item, case, provider):
        await asyncio.sleep(0)
        return sample_finding.model_copy(update={"claim_id": item.target_claim, "test_id": item.id})

    monkeypatch.setattr(loop, "dispatch", fake_dispatch)

    plan = loop.build_test_plan(sample_case)
    await loop.run_evaluators(sample_case, plan, provider=None)

    history = events_module.get_history(sample_case.id)
    names = [e["event"] for e in history]

    starts = [e["data"] for e in history if e["event"] == "claim_started"]
    completes = [e["data"] for e in history if e["event"] == "claim_complete"]
    planned_claims = {i.target_claim for i in plan}

    # One ordered claim_started per claim, carrying its agent roster and position.
    assert [s["claim_id"] for s in starts] == [
        c.id for c in sample_case.claims if c.id in planned_claims
    ]
    assert all(s["total_claims"] == len(starts) for s in starts)
    assert [s["claim_index"] for s in starts] == list(range(len(starts)))
    assert all(len(s["agents"]) == len(s["test_ids"]) > 0 for s in starts)

    # Every claim closes, and only after its own agents reported.
    assert {c["claim_id"] for c in completes} == planned_claims
    for claim_id in planned_claims:
        last_finding = max(
            i
            for i, e in enumerate(history)
            if e["event"] == "finding_ready" and e["data"]["target_claim_id"] == claim_id
        )
        claim_done = next(
            i
            for i, e in enumerate(history)
            if e["event"] == "claim_complete" and e["data"]["claim_id"] == claim_id
        )
        assert last_finding < claim_done

    # Each agent announces itself before it reports, and every agent reports.
    assert names.count("test_started") == len(plan)
    assert names.count("finding_ready") == len(plan)
    for item in plan:
        started = next(
            i for i, e in enumerate(history)
            if e["event"] == "test_started" and e["data"]["test_id"] == item.id
        )
        reported = next(
            i for i, e in enumerate(history)
            if e["event"] == "finding_ready" and e["data"]["finding"]["test_id"] == item.id
        )
        assert started < reported


@pytest.mark.asyncio
async def test_done_is_only_emitted_after_run_complete(monkeypatch, sample_case, sample_finding):
    """No terminal frame may appear mid-run: `done` closes the stream exactly once,
    after run_complete."""
    import core.loop as loop

    events_module.reset()

    async def fake_dispatch(item, case, provider):
        return sample_finding.model_copy(update={"claim_id": item.target_claim, "test_id": item.id})

    monkeypatch.setattr(loop, "dispatch", fake_dispatch)
    plan = loop.build_test_plan(sample_case)
    await loop.run_evaluators(sample_case, plan, provider=None)

    names = [e["event"] for e in events_module.get_history(sample_case.id)]
    assert "run_complete" not in names
    assert not events_module.is_closed(sample_case.id)
