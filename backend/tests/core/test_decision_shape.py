"""
Kill criteria, one-way-door hold lock, dissent, and reversibility/deadline
plumbing (docs/IMPROVEMENTS.md items 3, 4, 6).
"""
import pytest
from fastapi.testclient import TestClient

from core.agent_panel import ExtractedClaims
from core.loop import extract_claims
from core.models import (
    Case,
    Claim,
    ClaimStatus,
    EvidenceItem,
    Finding,
    normalize_reversibility,
)
from core.synthesis import (
    StrategicConsequenceOutput,
    _derive_decision_state,
    build_consequences,
    build_dissents,
    clamp_decision_state,
    synthesize_consequences,
)


def _case(claims, findings=None, reversibility=None):
    return Case(id="c", raw_input="Decide.", claims=claims, findings=findings or [], reversibility=reversibility)


def _finding(claim_id, evaluator, confidence, evidence=None, contradiction=None):
    return Finding(
        claim_id=claim_id,
        test_id="t",
        evaluator=evaluator,
        result=f"{evaluator} result",
        reasoning="r",
        confidence=confidence,
        evidence=evidence or [],
        contradiction=contradiction,
    )


def _minority_unresolved():
    # One unresolved beside two survived: the two-way ladder does not hold this.
    return [
        Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.UNRESOLVED),
        Claim(id="c2", statement="B", load_bearing=True, status=ClaimStatus.SURVIVED),
        Claim(id="c3", statement="C", load_bearing=True, status=ClaimStatus.SURVIVED),
    ]


# --- reversibility ---------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [("one_way", "one_way"), ("Two-Way", "two_way"), ("one way", "one_way"), ("maybe", None), (None, None)],
)
def test_normalize_reversibility(raw, expected):
    assert normalize_reversibility(raw) == expected


def test_one_way_door_with_unresolved_load_bearing_claim_holds():
    case = _case(_minority_unresolved(), reversibility="one_way")
    assert _derive_decision_state(case) == ("hold", "irreversible")


@pytest.mark.parametrize("door", ["two_way", None])
def test_reversible_or_unknown_door_keeps_the_existing_ladder(door):
    case = _case(_minority_unresolved(), reversibility=door)
    assert _derive_decision_state(case) == ("proceed", "clean")


def test_one_way_door_without_unresolved_claims_is_untouched():
    claims = [Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.SURVIVED)]
    assert _derive_decision_state(_case(claims, reversibility="one_way")) == ("proceed", "clean")


def test_one_way_door_does_not_override_a_broken_claim():
    claims = [
        Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.BROKEN),
        Claim(id="c2", statement="B", load_bearing=True, status=ClaimStatus.UNRESOLVED),
    ]
    assert _derive_decision_state(_case(claims, reversibility="one_way"))[1] == "broken"


@pytest.mark.parametrize("llm_state", ["proceed", "proceed_with_changes", "hold", "drop"])
def test_irreversible_floor_cannot_be_lifted(llm_state):
    assert clamp_decision_state(llm_state, "hold", "irreversible") == "hold"


class _ExtractProvider:
    def __init__(self, **extra):
        self.extra = extra

    async def generate(self, system_prompt, messages, response_schema=None):
        return ExtractedClaims(statements=["Rent is affordable", "Commute is short"], **self.extra)


async def test_extraction_maps_reversibility_and_deadline():
    case = await extract_claims("Sign a 2-year lease by Friday.", _ExtractProvider(reversibility="one_way", deadline=" Friday "))
    assert case.reversibility == "one_way"
    assert case.deadline == "Friday"


async def test_extraction_drops_unknown_reversibility_and_empty_deadline():
    case = await extract_claims("Sign a lease.", _ExtractProvider(reversibility="sideways", deadline=""))
    assert case.reversibility is None
    assert case.deadline is None


# --- confirm route -----------------------------------------------------------


@pytest.fixture
def client(monkeypatch):
    from main import app

    async def _noop(case_id):
        pass

    monkeypatch.setattr("api.routes.handle_confirm", _noop)
    return TestClient(app)


def _awaiting(**fields):
    import store

    case = Case(
        id="door-case",
        raw_input="x",
        status="awaiting_confirmation",
        claims=[Claim(id="c1", statement="A")],
        **fields,
    )
    store.set(case)
    return store


_CLAIMS = {"claims": [{"id": "c1", "statement": "A"}]}


def test_confirm_applies_user_reversibility_and_deadline(client):
    store = _awaiting(reversibility="two_way")
    res = client.post("/cases/door-case/confirm", json={**_CLAIMS, "reversibility": "one_way", "deadline": " March 1 "})
    assert res.status_code == 202
    updated = store.get("door-case")
    assert updated.reversibility == "one_way"
    assert updated.deadline == "March 1"


