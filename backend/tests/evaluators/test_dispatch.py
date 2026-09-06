"""
Owner: Dev C. Tests for evaluator dispatch routing.
"""
from __future__ import annotations

import pytest

from core.evaluators import dispatch
from core.models import Case, Claim, Finding, TestPlanItem


@pytest.mark.asyncio
async def test_dispatch_routes_assumption_to_devils_advocate(fake_provider_factory, sample_case):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput

    item = TestPlanItem(
        id="t-assumption",
        target_claim=sample_case.claims[0].id,
        failure_mode="assumption",
        objective="Test unstated premises",
    )
    provider = fake_provider_factory(
        responses=[
            DevilsAdvocateOutput(
                result="Assumption flawed",
                reasoning="Critical premise missing",
                confidence=0.85,
                contradiction="Contradicts survey data",
            )
        ]
    )

    finding = await dispatch(item, sample_case, provider)
    assert finding.evaluator == "devils_advocate"
    assert finding.test_id == "t-assumption"
    assert finding.claim_id == sample_case.claims[0].id
    assert finding.result == "Assumption flawed"
    assert finding.reasoning == "Critical premise missing"
    assert finding.contradiction == "Contradicts survey data"


@pytest.mark.asyncio
async def test_dispatch_routes_evidence_to_receipts(monkeypatch, fake_provider_factory, sample_case):
    from core.models import EvidenceItem
    from core.evaluators.receipts import ReceiptsAssessment

    async def mock_search(query, max_results=5):
        return [
            EvidenceItem(
                title="Adoption study",
                source_url="https://example.com/study",
                snippet="A comprehensive study over 500 students showed high reluctance to trust autonomous AI application submissions.",
                retrieved_at="2026-09-06T12:00:00Z",
            )
        ]

    monkeypatch.setattr("core.evaluators.receipts.search_evidence", mock_search)

    item = TestPlanItem(
        id="t-evidence",
        target_claim=sample_case.claims[0].id,
        failure_mode="evidence",
        objective="Check whether evidence supports",
    )
    provider = fake_provider_factory(
        responses=[
            ReceiptsAssessment(
                result="Evidence contradicts claim",
                reasoning="Empirical survey demonstrates reluctance",
                confidence=0.9,
                contradiction="Students distrust autonomous agents",
            )
        ]
    )

    finding = await dispatch(item, sample_case, provider)
    assert finding.evaluator in ("researcher", "receipts")
    assert finding.test_id == "t-evidence"
    assert finding.claim_id == sample_case.claims[0].id
    assert finding.result == "Evidence contradicts claim"
    assert len(finding.evidence) >= 1


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["feasibility", "constraint", "behavior"])
async def test_dispatch_routes_feasibility_modes_to_builder(mode, fake_provider_factory, sample_case):
    from core.evaluators.builder import BuilderVerdict

    item = TestPlanItem(
        id=f"t-{mode}",
        target_claim=sample_case.claims[0].id,
        failure_mode=mode,
        objective="Check technical feasibility",
    )
    provider = fake_provider_factory(
        responses=[
            BuilderVerdict(
                result="Build is high effort but feasible",
                reasoning="Requires custom integration with application APIs",
                confidence=0.75,
                blocker="Closed API endpoints",
            )
        ]
    )

    finding = await dispatch(item, sample_case, provider)
    assert finding.evaluator == "builder"
    assert finding.test_id == f"t-{mode}"
    assert finding.claim_id == sample_case.claims[0].id
    assert finding.result == "Build is high effort but feasible"
    assert finding.contradiction == "Closed API endpoints"


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["operational_friction", "adoption", "bureaucracy"])
async def test_dispatch_routes_operational_modes_to_operator(mode, fake_provider_factory, sample_case):
    from core.evaluators.operator import OperatorVerdict

    item = TestPlanItem(
        id=f"t-{mode}",
        target_claim=sample_case.claims[0].id,
        failure_mode=mode,
        objective="Test operational friction and bureaucracy",
    )
    provider = fake_provider_factory(
        responses=[
            OperatorVerdict(
                result="Procurement gatekeeper rejection",
                reasoning="Legal and procurement require 12-month compliance vetting.",
                confidence=0.85,
                friction_type="enterprise_gatekeeping",
                operational_blocker="Enterprise procurement freeze",
            )
        ]
    )

    finding = await dispatch(item, sample_case, provider)
    assert finding.evaluator == "operator"
    assert finding.test_id == f"t-{mode}"
    assert finding.claim_id == sample_case.claims[0].id
    assert finding.result == "Procurement gatekeeper rejection"
    assert finding.contradiction == "Enterprise procurement freeze"


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["edge-case", "edge_case", "alternative"])
async def test_dispatch_routes_edge_case_and_alternative_to_operator(mode, fake_provider_factory, sample_case):
    from core.evaluators.operator import OperatorVerdict

    item = TestPlanItem(
        id=f"t-{mode}",
        target_claim=sample_case.claims[0].id,
        failure_mode=mode,
        objective="Test tail risks and boundary conditions",
    )
    provider = fake_provider_factory(
        responses=[
            OperatorVerdict(
                result="Extreme edge failure potential",
                reasoning="Cascading submission failures under quota throttling",
                confidence=0.8,
                friction_type="process_drag",
                operational_blocker="System deadlock risk",
            )
        ]
    )

    finding = await dispatch(item, sample_case, provider)
    assert finding.evaluator == "operator"
    assert finding.test_id == f"t-{mode}"
    assert finding.claim_id == sample_case.claims[0].id
    assert finding.result == "Extreme edge failure potential"


