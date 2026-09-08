"""
Owner: Dev A. These test the frozen contract itself (docs/00-CONTRACTS.md §1) —
no mocking needed, pure Pydantic validation. Write these FIRST, right after
core/models.py exists, before anyone else starts building against it. If one
of these fails, the contract doesn't match the spec and it needs fixing before
Dev B/C branch off, not after.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from core.models import Case, Claim, ClaimStatus, DecisionConsequence, EvidenceItem, Finding, TestPlanItem


def test_claim_status_has_exactly_four_values():
    assert {s.value for s in ClaimStatus} == {"survived", "weakened", "broken", "unresolved"}


def test_claim_minimal_construction():
    c = Claim(id="c1", statement="Users will pay for this")
    assert c.load_bearing is None
    assert c.status is None


def test_claim_status_accepts_enum_value():
    c = Claim(id="c1", statement="x", status=ClaimStatus.BROKEN)
    assert c.status == ClaimStatus.BROKEN


def test_finding_defaults_empty_evidence_list():
    f = Finding(
        claim_id="c1",
        test_id="t1",
        evaluator="devils_advocate",
        result="No support found",
        reasoning="Pure assumption attack",
        confidence=0.3,
    )
    assert f.evidence == []
    assert f.contradiction is None


def test_decision_consequence_verdict_reasoning_defaults_empty_string():
    dc = DecisionConsequence(
        claim_id="c1",
        impact="high",
        recommended_change="Reconsider the autonomous-submission flow",
    )
    assert dc.verdict_reasoning == ""
    assert dc.next_validation is None


def test_case_defaults_to_extracting_status():
    case = Case(id="case-1", raw_input="some input")
    assert case.status == "extracting"
    assert case.claims == []
    assert case.findings == []


def test_case_round_trips_through_full_pipeline_shape(sample_claim, sample_finding):
    """A Case should be able to accumulate claims and findings without losing shape —
    this is the object every module reads/appends to/streams a diff of."""
    case = Case(id="case-1", raw_input="input", claims=[sample_claim])
    case.findings.append(sample_finding)
    assert len(case.findings) == 1
    assert case.findings[0].claim_id == sample_claim.id


@pytest.mark.parametrize("missing_field", ["id", "statement"])
def test_claim_requires_id_and_statement(missing_field):
    fields = {"id": "c1", "statement": "x"}
    del fields[missing_field]
    with pytest.raises(ValidationError):
        Claim(**fields)


def test_claim_invalid_status_raises_validation_error():
    with pytest.raises(ValidationError):
        Claim(id="c1", statement="x", status="unsupported_status")


def test_evidence_item_minimal_and_full():
    item = EvidenceItem(
        source_url="https://example.com/source",
        snippet="Key finding snippet",
        retrieved_at="2026-09-06T12:00:00Z",
    )
    assert item.title is None
    assert item.source_url == "https://example.com/source"

    item_with_title = EvidenceItem(
        source_url="https://example.com/source",
        title="Source Article",
        snippet="Key finding snippet",
        retrieved_at="2026-09-06T12:00:00Z",
    )
    assert item_with_title.title == "Source Article"

    with pytest.raises(ValidationError):
        EvidenceItem(source_url="https://example.com/source", snippet="Key snippet")


def test_test_plan_item_validation():
    tpi = TestPlanItem(
        id="test-item-1",
        target_claim="claim-1",
        failure_mode="evidence",
        objective="Verify market size with external data",
    )
    assert tpi.id == "test-item-1"
    assert tpi.target_claim == "claim-1"
    assert tpi.failure_mode == "evidence"
    assert tpi.objective == "Verify market size with external data"

    with pytest.raises(ValidationError):
        TestPlanItem(id="t1", target_claim="c1")


def test_case_full_json_roundtrip(sample_claim, sample_test_plan_item, sample_finding):
    dc = DecisionConsequence(
        claim_id=sample_claim.id,
        impact="high",
        recommended_change="Drop autonomous submission",
        next_validation="Interview 10 college counselors",
        verdict_reasoning="High user resistance expected",
    )
    case = Case(
        id="case-full-1",
        raw_input="AI college counselor",
        context="https://example.com/context",
        claims=[sample_claim],
        test_plan=[sample_test_plan_item],
        findings=[sample_finding],
        consequences=[dc],
        status="testing",
    )

    json_str = case.model_dump_json()
    reconstructed = Case.model_validate_json(json_str)

    assert reconstructed.id == case.id
    assert reconstructed.status == "testing"
    assert reconstructed.context == "https://example.com/context"
    assert len(reconstructed.claims) == 1
    assert reconstructed.claims[0].statement == sample_claim.statement
    assert len(reconstructed.test_plan) == 1
    assert reconstructed.test_plan[0].failure_mode == "evidence"
    assert len(reconstructed.findings) == 1
    assert reconstructed.findings[0].evaluator == "researcher"
    assert len(reconstructed.consequences) == 1
    assert reconstructed.consequences[0].next_validation == "Interview 10 college counselors"


def test_claim_steelman_salvage_fields():
    c = Claim(id="c1", statement="Users will pay $500/mo")
    assert c.fatal_flaw is None
    assert c.salvaged_claim is None
    assert c.tradeoff_acknowledged is None

    c_mitigated = Claim(
        id="c1",
        statement="Users will pay $500/mo",
        status=ClaimStatus.WEAKENED,
        fatal_flaw="Unsubstantiated price elasticity",
        salvaged_claim="Users will pay $99/mo for starter tier",
        tradeoff_acknowledged="Lower initial ARPU requires higher customer volume",
    )
    assert c_mitigated.fatal_flaw == "Unsubstantiated price elasticity"
    assert c_mitigated.salvaged_claim == "Users will pay $99/mo for starter tier"
    assert c_mitigated.tradeoff_acknowledged == "Lower initial ARPU requires higher customer volume"


def test_decision_consequence_steelman_salvage_fields():
    dc = DecisionConsequence(
        claim_id="c1",
        impact="high",
        recommended_change="Pilot lower tier",
        fatal_flaw="Unsubstantiated price elasticity",
        salvaged_claim="Users will pay $99/mo for starter tier",
        tradeoff_acknowledged="Lower initial ARPU requires higher customer volume",
    )
    assert dc.fatal_flaw == "Unsubstantiated price elasticity"
    assert dc.salvaged_claim == "Users will pay $99/mo for starter tier"
    assert dc.tradeoff_acknowledged == "Lower initial ARPU requires higher customer volume"


# --- Output-quality additions (2026-09-08): verification, terms, mechanisms, build spec ---

from core.models import BuildSpec, CaseVerdict, ResolvedTerm  # noqa: E402


def test_evidence_item_defaults_to_unchecked():
    item = EvidenceItem(source_url="https://example.com", snippet="x", retrieved_at="2026-09-08")
    assert item.verified is False
    assert item.verification == "unchecked"


def test_claim_accepts_terms_and_mechanism():
    claim = Claim(
        id="c1",
        statement="bot books tickets",
        terms=[ResolvedTerm(term="holiday quotas", resolved="Tatkal quota", search_phrasing="IRCTC Tatkal quota timing")],
        mechanism_of="irctc-booking-bot",
    )
    assert claim.terms[0].search_phrasing == "IRCTC Tatkal quota timing"
    assert claim.mechanism_of == "irctc-booking-bot"


def test_claim_defaults_have_no_terms_or_mechanism():
    claim = Claim(id="c1", statement="x")
    assert claim.terms == []
    assert claim.mechanism_of is None


def test_case_verdict_carries_surviving_core_and_build_spec():
    verdict = CaseVerdict(
        decision_state="proceed_with_changes",
        summary="s",
        surviving_core="The prepare-and-race mechanism survives.",
        build_spec=BuildSpec(
            what_it_does="Prepares the booking up to the CAPTCHA.",
            what_it_omits="Automated CAPTCHA solving, because it defeats an anti-bot control.",
            demo_path="Run against a mock booking environment with a countdown.",
            cheapest_experiment="Time a prepared human against the agent on a non-peak window.",
        ),
    )
    assert verdict.surviving_core.startswith("The prepare-and-race")
    assert verdict.build_spec.what_it_omits.startswith("Automated CAPTCHA")


def test_case_verdict_defaults_are_empty():
    verdict = CaseVerdict(decision_state="drop", summary="s")
    assert verdict.surviving_core == ""
    assert verdict.build_spec is None
