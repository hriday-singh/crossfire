"""
Unit tests for core.synthesis (modularized synthesis layer).
"""
import pytest
from uuid import uuid4
from core.models import Case, Claim, ClaimStatus, DecisionConsequence, WeakenedKind
from core.synthesis import (
    build_consequences,
    clamp_decision_state,
    _derive_decision_state,
    _fallback_decision_state,
    synthesize_case_verdict,
    synthesize_consequences,
    CaseVerdictOutput,
    NextActionOutput,
    StrategicConsequenceOutput,
)
from providers.base import LLMProvider


class MockProvider:
    async def generate(self, system_prompt, messages, response_schema=None):
        schema_name = getattr(response_schema, "__name__", "")
        if schema_name == "CaseVerdictOutput":
            return CaseVerdictOutput(
                decision_state="proceed_with_changes",
                summary="The core claim survived with minor operational caveats.",
                next_actions=[NextActionOutput(action="Test the integration API next week.", claim_ids=[])]
            )
        return StrategicConsequenceOutput(
            impact="medium",
            recommended_change="Adjust the quota threshold before launch.",
            next_validation="Run a 48-hour load test."
        )


def test_build_consequences_maps_salvaged_claim_and_tradeoffs():
    cid = str(uuid4())
    claim = Claim(
        id=cid,
        statement="We can support 100k concurrent users on a $20 server.",
        status=ClaimStatus.BROKEN,
        load_bearing=True,
        fatal_flaw="Memory limit reached at 500 connections.",
        salvaged_claim="Support 1k concurrent users per node with horizontal autoscaling.",
        tradeoff_acknowledged="Increases monthly hosting budget by $150."
    )
    case = Case(
        id=str(uuid4()),
        raw_input="Deploy ultra-cheap hosting",
        claims=[claim],
        status="testing"
    )
    consequences = build_consequences(case)
    assert len(consequences) == 1
    c = consequences[0]
    assert c.impact == "high"
    assert "Salvaged claim:" in c.recommended_change
    assert "Trade-off:" in c.recommended_change
    assert c.salvaged_claim == claim.salvaged_claim
    assert c.tradeoff_acknowledged == claim.tradeoff_acknowledged
    assert c.next_validation == f"Directly test: {claim.statement}"


def test_fallback_decision_state_broken_load_bearing():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.BROKEN, load_bearing=True)
    c2 = Claim(id="c2", statement="Claim 2", status=ClaimStatus.SURVIVED, load_bearing=False)
    case = Case(id="c", raw_input="Test", claims=[c1, c2])
    assert _fallback_decision_state(case) == "drop"


def test_fallback_decision_state_unresolved_load_bearing():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.UNRESOLVED, load_bearing=True)
    case = Case(id="c", raw_input="Test", claims=[c1])
    assert _fallback_decision_state(case) == "hold"


def test_fallback_decision_state_weakened():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.WEAKENED, load_bearing=True)
    case = Case(id="c", raw_input="Test", claims=[c1])
    assert _fallback_decision_state(case) == "proceed_with_changes"


def test_fallback_decision_state_all_survived():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.SURVIVED, load_bearing=True)
    case = Case(id="c", raw_input="Test", claims=[c1])
    assert _fallback_decision_state(case) == "proceed"


@pytest.mark.asyncio
async def test_synthesize_case_verdict_llm():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.SURVIVED, load_bearing=True)
    case = Case(id="c", raw_input="Test proposal", claims=[c1], consequences=[])
    provider = MockProvider()
    verdict = await synthesize_case_verdict(case, provider)
    # The mock returns "proceed_with_changes", but the only load-bearing claim
    # survived, so the derived ladder floor is "proceed" and `clamp_decision_state`
    # refuses the downgrade. A checked decision that held up has to be able to say
    # so — `proceed` was returned 0/15 times in the 2026-09-07 corpus.
    assert verdict.decision_state == "proceed"
    assert "survived with minor" in verdict.summary
    assert len(verdict.next_actions) == 1


def test_build_consequences_preserves_all_steelman_fields():
    from core.models import Case, Claim, ClaimStatus
    from core.synthesis import build_consequences
    claim = Claim(
        id="c1",
        statement="High load system",
        status=ClaimStatus.BROKEN,
        load_bearing=True,
        fatal_flaw="Single point of failure in DB",
        salvaged_claim="Use read replicas",
        tradeoff_acknowledged="Adds replication lag",
    )
    case = Case(id="case-1", raw_input="Deploy system", claims=[claim])
    consequences = build_consequences(case)
    assert len(consequences) == 1
    c = consequences[0]
    assert c.fatal_flaw == "Single point of failure in DB"
    assert c.salvaged_claim == "Use read replicas"
    assert c.tradeoff_acknowledged == "Adds replication lag"
    assert "Salvaged claim: Use read replicas" in c.recommended_change



# --- Round 3: both ends of the ladder are reachable -----------------------
#
# Round 2 returned proceed 0/15 and drop 0/15. `any(unresolved) -> hold` treated one
# unresolved claim among survived ones as more restrictive than a claim that actively
# failed (a1-notion-migration), and `all(salvaged)` was always true because Break to
# Rebuild mandates a salvage, which made the drop branch dead code (b1-phi-google-drive).


