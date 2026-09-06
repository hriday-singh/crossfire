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
