import pytest
from core.models import Finding, EvidenceItem, WeakenedKind
from core.reconcile import classify_weakened, CONTESTED_OBJECTION_FLOOR

def _finding(confidence=0.0, evidence=False, contradiction=None):
    return Finding(
        claim_id="claim-1",
        test_id="test-1",
        evaluator="researcher",
        result="result",
        evidence=(
            [
                EvidenceItem(
                    source_url="http",
                    snippet="x",
                    retrieved_at="now",
                    # A break requires a citation we could actually read back off the page.
                    verified=True,
                    verification="snippet_matched",
                )
            ]
            if evidence
            else []
        ),
        reasoning="reasoning",
        confidence=confidence,
        contradiction=contradiction,
    )

def test_classify_weakened_sourced_contradiction_low_objection():
    # sourced contradiction plus objection 0.1 gives contested
    findings = [_finding(confidence=0.1, evidence=True, contradiction="Yes")]
    assert classify_weakened(findings, "parameter") == WeakenedKind.CONTESTED

def test_classify_weakened_salvage_redesign_low_objection():
    # salvage_scope="redesign" plus objection 0.1 gives contested
    findings = [_finding(confidence=0.1)]
    assert classify_weakened(findings, "redesign") == WeakenedKind.CONTESTED

def test_classify_weakened_boundary_objection():
    # objection exactly 0.4 gives contested (boundary)
    findings = [_finding(confidence=0.4)]
    assert classify_weakened(findings, "parameter") == WeakenedKind.CONTESTED

def test_classify_weakened_below_boundary_qualified():
    # objection 0.39, no contradiction, parameter salvage gives qualified
    findings = [_finding(confidence=0.39)]
    assert classify_weakened(findings, "parameter") == WeakenedKind.QUALIFIED

def test_classify_weakened_empty_findings_contested():
    # empty findings gives contested (nothing was measured)
    assert classify_weakened([], "parameter") == WeakenedKind.CONTESTED


# --- Only a citation we could read back off the page can carry a break ---

from core.reconcile import has_sourced_contradiction  # noqa: E402


def _verified_finding(verification: str) -> Finding:
    return Finding(
        claim_id="c1",
        test_id="t1",
        evaluator="researcher",
        result="refuted",
        reasoning="r",
        contradiction="The operator's own policy forbids it.",
        evidence=[
            EvidenceItem(
                source_url="https://example.com",
                snippet="s",
                retrieved_at="2026-09-08",
                verification=verification,
                verified=(verification == "snippet_matched"),
            )
        ],
    )


def test_verified_evidence_supports_a_break():
    assert has_sourced_contradiction([_verified_finding("snippet_matched")]) is True


def test_unreachable_evidence_does_not_support_a_break():
    assert has_sourced_contradiction([_verified_finding("unreachable")]) is False


def test_unchecked_evidence_does_not_support_a_break():
    assert has_sourced_contradiction([_verified_finding("unchecked")]) is False


def test_contradiction_without_evidence_still_does_not_break():
    finding = Finding(
        claim_id="c1",
        test_id="t1",
        evaluator="devils_advocate",
        result="refuted",
        reasoning="r",
        contradiction="Akamai blocks it.",
        evidence=[],
    )
    assert has_sourced_contradiction([finding]) is False


# --- The same objection restated under every claim is padding, not analysis ---

from core.reconcile import dedupe_across_claims  # noqa: E402


def _dedupe_finding(claim_id: str, contradiction: str, confidence: float) -> Finding:
    return Finding(
        claim_id=claim_id,
        test_id=f"t-{claim_id}",
        evaluator="devils_advocate",
        result="refuted",
        reasoning="r",
        contradiction=contradiction,
        confidence=confidence,
    )


def test_near_duplicate_objections_collapse_to_the_strongest():
    findings = [
        _dedupe_finding("c1", "Edge bot protection and mandatory OTP block automated sessions.", 0.5),
        _dedupe_finding("c2", "Mandatory OTP and edge bot protection block automated sessions.", 0.8),
        _dedupe_finding("c3", "Demand mathematically exceeds the seat supply in the database.", 0.6),
    ]
    result = dedupe_across_claims(findings)
    kept = [f.contradiction for f in result]
    assert len(result) == 2
    assert any("mathematically exceeds" in (c or "") for c in kept)
    assert sum(1 for c in kept if "bot protection" in (c or "")) == 1


def test_the_surviving_duplicate_is_the_strongest_one():
    findings = [
        _dedupe_finding("c1", "Edge bot protection blocks automated sessions.", 0.3),
        _dedupe_finding("c2", "Edge bot protection blocks automated sessions.", 0.9),
    ]
    result = dedupe_across_claims(findings)
    assert len(result) == 1
    assert result[0].confidence == 0.9


def test_findings_on_the_same_claim_are_never_deduped_against_each_other():
    findings = [
        _dedupe_finding("c1", "Edge bot protection blocks automated sessions.", 0.3),
        _dedupe_finding("c1", "Edge bot protection blocks automated sessions.", 0.9),
    ]
    assert len(dedupe_across_claims(findings)) == 2


def test_distinct_objections_all_survive():
    findings = [
        _dedupe_finding("c1", "The operator prohibits it in its own agent policy.", 0.7),
        _dedupe_finding("c2", "Aadhaar OTP is now mandatory for this quota.", 0.6),
    ]
    assert len(dedupe_across_claims(findings)) == 2


def test_empty_input_returns_empty():
    assert dedupe_across_claims([]) == []