def test_confirm_explicit_null_clears_reversibility(client):
    store = _awaiting(reversibility="one_way", deadline="soon")
    client.post("/cases/door-case/confirm", json={**_CLAIMS, "reversibility": None, "deadline": ""})
    updated = store.get("door-case")
    assert updated.reversibility is None
    assert updated.deadline is None


def test_confirm_omitted_fields_keep_inferred_values(client):
    store = _awaiting(reversibility="one_way", deadline="soon")
    client.post("/cases/door-case/confirm", json=_CLAIMS)
    updated = store.get("door-case")
    assert updated.reversibility == "one_way"
    assert updated.deadline == "soon"


def test_confirm_rejects_unknown_reversibility(client):
    _awaiting()
    assert client.post("/cases/door-case/confirm", json={**_CLAIMS, "reversibility": "sideways"}).status_code == 422


# --- kill criteria ---------------------------------------------------------


@pytest.mark.parametrize("status", [ClaimStatus.WEAKENED, ClaimStatus.UNRESOLVED])
def test_load_bearing_weakened_or_unresolved_gets_a_fallback_kill_criterion(status):
    claim = Claim(id="c1", statement="Users will pay $10", load_bearing=True, status=status)
    [cons] = build_consequences(_case([claim]))
    assert cons.kill_criterion == "Stop if the check shows this does not hold: Users will pay $10"


@pytest.mark.parametrize(
    "claim",
    [
        Claim(id="c1", statement="A", load_bearing=False, status=ClaimStatus.UNRESOLVED),
        Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.SURVIVED),
        Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.BROKEN),
    ],
)
def test_no_kill_criterion_elsewhere(claim):
    [cons] = build_consequences(_case([claim]))
    assert cons.kill_criterion is None


class _ConsequenceProvider:
    def __init__(self, kill):
        self.kill = kill

    async def generate(self, system_prompt, messages, response_schema=None):
        return StrategicConsequenceOutput(
            impact="high", recommended_change="Change it.", next_validation="Ask 10 users.", kill_criterion=self.kill
        )


async def test_llm_kill_criterion_replaces_the_fallback():
    case = _case([Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.UNRESOLVED)])
    case.consequences = build_consequences(case)
    [cons] = await synthesize_consequences(case, _ConsequenceProvider("Stop if fewer than 3 of 10 agree to pay."))
    assert cons.kill_criterion == "Stop if fewer than 3 of 10 agree to pay."


async def test_llm_kill_criterion_is_ignored_where_none_belongs():
    case = _case([Claim(id="c1", statement="A", load_bearing=False, status=ClaimStatus.UNRESOLVED)])
    case.consequences = build_consequences(case)
    [cons] = await synthesize_consequences(case, _ConsequenceProvider("Stop if X."))
    assert cons.kill_criterion is None


async def test_blank_llm_kill_criterion_keeps_the_fallback():
    case = _case([Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.WEAKENED)])
    case.consequences = build_consequences(case)
    [cons] = await synthesize_consequences(case, _ConsequenceProvider("  "))
    assert cons.kill_criterion.startswith("Stop if the check shows")


# --- dissent -----------------------------------------------------------------


def _evidence():
    return EvidenceItem(source_url="https://example.gov/rule", title="Rule", snippet="s", retrieved_at="now")


def test_severe_finding_on_a_survived_claim_is_a_dissent():
    claims = [Claim(id="c1", statement="A", load_bearing=True, status=ClaimStatus.SURVIVED)]
    findings = [
        _finding("c1", "researcher", 0.8, evidence=[_evidence()], contradiction="The cap is 11 hours."),
        _finding("c1", "builder", 0.3),
    ]
    [d] = build_dissents(_case(claims, findings))
    assert (d.claim_id, d.evaluator, d.the_fact, d.objection) == ("c1", "researcher", "The cap is 11 hours.", 0.8)
    assert d.source_url == "https://example.gov/rule"
    assert d.source_title == "Rule"


def test_severe_finding_on_a_claim_that_did_not_survive_is_not_a_dissent():
    claims = [Claim(id="c1", statement="A", status=ClaimStatus.BROKEN)]
    assert build_dissents(_case(claims, [_finding("c1", "researcher", 0.95)])) == []


def test_below_threshold_is_not_a_dissent():
    claims = [Claim(id="c1", statement="A", status=ClaimStatus.SURVIVED)]
    assert build_dissents(_case(claims, [_finding("c1", "operator", 0.65)])) == []


def test_dissents_sorted_strongest_first_and_capped():
    claims = [Claim(id="c1", statement="A", status=ClaimStatus.SURVIVED)]
    findings = [_finding("c1", f"e{i}", conf) for i, conf in enumerate([0.7, 0.9, 0.75, 0.85])]
    dissents = build_dissents(_case(claims, findings))
    assert [d.objection for d in dissents] == [0.9, 0.85, 0.75]
    assert dissents[0].the_fact == "e1 result"
    assert dissents[0].source_url is None
