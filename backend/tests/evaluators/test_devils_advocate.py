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


def test_devils_advocate_system_prompt_contains_analytical_constraints():
    from core.evaluators.devils_advocate import DEVILS_ADVOCATE_SYSTEM_PROMPT

    # 1. Temporal Inversion (Pre-Mortem Framework)
    assert "Temporal Inversion" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "12 months post-launch" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "unstated premise" in DEVILS_ADVOCATE_SYSTEM_PROMPT

    # 2. Stakeholder Incentive Mapping (Cui Bono)
    assert "Stakeholder Incentive Mapping" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "third parties" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "lose capital, status, or time" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "incentivized to fight back" in DEVILS_ADVOCATE_SYSTEM_PROMPT

    # 3. Calibrated Confidence Scoring
    assert "Calibrated Confidence Scoring" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "0.9 to 1.0" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "0.7 to 0.8" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "0.4 to 0.6" in DEVILS_ADVOCATE_SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_run_devils_advocate_passes_enhanced_prompt_and_instruction(
    fake_provider_factory, sample_case, sample_test_plan_item
):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput, run_devils_advocate

    fake_output = DevilsAdvocateOutput(
        result="Premise fails post-launch",
        reasoning="Competitors directly counteract the strategy within 12 months.",
        confidence=0.75,
        contradiction="Economic incentives force counter-action",
    )
    provider = fake_provider_factory(responses=[fake_output])

    finding = await run_devils_advocate(sample_test_plan_item, sample_case, provider)
    assert finding.evaluator == "devils_advocate"
    assert finding.confidence == 0.75

    assert len(provider.calls) == 1
    system_prompt = provider.calls[0]["system_prompt"]
    user_content = provider.calls[0]["messages"][0]["content"]

    # Verify analytical constraints are present in system prompt delivered to model
    assert "Temporal Inversion" in system_prompt
    assert "Stakeholder Incentive Mapping" in system_prompt
    assert "Calibrated Confidence Scoring" in system_prompt

    # Verify instruction reflects pre-mortem and stakeholder incentive mapping
    assert "Temporal Inversion" in user_content
    assert "Stakeholder Incentive Mapping" in user_content




# --- Round 3: an objection that names nothing is a minor one --------------
#
# Round 2 Devil's Advocate: minimum confidence 0.30, median 0.75, 34 of 39 findings at
# or above 0.70. It had already been prompted into the zero band once and did not go,
# so the cap is the guarantee, not the prompt.


@pytest.mark.asyncio
async def test_evidence_free_finding_without_a_contradiction_is_capped(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    from core.evaluators._reasoning import EVIDENCE_FREE_OBJECTION_CAP
    from core.evaluators.devils_advocate import DevilsAdvocateOutput, run_devils_advocate

    provider = fake_provider_factory(
        responses=[
            DevilsAdvocateOutput(
                result="The team will lose momentum",
                reasoning="Nobody stays motivated through a 12-month migration.",
                confidence=0.85,
                contradiction=None,
            )
        ]
    )
    finding = await run_devils_advocate(sample_test_plan_item, sample_case, provider)
    assert finding.confidence == EVIDENCE_FREE_OBJECTION_CAP


@pytest.mark.asyncio
async def test_a_finding_that_names_its_contradiction_is_not_capped(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput, run_devils_advocate

    provider = fake_provider_factory(
        responses=[
            DevilsAdvocateOutput(
                result="The pricing premise is circular",
                reasoning="The margin assumes the volume the margin is meant to produce.",
                confidence=0.85,
                contradiction="Margin depends on volume that depends on the margin.",
            )
        ]
    )
    finding = await run_devils_advocate(sample_test_plan_item, sample_case, provider)
    assert finding.confidence == 0.85


@pytest.mark.asyncio
async def test_the_cap_does_not_lift_a_low_score(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput, run_devils_advocate

    provider = fake_provider_factory(
        responses=[
            DevilsAdvocateOutput(
                result="The premise holds under the pre-mortem",
                reasoning="No unstated premise the claim depends on would have to be false.",
                confidence=0.05,
                contradiction=None,
            )
        ]
    )
    finding = await run_devils_advocate(sample_test_plan_item, sample_case, provider)
    assert finding.confidence == 0.0


def test_the_pre_mortem_frame_is_conditional_not_a_fixed_failure():
    from core.evaluators.devils_advocate import DEVILS_ADVOCATE_SYSTEM_PROMPT as prompt

    assert "fixed future state" not in prompt
    assert "Suppose it is 12 months post-launch" in prompt
    assert "0.0-0.1 band" in prompt
