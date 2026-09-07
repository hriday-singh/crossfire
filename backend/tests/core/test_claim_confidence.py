import pytest
from core.models import Claim, ClaimStatus, Finding, EvidenceItem
from core.loop import calculate_claim_confidence

def test_calculate_claim_confidence_survived():
    # 0.0 max objection -> 0.98
    assert calculate_claim_confidence(ClaimStatus.SURVIVED, 0.0) == 0.98
    # 0.15 minor objection -> calibrated between 0.90 and 0.98
    conf = calculate_claim_confidence(ClaimStatus.SURVIVED, 0.15)
    assert 0.90 <= conf <= 0.98
    assert conf == 0.92

def test_calculate_claim_confidence_weakened():
    from core.models import WeakenedKind

    # Legacy fallback: 0.35 objection -> ~0.55
    conf = calculate_claim_confidence(ClaimStatus.WEAKENED, 0.35)
    assert 0.40 <= conf <= 0.60
    assert conf == 0.55
    
    # Qualified: 0.60 to 0.75
    conf_q = calculate_claim_confidence(ClaimStatus.WEAKENED, 0.35, WeakenedKind.QUALIFIED)
    assert 0.60 <= conf_q <= 0.75
    assert conf_q == 0.71
    
    # Contested: 0.35 to 0.55
    conf_c = calculate_claim_confidence(ClaimStatus.WEAKENED, 0.35, WeakenedKind.CONTESTED)
    assert 0.35 <= conf_c <= 0.55
    assert conf_c == 0.50

def test_calculate_claim_confidence_broken():
    # 0.95 fatal objection -> ~0.07
    conf = calculate_claim_confidence(ClaimStatus.BROKEN, 0.95)
    assert 0.05 <= conf <= 0.15
    assert conf == 0.07

def test_calculate_claim_confidence_unresolved():
    assert calculate_claim_confidence(ClaimStatus.UNRESOLVED, 0.5) == 0.50

def test_claim_model_has_confidence_field():
    c = Claim(id="c1", statement="Test statement", confidence=0.96)
    assert c.confidence == 0.96
    dumped = c.model_dump()
    assert dumped["confidence"] == 0.96