@pytest.mark.asyncio
async def test_dispatch_fallback_unknown_mode(fake_provider_factory, sample_case):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput

    item = TestPlanItem(
        id="t-unknown",
        target_claim=sample_case.claims[0].id,
        failure_mode="nonexistent_mode",
        objective="Fallback test",
    )
    provider = fake_provider_factory(
        responses=[
            DevilsAdvocateOutput(
                result="Fallback assumption critique",
                reasoning="Standard reasoning applies",
                confidence=0.5,
            )
        ]
    )

    finding = await dispatch(item, sample_case, provider)
    assert finding.evaluator == "devils_advocate"
    assert finding.test_id == "t-unknown"
    assert finding.claim_id == sample_case.claims[0].id


@pytest.mark.asyncio
async def test_dispatch_handles_missing_target_claim_gracefully(fake_provider_factory, sample_case):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput

    item = TestPlanItem(
        id="t-missing",
        target_claim="nonexistent-claim-id",
        failure_mode="assumption",
        objective="Standalone objective without claim in case",
    )
    provider = fake_provider_factory(
        responses=[
            DevilsAdvocateOutput(
                result="Critiqued via objective fallback",
                reasoning="Evaluated successfully without raising",
                confidence=0.6,
            )
        ]
    )

    finding = await dispatch(item, sample_case, provider)
    assert finding.evaluator == "devils_advocate"
    assert finding.test_id == "t-missing"
    assert finding.claim_id == "nonexistent-claim-id"
    assert finding.result == "Critiqued via objective fallback"


@pytest.mark.asyncio
async def test_dispatch_integrates_with_core_loop_run_evaluators(fake_provider_factory, sample_case):
    from core.evaluators.devils_advocate import DevilsAdvocateOutput
    from core.loop import run_evaluators
    import events

    item = TestPlanItem(
        id="plan-item-1",
        target_claim=sample_case.claims[0].id,
        failure_mode="assumption",
        objective="Stress test assumptions",
    )
    provider = fake_provider_factory(
        responses=[
            DevilsAdvocateOutput(
                result="Premise rejected",
                reasoning="Assumption fails under scrutiny",
                confidence=0.8,
            )
        ]
    )

    findings = await run_evaluators(sample_case, [item], provider)
    assert len(findings) == 1
    assert findings[0].evaluator == "devils_advocate"
    assert findings[0].claim_id == sample_case.claims[0].id

    # Verify events published to events queue
    queue = events.get_queue(sample_case.id)
    ev1 = queue.get_nowait()
    assert ev1["event"] == "test_started"
    assert ev1["data"]["test_id"] == "plan-item-1"

    ev2 = queue.get_nowait()
    assert ev2["event"] == "finding_ready"
    assert ev2["data"]["target_claim_id"] == sample_case.claims[0].id
    assert ev2["data"]["finding"]["evaluator"] == "devils_advocate"