def _ladder_case(claims):
    return Case(id="ladder", raw_input="A decision", claims=claims)


def test_a_minority_unresolved_claim_beside_a_survivor_does_not_hold_the_case():
    """a1-notion-migration: survived + unresolved was forced to `hold`."""
    case = _ladder_case(
        [
            Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.SURVIVED),
            Claim(id="c2", statement="B", load_bearing=True, status=ClaimStatus.SURVIVED),
            Claim(
                id="c3",
                statement="C",
                load_bearing=True,
                status=ClaimStatus.UNRESOLVED,
                missing_input="Last quarter's seat count.",
            ),
        ]
    )
    state, reason = _derive_decision_state(case)
    assert state == "proceed"
    assert reason == "clean"


def test_majority_unresolved_still_holds_the_case():
    """Band C (c1/c3): most of what the decision rests on is unmeasured."""
    case = _ladder_case(
        [
            Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.UNRESOLVED),
            Claim(id="c2", statement="B", load_bearing=True, status=ClaimStatus.UNRESOLVED),
            Claim(id="c3", statement="C", load_bearing=True, status=ClaimStatus.SURVIVED),
        ]
    )
    assert _derive_decision_state(case) == ("hold", "unresolved")


def test_unresolved_with_nothing_surviving_holds_the_case():
    case = _ladder_case(
        [
            Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.UNRESOLVED),
            Claim(id="c2", statement="B", load_bearing=True, status=ClaimStatus.WEAKENED),
        ]
    )
    assert _derive_decision_state(case) == ("hold", "unresolved")


def test_a_parameter_salvage_keeps_the_decision_on_the_table():
    """a2-treasury-mmf: hold a 0.5-1 month buffer instead of 3 months."""
    case = _ladder_case(
        [
            Claim(
                id="c1",
                statement="Hold a 3-month cash buffer",
                load_bearing=True,
                status=ClaimStatus.BROKEN,
                salvaged_claim="Hold a 0.5-1 month buffer and sweep the rest.",
                salvage_scope="parameter",
            )
        ]
    )
    assert _derive_decision_state(case) == ("proceed_with_changes", "broken")


def test_a_redesign_salvage_drops_the_decision():
    """b1-phi-google-drive: Workspace under a BAA is not consumer Drive with a tweak."""
    case = _ladder_case(
        [
            Claim(
                id="c1",
                statement="Store PHI in consumer Google Drive",
                load_bearing=True,
                status=ClaimStatus.BROKEN,
                salvaged_claim="Move to Google Workspace under a signed BAA.",
                salvage_scope="redesign",
            )
        ]
    )
    assert _derive_decision_state(case) == ("drop", "broken")


def test_mixed_salvage_scopes_take_the_harsher_outcome():
    case = _ladder_case(
        [
            Claim(
                id="c1",
                statement="A",
                load_bearing=True,
                status=ClaimStatus.BROKEN,
                salvaged_claim="Lower the threshold.",
                salvage_scope="parameter",
            ),
            Claim(
                id="c2",
                statement="B",
                load_bearing=True,
                status=ClaimStatus.BROKEN,
                salvaged_claim="Use a different vendor entirely.",
                salvage_scope="redesign",
            ),
        ]
    )
    assert _derive_decision_state(case) == ("drop", "broken")


def test_an_unlabelled_salvage_reads_as_a_parameter_change():
    """A judge that skipped the field is not a refutation of the whole decision."""
    case = _ladder_case(
        [
            Claim(
                id="c1",
                statement="A",
                load_bearing=True,
                status=ClaimStatus.BROKEN,
                salvaged_claim="Scope it down to one team.",
                salvage_scope=None,
            )
        ]
    )
    assert _derive_decision_state(case) == ("proceed_with_changes", "broken")


def test_a_broken_claim_with_no_salvage_at_all_still_drops():
    case = _ladder_case(
        [Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.BROKEN)]
    )
    assert _derive_decision_state(case) == ("drop", "broken")


# --- Round 3: the clamp's asymmetry is the Band B guard -------------------


def test_clamp_allows_two_rungs_above_an_unresolved_floor():
    assert clamp_decision_state("proceed", "hold", "unresolved") == "proceed"


def test_clamp_allows_only_one_rung_above_a_broken_floor():
    assert clamp_decision_state("proceed", "drop", "broken") == "hold"
    assert clamp_decision_state("proceed", "proceed_with_changes", "broken") == "proceed"


def test_clamp_never_moves_downward_whatever_set_the_floor():
    for reason in ("broken", "unresolved", "weakened", "clean"):
        assert clamp_decision_state("drop", "proceed_with_changes", reason) == "proceed_with_changes"
        assert clamp_decision_state("hold", "proceed", reason) == "proceed"


def test_derive_decision_state_qualified_only():
    case = _ladder_case(
        [
            Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.WEAKENED, weakened_kind=WeakenedKind.QUALIFIED)
        ]
    )
    assert _derive_decision_state(case) == ("proceed", "clean")


