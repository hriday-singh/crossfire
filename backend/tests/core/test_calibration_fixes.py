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

from core.models import Case, Claim, ClaimStatus, EvidenceItem, Finding, WeakenedKind
from core.cross_examination import (
    extract_critical_blocker,
    is_statutory_blocker,
)
from core.reconcile import (
    STEEL_MAN_SYSTEM_PROMPT,
    apply_evidence_gate,
    apply_steelman_gate,
    SteelManVerdict,
)
from core.synthesis import (
    CASE_VERDICT_SYSTEM_PROMPT,
    _fallback_decision_state,
    clamp_decision_state,
)


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
    from core.reconcile import classify_weakened
    for c in claims:
        if c.status == ClaimStatus.WEAKENED and c.weakened_kind is None:
            c.weakened_kind = classify_weakened(
                [f for f in findings if f.claim_id == c.id],
                c.salvage_scope
            )
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
        [Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.WEAKENED, weakened_kind=WeakenedKind.QUALIFIED)],
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


# --- G1: statutory blockers reach the cross-examination probe -------------
#
# b1-phi-google-drive and b2-14-hour-shifts both named their statute correctly and
# still lost `broken`, because the only findings carrying a citation were
# reasoning-only and `extract_critical_blocker` never looked at Operator, which is
# where `friction_type="regulatory_liability"` lands.


@pytest.mark.parametrize(
    "text",
    [
        "Link sharing defeats access control under 45 CFR 164.312",
        "49 CFR 395.3 caps property-carrying drivers at 11 hours",
        "Denver municipal code 38-86 bans overnight camping",
        "A guaranteed 8% return is an unregistered security under Howey",
        "Operating without a state money transmitter license",
        "Apple rejects this under section 4.2 of the review guidelines",
    ],
)
def test_statutory_blockers_are_recognised(text):
    assert is_statutory_blocker(text)


@pytest.mark.parametrize(
    "text",
    [
        "The vendor API rate limit is 100 requests per second",
        "Engineers will resist the new tagging workflow",
        "Two seconds of latency per page render",
        "The dotted line reporting structure adds a week",
        None,
        "",
    ],
)
def test_ordinary_blockers_are_not_mistaken_for_statutory(text):
    assert not is_statutory_blocker(text)


def test_operator_regulatory_blocker_is_now_probed():
    findings = [
        _finding("c1", "operator", 0.85, contradiction="Violates 45 CFR 164.312 access control"),
    ]
    assert extract_critical_blocker(findings) == "Violates 45 CFR 164.312 access control"


def test_statutory_blocker_outranks_a_harder_non_statutory_one():
    findings = [
        _finding("c1", "devils_advocate", 0.95, contradiction="Nobody on the team wants this"),
        _finding("c1", "operator", 0.70, contradiction="49 CFR 395.3 caps driving at 11 hours"),
    ]
    assert extract_critical_blocker(findings) == "49 CFR 395.3 caps driving at 11 hours"


def test_hardest_blocker_wins_when_none_are_statutory():
    findings = [
        _finding("c1", "builder", 0.65, contradiction="[Day-1 Blocker] no export API"),
        _finding("c1", "devils_advocate", 0.90, contradiction="Assumes the counterparty agrees"),
    ]
    assert extract_critical_blocker(findings) == "Assumes the counterparty agrees"


def test_blockers_below_their_persona_floor_are_not_probed():
    findings = [
        _finding("c1", "builder", 0.5, contradiction="minor friction"),
        _finding("c1", "devils_advocate", 0.65, contradiction="a soft premise"),
        _finding("c1", "operator", 0.4, contradiction="some paperwork"),
    ]
    assert extract_critical_blocker(findings) is None


def test_a_finding_that_already_has_sources_is_not_probed_again():
    findings = [
        _finding(
            "c1",
            "researcher",
            0.9,
            evidence=[_evidence()],
            contradiction="49 CFR 395.3 caps driving at 11 hours",
        ),
    ]
    assert extract_critical_blocker(findings) is None


# --- G2: `weakened` must stop absorbing `unresolved` ----------------------
#
# Band C put 66.7% of its claims in `weakened`, including c3-head-of-sales-timing,
# a pure counterfactual that no fact can settle. The discriminator lives in the
# judge prompt; this pins that it is actually in there.


