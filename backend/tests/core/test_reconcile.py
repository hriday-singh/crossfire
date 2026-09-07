import pytest
from core.models import Finding, EvidenceItem, WeakenedKind
from core.reconcile import classify_weakened, CONTESTED_OBJECTION_FLOOR

def _finding(confidence=0.0, evidence=False, contradiction=None):
    return Finding(
        claim_id="claim-1",
        test_id="test-1",
        evaluator="receipts",
        result="result",
        evidence=[EvidenceItem(source_url="http", snippet="x", retrieved_at="now")] if evidence else [],
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

def test_classify_weakened_empty_findings_qualified():
    # empty findings gives qualified (nothing was raised)
    assert classify_weakened([], "parameter") == WeakenedKind.QUALIFIED
