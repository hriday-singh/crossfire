"""
Owner: Dev C. See docs/04-dev-C-api-sse-evaluators.md hour 2-11.
"""
from __future__ import annotations

import pytest

from core.models import Finding, TestPlanItem


@pytest.mark.asyncio
async def test_run_devils_advocate_produces_finding_with_reasoning(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput, run_devils_advocate
    fake_output = DevilsAdvocateOutput(
        result="Assumption doesn't hold",
        reasoning="No comparable precedent found",
        confidence=0.6,
        contradiction="Contrary data exists",
    )
    provider = fake_provider_factory(responses=[fake_output])
    finding = await run_devils_advocate(sample_test_plan_item, sample_case, provider)
    assert finding.evaluator == "devils_advocate"
    assert finding.reasoning == "No comparable precedent found"
    assert finding.confidence == 0.6
    assert finding.contradiction == "Contrary data exists"
    assert finding.evidence == []


@pytest.mark.asyncio
async def test_run_devils_advocate_never_calls_the_evidence_pipeline(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput, run_devils_advocate

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Devil's Advocate must never call the evidence pipeline")

    monkeypatch.setattr("evidence.search.search_evidence", _fail_if_called)

    fake_output = DevilsAdvocateOutput(
        result="Assumption challenged",
        reasoning="Logical critique without external evidence",
        confidence=0.7,
    )
    provider = fake_provider_factory(responses=[fake_output])
    finding = await run_devils_advocate(sample_test_plan_item, sample_case, provider)
    assert finding.evaluator == "devils_advocate"
    assert finding.evidence == []


@pytest.mark.asyncio
async def test_run_devils_advocate_sees_only_its_own_claim(fake_provider_factory, sample_case):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput, run_devils_advocate

    target_claim = sample_case.claims[0]
    other_claim = sample_case.claims[1]

    item = TestPlanItem(
        id="test-item-1",
        target_claim=target_claim.id,
        failure_mode="assumption",
        objective=f"Challenge assumption: {target_claim.statement}",
    )

    fake_output = DevilsAdvocateOutput(
        result="Flawed assumption",
        reasoning="Relies on unproven user adoption",
        confidence=0.65,
    )
    provider = fake_provider_factory(responses=[fake_output])

    finding = await run_devils_advocate(item, sample_case, provider)
    assert finding.evaluator == "devils_advocate"
    assert finding.claim_id == target_claim.id
    assert finding.reasoning == "Relies on unproven user adoption"

    # Verify provider call isolation: sees only its own claim, never other claims
    assert len(provider.calls) == 1
    call_content = provider.calls[0]["messages"][0]["content"]
    assert target_claim.statement in call_content
    assert other_claim.statement not in call_content


