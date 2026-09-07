"""
Regression tests for the fixes derived from the 2026-09-07 calibration corpus
(docs/calibration/01-baseline-report.md). Each test pins one measured defect:

- `proceed` was returned 0/15 times, because nothing downstream read the
  `no objection` band of OBJECTION_SCALE.
- `drop` was returned 9/15 times, because one broken load-bearing claim sank the
  case even when Break to Rebuild had produced a salvage.
- Every case retrieved ordinary `web` sources; the 6 that beat the vanilla
  control all rested on a primary or institutional one.
"""
import pytest

from core.models import Case, Claim, ClaimStatus, EvidenceItem, Finding
from core.reconcile import apply_evidence_gate, apply_steelman_gate, SteelManVerdict
from core.synthesis import _fallback_decision_state


def _finding(claim_id: str, evaluator: str, confidence: float, *, evidence=(), contradiction=None):
    return Finding(
        claim_id=claim_id,
        test_id=f"t-{evaluator}",
        evaluator=evaluator,
        result="checked",
        evidence=list(evidence),
        reasoning="one specific.",
        confidence=confidence,
        contradiction=contradiction,
    )


def _evidence(url="https://www.ecfr.gov/rule"):
    return EvidenceItem(source_url=url, snippet="The federal cap is 11 hours.", retrieved_at="2026-09-07T00:00:00Z")


# --- the upward gate: `survived` has to be reachable ----------------------


def test_weakened_upgrades_to_survived_when_every_finding_is_in_the_no_objection_band():
    findings = [
        _finding("c1", "builder", 0.05),
        _finding("c1", "operator", 0.0),
        _finding("c1", "devils_advocate", 0.1),
        _finding("c1", "researcher", 0.15),
    ]
    status, reasoning = apply_evidence_gate(ClaimStatus.WEAKENED, "Holds.", findings)
    assert status is ClaimStatus.SURVIVED
    assert "Upgraded from weakened to survived" in reasoning


def test_weakened_stands_when_one_finding_is_substantive():
    findings = [_finding("c1", "builder", 0.05), _finding("c1", "operator", 0.45)]
    status, reasoning = apply_evidence_gate(ClaimStatus.WEAKENED, "Holds with caveats.", findings)
    assert status is ClaimStatus.WEAKENED
    assert reasoning == "Holds with caveats."


def test_weakened_stands_when_a_sourced_contradiction_exists_however_softly_scored():
    findings = [
        _finding("c1", "researcher", 0.1, evidence=[_evidence()], contradiction="The cap is 11 hours.")
    ]
    status, _ = apply_evidence_gate(ClaimStatus.WEAKENED, "Holds.", findings)
    assert status is ClaimStatus.WEAKENED


def test_broken_still_downgrades_without_a_sourced_contradiction():
    findings = [_finding("c1", "devils_advocate", 0.95)]
    status, reasoning = apply_evidence_gate(ClaimStatus.BROKEN, "Refuted.", findings)
    assert status is ClaimStatus.WEAKENED
    assert "Downgraded from broken to weakened" in reasoning


def test_upgrade_to_survived_clears_the_salvage_fields():
    """Phase 2 invariant: a claim that survived has no fatal flaw to rebuild from."""
    verdict = SteelManVerdict(
        status=ClaimStatus.WEAKENED,
        reasoning="Holds.",
        fatal_flaw="Timeline is tight.",
        salvaged_claim="Stage the rollout.",
        tradeoff_acknowledged="Slower cutover.",
    )
    gated = apply_steelman_gate(verdict, [_finding("c1", "builder", 0.05)])
    assert gated.status is ClaimStatus.SURVIVED
    assert gated.fatal_flaw is None
    assert gated.salvaged_claim is None
    assert gated.tradeoff_acknowledged is None


# --- the decision ladder --------------------------------------------------


def _case(claims, findings=()):
    return Case(id="case-1", raw_input="A decision", claims=claims, findings=list(findings))


def test_broken_load_bearing_claim_with_a_salvage_does_not_drop_the_case():
    case = _case(
        [
            Claim(
                id="c1",
                statement="Self-representation wins custody",
                load_bearing=True,
                status=ClaimStatus.BROKEN,
                salvaged_claim="Use unbundled legal services for the hearing filings.",
            )
        ]
    )
    assert _fallback_decision_state(case) == "proceed_with_changes"


def test_broken_load_bearing_claim_without_a_salvage_still_drops():
    case = _case(
        [
            Claim(
                id="c1",
                statement="Drivers run 14-hour shifts",
                load_bearing=True,
                status=ClaimStatus.BROKEN,
                salvaged_claim=None,
            )
        ]
    )
    assert _fallback_decision_state(case) == "drop"


def test_one_unsalvageable_broken_claim_drops_the_case_even_beside_a_salvaged_one():
    case = _case(
        [
            Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.BROKEN, salvaged_claim="Scope it down."),
            Claim(id="c2", statement="B", load_bearing=True, status=ClaimStatus.BROKEN, salvaged_claim=None),
        ]
    )
    assert _fallback_decision_state(case) == "drop"


def test_weakened_on_trivial_objections_alone_still_reaches_proceed():
    case = _case(
        [Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.WEAKENED)],
        findings=[_finding("c1", "builder", 0.1), _finding("c1", "operator", 0.2)],
    )
    assert _fallback_decision_state(case) == "proceed"


def test_weakened_on_a_substantive_objection_blocks_proceed():
    case = _case(
        [Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.WEAKENED)],
        findings=[_finding("c1", "builder", 0.1), _finding("c1", "operator", 0.5)],
    )
    assert _fallback_decision_state(case) == "proceed_with_changes"


def test_weakened_with_no_findings_at_all_blocks_proceed():
    """No findings means nothing was measured, not that nothing was wrong."""
    case = _case([Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.WEAKENED)])
    assert _fallback_decision_state(case) == "proceed_with_changes"


def test_unresolved_load_bearing_claim_holds():
    case = _case([Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.UNRESOLVED)])
    assert _fallback_decision_state(case) == "hold"


def test_all_survived_reaches_proceed():
    case = _case([Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.SURVIVED)])
    assert _fallback_decision_state(case) == "proceed"


def test_a_broken_secondary_claim_does_not_sink_a_sound_case():
    case = _case(
        [
            Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.SURVIVED),
            Claim(id="c2", statement="B", load_bearing=False, status=ClaimStatus.BROKEN),
        ]
    )
    assert _fallback_decision_state(case) == "proceed"
