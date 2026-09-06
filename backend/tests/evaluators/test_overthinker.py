"""
Owner: Dev C. Tests for core.evaluators.overthinker (Edge-Case Test evaluator).
"""
from __future__ import annotations

import pytest

from core.evaluators.overthinker import OverthinkerOutput, run_overthinker
from core.models import Case, Claim, Finding, TestPlanItem


@pytest.mark.asyncio
async def test_run_overthinker_produces_finding_with_reasoning(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    fake_output = OverthinkerOutput(
        result="Catastrophic edge-case risk",
        reasoning="Cascade failure under extreme load",
        confidence=0.8,
        contradiction="System deadlock under quota exhaustion",
    )
    provider = fake_provider_factory(responses=[fake_output])
    finding = await run_overthinker(sample_test_plan_item, sample_case, provider)

    assert finding.evaluator == "overthinker"
    assert finding.claim_id == sample_claim.id
    assert finding.test_id == sample_test_plan_item.id
    assert finding.result == "Catastrophic edge-case risk"
    assert finding.reasoning == "Cascade failure under extreme load"
    assert finding.confidence == 0.8
    assert finding.contradiction == "System deadlock under quota exhaustion"
    assert finding.evidence == []


@pytest.mark.asyncio
async def test_run_overthinker_never_calls_the_evidence_pipeline(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Overthinker must never call the evidence pipeline")

    monkeypatch.setattr("evidence.search.search_evidence", _fail_if_called)

    fake_output = OverthinkerOutput(
        result="Edge vulnerability detected",
        reasoning="Boundary check fails at zero inputs",
        confidence=0.75,
    )
    provider = fake_provider_factory(responses=[fake_output])
    finding = await run_overthinker(sample_test_plan_item, sample_case, provider)

    assert finding.evaluator == "overthinker"
    assert finding.evidence == []


@pytest.mark.asyncio
async def test_run_overthinker_takes_only_the_contract_signature(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """Contract §4: (item, case, provider) and nothing else. The old
    isinstance-sniffing of three argument orders is gone, so passing a Claim
    first must fail loudly rather than silently working."""
    fake_output = OverthinkerOutput(
        result="Boundary failure",
        reasoning="Input parameter overflows buffer",
        confidence=0.85,
    )
    provider = fake_provider_factory(responses=[fake_output])
    finding = await run_overthinker(sample_test_plan_item, sample_case, provider)
    assert finding.claim_id == sample_claim.id
    assert finding.test_id == sample_test_plan_item.id

    with pytest.raises(AttributeError):
        await run_overthinker(sample_claim, sample_test_plan_item, provider)


@pytest.mark.asyncio
async def test_run_overthinker_sees_only_its_own_claim(
    fake_provider_factory, sample_case
):
    target_claim = sample_case.claims[0]
    other_claim = sample_case.claims[1]

    item = TestPlanItem(
        id="test-edge-1",
        target_claim=target_claim.id,
        failure_mode="edge-case",
        objective=f"Test tail risks for: {target_claim.statement}",
    )

    fake_output = OverthinkerOutput(
        result="Extreme tail risk identified",
        reasoning="Degenerate input triggers infinite loop",
        confidence=0.7,
    )
    provider = fake_provider_factory(responses=[fake_output])

    finding = await run_overthinker(item, sample_case, provider)
    assert finding.evaluator == "overthinker"
    assert finding.claim_id == target_claim.id

    # Verify claim isolation
    assert len(provider.calls) == 1
    call_content = provider.calls[0]["messages"][0]["content"]
    assert target_claim.statement in call_content
    assert other_claim.statement not in call_content


@pytest.mark.asyncio
async def test_run_overthinker_includes_case_context(fake_provider_factory):
    case_with_context = Case(
        id="case-ctx-1",
        raw_input="Deploy automated billing system",
        context="PDF Document: Regulatory limits cap automatic charges at $500",
        claims=[Claim(id="c1", statement="Users can be billed automatically")],
    )
    item = TestPlanItem(
        id="t-ctx",
        target_claim="c1",
        failure_mode="edge-case",
        objective="Check compliance edge cases",
    )

    fake_output = OverthinkerOutput(
        result="Exceeds regulatory cap",
        reasoning="Context specifies $500 hard cap",
        confidence=0.9,
    )
    provider = fake_provider_factory(responses=[fake_output])

    finding = await run_overthinker(item, case_with_context, provider)
    assert finding.evaluator == "overthinker"

    call_content = provider.calls[0]["messages"][0]["content"]
    assert "Regulatory limits cap automatic charges at $500" in call_content


@pytest.mark.asyncio
async def test_run_overthinker_handles_raw_string_response(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    provider = fake_provider_factory(
        responses=["Raw analytical critique of edge case without JSON structure"]
    )
    finding = await run_overthinker(sample_test_plan_item, sample_case, provider)

    assert finding.evaluator == "overthinker"
    assert finding.claim_id == sample_claim.id
    assert "Raw analytical critique" in finding.reasoning
    assert finding.evidence == []


@pytest.mark.asyncio
async def test_run_overthinker_raises_on_missing_provider(
    sample_case, sample_claim, sample_test_plan_item
):
    with pytest.raises(ValueError, match="LLMProvider must be provided"):
        await run_overthinker(sample_test_plan_item, sample_case, None)