def test_steel_man_prompt_discriminates_weakened_from_unresolved():
    prompt = STEEL_MAN_SYSTEM_PROMPT
    assert "cannot tell" in prompt
    assert "'missing_input' field" in prompt
    # Round 3: a forward-looking claim is not automatically unresolvable.
    assert "NOT unresolved merely because it looks forward" in prompt


# --- G3: the ladder is the floor, not a dead fallback --------------------


def test_llm_may_not_go_below_the_derived_state():
    assert clamp_decision_state("drop", "proceed_with_changes") == "proceed_with_changes"
    assert clamp_decision_state("hold", "proceed") == "proceed"
    assert clamp_decision_state("proceed_with_changes", "proceed") == "proceed"


def test_llm_may_go_one_rung_more_permissive():
    assert clamp_decision_state("proceed", "proceed_with_changes") == "proceed"
    assert clamp_decision_state("proceed_with_changes", "hold") == "proceed_with_changes"


def test_llm_may_not_jump_two_rungs_past_the_ladder():
    assert clamp_decision_state("proceed", "drop") == "hold"
    assert clamp_decision_state("proceed", "hold") == "proceed_with_changes"


def test_an_unrecognised_state_falls_back_to_the_derived_one():
    assert clamp_decision_state("", "hold") == "hold"
    assert clamp_decision_state("maybe", "drop") == "drop"


def test_agreement_with_the_ladder_is_preserved():
    for state in ("drop", "hold", "proceed_with_changes", "proceed"):
        assert clamp_decision_state(state, state) == state


def test_case_verdict_prompt_permits_proceed_and_names_the_floor():
    prompt = CASE_VERDICT_SYSTEM_PROMPT
    assert "'proceed' is a real outcome" in prompt
    assert "Do not go below it" in prompt


# --- Round 3: an unresolved that names nothing is a hedge -----------------
#
# 40.4% of Round 2 claims landed `unresolved`, and every load-bearing one forced the
# case to `hold`. `unresolved` now means one nameable input is missing; a verdict that
# reaches it without naming that input is re-graded on the evidence the panel produced.


def test_unresolved_without_a_missing_input_and_a_sourced_contradiction_is_weakened():
    findings = [
        _finding(
            "c1",
            "receipts",
            0.8,
            evidence=[_evidence()],
            contradiction="49 CFR 395.3 caps driving at 11 hours.",
        )
    ]
    status, reasoning = apply_evidence_gate(ClaimStatus.UNRESOLVED, "Unclear.", findings)
    assert status is ClaimStatus.WEAKENED
    assert "Re-graded from unresolved to weakened" in reasoning


def test_unresolved_without_a_missing_input_on_a_trivial_panel_survives():
    findings = [_finding("c1", "devils_advocate", 0.1), _finding("c1", "operator", 0.15)]
    status, reasoning = apply_evidence_gate(ClaimStatus.UNRESOLVED, "Unclear.", findings)
    assert status is ClaimStatus.SURVIVED
    assert "Re-graded from unresolved to survived" in reasoning


def test_unresolved_without_a_missing_input_on_a_substantive_panel_is_weakened():
    findings = [_finding("c1", "builder", 0.6)]
    status, _ = apply_evidence_gate(ClaimStatus.UNRESOLVED, "Unclear.", findings)
    assert status is ClaimStatus.WEAKENED


def test_unresolved_that_names_its_missing_input_is_left_alone():
    findings = [_finding("c1", "builder", 0.6)]
    status, reasoning = apply_evidence_gate(
        ClaimStatus.UNRESOLVED, "Unclear.", findings, "Your actual monthly churn rate."
    )
    assert status is ClaimStatus.UNRESOLVED
    assert reasoning == "Unclear."


def test_unresolved_with_no_findings_at_all_is_left_alone():
    """core/loop.py assigns this directly when no evaluator produced a finding —
    nothing was measured, so there is nothing to re-grade it against."""
    status, reasoning = apply_evidence_gate(ClaimStatus.UNRESOLVED, "No findings.", [])
    assert status is ClaimStatus.UNRESOLVED
    assert reasoning == "No findings."


def test_unresolved_from_an_evaluator_error_stays_unresolved():
    findings = [_finding("c1", "builder", 0.6), _finding("c1", "operator", None)]
    status, reasoning = apply_evidence_gate(ClaimStatus.UNRESOLVED, "Panel failed.", findings)
    assert status is ClaimStatus.UNRESOLVED
    assert "evaluator execution failure" in reasoning