def test_derive_decision_state_contested():
    case = _ladder_case(
        [
            Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.WEAKENED, weakened_kind=WeakenedKind.CONTESTED)
        ]
    )
    assert _derive_decision_state(case) == ("proceed_with_changes", "weakened")


# --- Build spec and surviving core (2026-09-08) ---

from core.synthesis import BuildSpecOutput, build_spec_material  # noqa: E402


def test_material_carries_surviving_mechanisms_and_fatal_flaws():
    case = Case(
        id="case1",
        raw_input="A bot that races the quota opening, solves the CAPTCHA, and guarantees a seat",
        claims=[
            Claim(
                id="c1",
                statement="Fires at the exact second the quota opens",
                status=ClaimStatus.SURVIVED,
                load_bearing=True,
                mechanism_of="booking-bot",
            ),
            Claim(
                id="c2",
                statement="Solves the CAPTCHA automatically",
                status=ClaimStatus.BROKEN,
                load_bearing=True,
                mechanism_of="booking-bot",
                fatal_flaw="Defeats an anti-bot control the operator explicitly prohibits.",
            ),
        ],
    )
    material = build_spec_material(case)
    assert "Fires at the exact second" in str(material["surviving"])
    assert "Defeats an anti-bot control" in str(material["fatal_flaws"])
    assert "Solves the CAPTCHA" in str(material["omitted"])


def test_material_is_empty_when_nothing_survived():
    case = Case(
        id="case2",
        raw_input="x",
        claims=[Claim(id="c1", statement="s", status=ClaimStatus.BROKEN, load_bearing=True)],
    )
    assert build_spec_material(case)["surviving"] == []


def test_material_excludes_unresolved_claims_from_surviving():
    case = Case(
        id="case3",
        raw_input="x",
        claims=[Claim(id="c1", statement="unknown", status=ClaimStatus.UNRESOLVED, load_bearing=True)],
    )
    assert build_spec_material(case)["surviving"] == []


class _SpecProvider:
    """Returns a build spec and an empty surviving core, to exercise both guards."""

    def __init__(self, build_spec=None, surviving_core=""):
        self._build_spec = build_spec
        self._surviving_core = surviving_core

    async def generate(self, system_prompt, messages, response_schema=None):
        if getattr(response_schema, "__name__", "") == "CaseVerdictOutput":
            return CaseVerdictOutput(
                decision_state="proceed_with_changes",
                summary="s",
                next_actions=[],
                surviving_core=self._surviving_core,
                build_spec=self._build_spec,
            )
        return StrategicConsequenceOutput(
            impact="medium", recommended_change="x", next_validation="y"
        )


_SPEC = BuildSpecOutput(
    what_it_does="Prepares the booking up to the CAPTCHA.",
    what_it_omits="Automated CAPTCHA solving, because it defeats an anti-bot control.",
    demo_path="Run against a mock booking environment with a countdown.",
    cheapest_experiment="Time a prepared human against the agent on a non-peak window.",
)


@pytest.mark.asyncio
async def test_surviving_core_falls_back_when_the_model_returns_it_empty():
    case = Case(
        id="c",
        raw_input="x",
        claims=[
            Claim(
                id="c1",
                statement="Fires at the exact second the quota opens",
                status=ClaimStatus.SURVIVED,
                load_bearing=True,
                confidence=0.95,
            ),
            Claim(
                id="c2",
                statement="Solves the CAPTCHA automatically",
                status=ClaimStatus.WEAKENED,
                load_bearing=True,
                confidence=0.5,
                salvaged_claim="Hand the CAPTCHA to the human.",
            ),
        ],
    )
    verdict = await synthesize_case_verdict(case, _SpecProvider(build_spec=_SPEC))
    assert verdict.decision_state != "drop"
    assert verdict.surviving_core == "Fires at the exact second the quota opens"


@pytest.mark.asyncio
async def test_build_spec_lands_when_something_survived():
    case = Case(
        id="c",
        raw_input="x",
        claims=[
            Claim(id="c1", statement="Fires at the exact second", status=ClaimStatus.SURVIVED, load_bearing=True),
            Claim(
                id="c2",
                statement="Solves the CAPTCHA automatically",
                status=ClaimStatus.BROKEN,
                load_bearing=False,
                fatal_flaw="Defeats an anti-bot control.",
            ),
        ],
    )
    verdict = await synthesize_case_verdict(case, _SpecProvider(build_spec=_SPEC))
    assert verdict.build_spec is not None
    assert verdict.build_spec.what_it_omits.startswith("Automated CAPTCHA")


@pytest.mark.asyncio
async def test_build_spec_is_none_when_nothing_survived():
    """The tool must be able to say 'nothing here' instead of manufacturing a pivot."""
    case = Case(
        id="c",
        raw_input="x",
        claims=[Claim(id="c1", statement="s", status=ClaimStatus.BROKEN, load_bearing=True)],
    )
    verdict = await synthesize_case_verdict(case, _SpecProvider(build_spec=_SPEC))
    assert verdict.build_spec is None
    # Nothing stood, so the fallback has nothing to name either.
    assert verdict.surviving_core == ""
