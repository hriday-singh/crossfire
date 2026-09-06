from __future__ import annotations

import pytest
from core.evaluators.operator import OperatorVerdict, run_operator
from core.models import Case, Claim, Finding, TestPlanItem


@pytest.mark.asyncio
async def test_run_operator_produces_finding_with_friction_blocker(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    fake_output = OperatorVerdict(
        result="Critical procurement and InfoSec bottleneck",
        reasoning="Enterprise security policies will mandate SOC 2 Type II audit before rollout.",
        confidence=0.85,
        friction_type="enterprise_gatekeeping",
        operational_blocker="Mandatory SOC 2 Type II certification and 9-month vendor assessment cycle",
    )
    provider = fake_provider_factory(responses=[fake_output])
    sample_test_plan_item.failure_mode = "operational_friction"
    finding = await run_operator(sample_test_plan_item, sample_case, provider)

    assert finding.evaluator == "operator"
    assert finding.claim_id == sample_claim.id
    assert finding.test_id == sample_test_plan_item.id
    assert finding.result == "Critical procurement and InfoSec bottleneck"
    assert "SOC 2 Type II" in finding.reasoning
    assert finding.confidence == 0.85
    assert finding.contradiction == "Mandatory SOC 2 Type II certification and 9-month vendor assessment cycle"
    assert finding.evidence == []


@pytest.mark.asyncio
async def test_run_operator_handles_friction_none(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    fake_output = OperatorVerdict(
        result="Operationally sound with existing user workflows",
        reasoning="Workflow seamlessly plugs into existing email triage without behavioral friction.",
        confidence=0.9,
        friction_type="none",
        operational_blocker=None,
    )
    provider = fake_provider_factory(responses=[fake_output])
    finding = await run_operator(sample_test_plan_item, sample_case, provider)

    assert finding.evaluator == "operator"
    assert finding.contradiction is None
    assert finding.confidence == 0.9


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "friction_type",
    [
        "incentive_misalignment",
        "enterprise_gatekeeping",
        "regulatory_liability",
        "process_drag",
    ],
)
async def test_run_operator_supports_all_friction_pillars(
    friction_type, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    fake_output = OperatorVerdict(
        result=f"Friction detected in {friction_type}",
        reasoning=f"Specific breakdown in {friction_type} across teams.",
        confidence=0.8,
        friction_type=friction_type,
        operational_blocker=f"Blocker for {friction_type}",
    )
    provider = fake_provider_factory(responses=[fake_output])
    finding = await run_operator(sample_test_plan_item, sample_case, provider)
    assert finding.evaluator == "operator"
    assert finding.contradiction == f"Blocker for {friction_type}"


@pytest.mark.asyncio
async def test_run_operator_never_calls_evidence_pipeline(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Operator must never call the evidence pipeline")

    monkeypatch.setattr("evidence.search.search_evidence", _fail_if_called)

    fake_output = OperatorVerdict(
        result="Workflow resistance identified",
        reasoning="Frontline users reject manual tagging",
        confidence=0.75,
        friction_type="incentive_misalignment",
        operational_blocker="Unpaid cognitive load on sales reps",
    )
    provider = fake_provider_factory(responses=[fake_output])
    finding = await run_operator(sample_test_plan_item, sample_case, provider)
    assert finding.evaluator == "operator"
    assert finding.evidence == []


@pytest.mark.asyncio
async def test_run_operator_takes_contract_signature(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    fake_output = OperatorVerdict(
        result="Adoption stalled",
        reasoning="Process friction exceeds ROI",
        confidence=0.8,
        friction_type="process_drag",
        operational_blocker="Manual validation overhead",
    )
    provider = fake_provider_factory(responses=[fake_output])
    finding = await run_operator(sample_test_plan_item, sample_case, provider)
    assert finding.claim_id == sample_claim.id

    with pytest.raises(AttributeError):
        await run_operator(sample_claim, sample_test_plan_item, provider)


@pytest.mark.asyncio
async def test_run_operator_sees_only_its_own_claim(
    fake_provider_factory, sample_case
):
    target_claim = sample_case.claims[0]
    other_claim = sample_case.claims[1]

    item = TestPlanItem(
        id="test-op-1",
        target_claim=target_claim.id,
        failure_mode="operational_friction",
        objective=f"Test operational friction for: {target_claim.statement}",
    )

    fake_output = OperatorVerdict(
        result="Procurement blocker identified",
        reasoning="Incompatible compliance requirements",
        confidence=0.8,
        friction_type="enterprise_gatekeeping",
        operational_blocker="Vendor registration backlog",
    )
    provider = fake_provider_factory(responses=[fake_output])

    finding = await run_operator(item, sample_case, provider)
    assert finding.evaluator == "operator"
    assert finding.claim_id == target_claim.id

    # Verify claim isolation
    assert len(provider.calls) == 1
    call_content = provider.calls[0]["messages"][0]["content"]
    assert target_claim.statement in call_content
    assert other_claim.statement not in call_content


@pytest.mark.asyncio
async def test_run_operator_includes_case_context(fake_provider_factory):
    case_with_context = Case(
        id="case-ctx-op",
        raw_input="Deploy automated student visa assistant",
        context="Policy Guide: Automated filing without human legal counsel violates federal immigration regulations",
        claims=[Claim(id="c1", statement="System can auto-file immigration documents")],
    )
    item = TestPlanItem(
        id="t-op-ctx",
        target_claim="c1",
        failure_mode="operational_friction",
        objective="Check compliance and liability",
    )

    fake_output = OperatorVerdict(
        result="Regulatory liability breach",
        reasoning="Unauthorized practice of law in immigration filings",
        confidence=0.95,
        friction_type="regulatory_liability",
        operational_blocker="Federal statutory restriction against automated filing",
    )
    provider = fake_provider_factory(responses=[fake_output])

    finding = await run_operator(item, case_with_context, provider)
    assert finding.evaluator == "operator"

    call_content = provider.calls[0]["messages"][0]["content"]
    assert "Automated filing without human legal counsel" in call_content


@pytest.mark.asyncio
async def test_run_operator_raises_on_missing_provider(
    sample_case, sample_test_plan_item
):
    with pytest.raises(ValueError, match="LLMProvider must be provided"):
        await run_operator(sample_test_plan_item, sample_case, None)
