"""
Unit tests for the two case-verdict presentation fields: the generated headline
and the derived deciding factor.

Kept out of test_synthesis.py deliberately — that file covers the synthesis
mechanics (consequences, decision-state fallback), this one covers what the
verdict page reads.
"""
import pytest

from core.models import (
    Case,
    CaseVerdict,
    Claim,
    ClaimStatus,
    DecisionConsequence,
    EvidenceItem,
    Finding,
)
from core.synthesis import (
    FALLBACK_HEADLINES,
    CaseVerdictOutput,
    NextActionOutput,
    StrategicConsequenceOutput,
    build_deciding_factor,
    sanitize_headline,
    synthesize_case_verdict,
)


class StubProvider:
    """Returns a verdict with no headline — the pre-change shape."""

    headline = ""
    decision_state = "proceed_with_changes"

    async def generate(self, system_prompt, messages, response_schema=None):
        if getattr(response_schema, "__name__", "") == "CaseVerdictOutput":
            return CaseVerdictOutput(
                decision_state=self.decision_state,
                headline=self.headline,
                summary="The core claim survived with minor operational caveats.",
                next_actions=[NextActionOutput(action="Ship the pilot.", claim_ids=[])],
            )
        return StrategicConsequenceOutput(
            impact="medium",
            recommended_change="Adjust the quota threshold before launch.",
            next_validation="Run a 48-hour load test.",
        )


# --- headline sanitisation ---------------------------------------------------


def test_keeps_a_single_specific_sentence():
    text = "The yield gap is real and the risk isn't."
    assert sanitize_headline(text, "proceed") == text


def test_keeps_only_the_first_sentence_of_two():
    assert (
        sanitize_headline("The federal cap is 11 hours. The shift is 14.", "drop")
        == "The federal cap is 11 hours."
    )


def test_strips_surrounding_quotes():
    assert (
        sanitize_headline('"Holds up on the numbers given."', "proceed")
        == "Holds up on the numbers given."
    )


def test_collapses_whitespace():
    assert sanitize_headline("  Costs   double   at scale.  ", "hold") == (
        "Costs double at scale."
    )


@pytest.mark.parametrize(
    "raw,why",
    [
        ("", "empty"),
        ("   ", "whitespace only"),
        ("Consider the regulatory exposure first.", "hedging opener"),
        ("Overall this looks workable.", "summarising opener"),
        ("The proposal survives with changes.", "category label"),
        ("This decision cannot be settled yet.", "category label"),
        ("Verdict: hold.", "label prefix"),
        ("Short", "under the floor"),
        (
            "one two three four five six seven eight nine ten words.",
            "over 9 words / big line",
        ),
        (
            "The eleven hour federal driving cap directly contradicts the fourteen "
            "hour shift this plan is built on, so it cannot run as written.",
            "over the 70-char cap",
        ),
    ],
)
def test_falls_back_on_junk(raw, why):
    """Every rejection returns the static line rather than a repaired string —
    a headline truncated mid-clause reads as a bug."""
    assert sanitize_headline(raw, "hold") == FALLBACK_HEADLINES["hold"], why


def test_accepts_concise_three_to_six_word_headlines():
    assert sanitize_headline("Requires human legal review.", "drop") == "Requires human legal review."
    assert sanitize_headline("Severe compliance bottleneck.", "hold") == "Severe compliance bottleneck."
    assert sanitize_headline("Holds up cleanly as planned.", "proceed") == "Holds up cleanly as planned."


def test_rejects_ten_word_big_line_headline():
    big_line = "This is a ten word headline that is quite big."
    assert sanitize_headline(big_line, "drop") == FALLBACK_HEADLINES["drop"]


def test_fallback_is_empty_for_an_unknown_state():
    assert sanitize_headline("", "not_a_state") == ""


def test_cap_boundary_is_inclusive():
    exactly_70 = "A" * 69 + "."
    assert len(exactly_70) == 70
    assert sanitize_headline(exactly_70, "hold") == exactly_70
    assert sanitize_headline("A" * 70 + ".", "hold") == FALLBACK_HEADLINES["hold"]


# --- headline through the synthesis call -------------------------------------


@pytest.mark.asyncio
async def test_generated_headline_wins():
    provider = StubProvider()
    provider.headline = "The federal cap is 11 hours."
    provider.decision_state = "drop"
    c1 = Claim(id="c1", statement="14-hour shifts", status=ClaimStatus.BROKEN, load_bearing=True)
    case = Case(id="c", raw_input="14-hour driver shifts", claims=[c1])

    verdict = await synthesize_case_verdict(case, provider)
    assert verdict.headline == "The federal cap is 11 hours."


@pytest.mark.asyncio
async def test_static_line_fills_in_when_the_model_omits_it():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.WEAKENED, load_bearing=True)
    case = Case(id="c", raw_input="Test proposal", claims=[c1])

    verdict = await synthesize_case_verdict(case, StubProvider())
    assert verdict.headline == FALLBACK_HEADLINES["proceed_with_changes"]


@pytest.mark.asyncio
async def test_static_line_fills_in_when_synthesis_raises():
    class BrokenProvider:
        async def generate(self, *args, **kwargs):
            raise RuntimeError("provider down")

    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.BROKEN, load_bearing=True)
    case = Case(id="c", raw_input="Test proposal", claims=[c1])

    verdict = await synthesize_case_verdict(case, BrokenProvider())
    assert verdict.headline == FALLBACK_HEADLINES["drop"]


def test_case_verdict_headline_defaults_empty():
    assert CaseVerdict(decision_state="hold", summary="x").headline == ""


# --- deciding factor ---------------------------------------------------------


def _finding(claim_id, evaluator, confidence, contradiction=None, evidence=()):
    return Finding(
        claim_id=claim_id,
        test_id="t1",
        evaluator=evaluator,
        result=f"{evaluator} result line",
        evidence=list(evidence),
        reasoning="because",
        confidence=confidence,
        contradiction=contradiction,
    )


def _evidence(url="https://fmcsa.dot.gov/395", title="FMCSA 395.3"):
    return EvidenceItem(
        source_url=url, title=title, snippet="11 hours", retrieved_at="2026-01-01"
    )


def test_none_when_nothing_failed():
    c1 = Claim(id="c1", statement="ok", status=ClaimStatus.SURVIVED, load_bearing=True)
    case = Case(id="c", raw_input="x", claims=[c1], findings=[_finding("c1", "builder", 0.1)])
    assert build_deciding_factor(case) is None


def test_none_when_the_failed_claim_has_no_findings():
    c1 = Claim(id="c1", statement="x", status=ClaimStatus.WEAKENED, load_bearing=True)
    case = Case(id="c", raw_input="x", claims=[c1], findings=[])
    assert build_deciding_factor(case) is None


def test_prefers_the_evidenced_contradiction_over_the_louder_one():
    """rank_findings puts evidence+contradiction on top, so a sourced Researcher
    finding beats a higher-scoring but unsourced Devil's Advocate one. This is the
    case the old UI got wrong by reading findings in arrival order."""
    c1 = Claim(id="c1", statement="14h shifts", status=ClaimStatus.BROKEN, load_bearing=True)
    case = Case(
        id="c",
        raw_input="x",
        claims=[c1],
        findings=[
            _finding("c1", "devils_advocate", 0.95, contradiction="Drivers will quit"),
            _finding(
                "c1",
                "researcher",
                0.8,
                contradiction="FMCSA caps driving at 11 hours",
                evidence=[_evidence()],
            ),
        ],
    )

    factor = build_deciding_factor(case)
    assert factor.evaluator == "researcher"
    assert factor.the_fact == "FMCSA caps driving at 11 hours"
    assert factor.source_url == "https://fmcsa.dot.gov/395"
    assert factor.source_title == "FMCSA 395.3"


def test_load_bearing_failure_outranks_a_worse_secondary_one():
    secondary = Claim(id="c1", statement="s", status=ClaimStatus.BROKEN, load_bearing=False)
    critical = Claim(id="c2", statement="c", status=ClaimStatus.WEAKENED, load_bearing=True)
    case = Case(
        id="c",
        raw_input="x",
        claims=[secondary, critical],
        findings=[_finding("c1", "builder", 0.9), _finding("c2", "operator", 0.4)],
    )
    assert build_deciding_factor(case).claim_id == "c2"


def test_worst_status_wins_among_load_bearing_failures():
    weak = Claim(id="c1", statement="w", status=ClaimStatus.WEAKENED, load_bearing=True)
    broken = Claim(id="c2", statement="b", status=ClaimStatus.BROKEN, load_bearing=True)
    case = Case(
        id="c",
        raw_input="x",
        claims=[weak, broken],
        findings=[_finding("c1", "builder", 0.5), _finding("c2", "operator", 0.5)],
    )
    assert build_deciding_factor(case).claim_id == "c2"


def test_falls_back_to_the_result_line_without_a_contradiction():
    c1 = Claim(id="c1", statement="x", status=ClaimStatus.UNRESOLVED, load_bearing=True)
    case = Case(id="c", raw_input="x", claims=[c1], findings=[_finding("c1", "operator", 0.3)])
    assert build_deciding_factor(case).the_fact == "operator result line"


def test_reports_the_evidence_gate_downgrade():
    """gate_fired is how the page shows where the system refused to condemn on thin
    evidence. It reads the note apply_evidence_gate leaves in verdict_reasoning."""
    c1 = Claim(id="c1", statement="x", status=ClaimStatus.WEAKENED, load_bearing=True)
    case = Case(
        id="c",
        raw_input="x",
        claims=[c1],
        findings=[_finding("c1", "devils_advocate", 0.9, contradiction="fatal")],
        consequences=[
            DecisionConsequence(
                claim_id="c1",
                impact="high",
                recommended_change="rework",
                verdict_reasoning=(
                    "It fails. Downgraded from broken to weakened: no finding carried a "
                    "contradiction traceable to a source, and absence of evidence is not "
                    "refutation."
                ),
            )
        ],
    )
    assert build_deciding_factor(case).gate_fired is True


def test_gate_not_reported_when_it_did_not_fire():
    c1 = Claim(id="c1", statement="x", status=ClaimStatus.WEAKENED, load_bearing=True)
    case = Case(
        id="c",
        raw_input="x",
        claims=[c1],
        findings=[_finding("c1", "researcher", 0.6, contradiction="cited", evidence=[_evidence()])],
        consequences=[
            DecisionConsequence(
                claim_id="c1", impact="high", recommended_change="rework",
                verdict_reasoning="A source directly contradicts the projected cost.",
            )
        ],
    )
    assert build_deciding_factor(case).gate_fired is False


@pytest.mark.asyncio
async def test_synthesis_attaches_the_deciding_factor():
    c1 = Claim(id="c1", statement="x", status=ClaimStatus.WEAKENED, load_bearing=True)
    case = Case(
        id="c",
        raw_input="x",
        claims=[c1],
        findings=[_finding("c1", "researcher", 0.6, contradiction="cited", evidence=[_evidence()])],
    )

    verdict = await synthesize_case_verdict(case, StubProvider())
    assert verdict.deciding_factor is not None
    assert verdict.deciding_factor.the_fact == "cited"


@pytest.mark.asyncio
async def test_synthesis_fallback_summary_contains_scope_outcome_and_errors():
    class DeadProvider:
        async def generate(self, *args, **kwargs):
            raise RuntimeError("LLM unavailable")

    c1 = Claim(
        id="c1",
        statement="100% autonomous support containment",
        status=ClaimStatus.BROKEN,
        load_bearing=True,
        fatal_flaw="Human escalation required for billing and security",
    )
    c2 = Claim(
        id="c2",
        statement="Infrastructure costs beat human salaries",
        status=ClaimStatus.SURVIVED,
        load_bearing=True,
    )
    case = Case(
        id="case-test",
        raw_input="Replace support team with AI agent",
        claims=[c1, c2],
    )

    verdict = await synthesize_case_verdict(case, DeadProvider())
    assert "After evaluation, we found that" in verdict.summary
    assert "1 assumption held up" in verdict.summary
    assert "1 refuted" in verdict.summary
    assert "Key errors identified:" in verdict.summary
    assert "Human escalation required for billing and security" in verdict.summary
    assert "Replace support team" not in verdict.summary  # does not rewrite the question


@pytest.mark.asyncio
async def test_synthesis_fallback_summary_all_survived():
    class DeadProvider:
        async def generate(self, *args, **kwargs):
            raise RuntimeError("LLM unavailable")

    c1 = Claim(id="c1", statement="Valid claim", status=ClaimStatus.SURVIVED, load_bearing=True)
    case = Case(id="case-ok", raw_input="Sound proposal", claims=[c1])

    verdict = await synthesize_case_verdict(case, DeadProvider())
    assert "After evaluation, all 1 core assumption held up with verified outside evidence" in verdict.summary
    assert "No critical errors were identified" in verdict.summary
    assert "Sound proposal" not in verdict.summary


# --- An unsourced specific must not be the line the reader takes away ---


def test_deciding_factor_skips_a_finding_with_unsourced_specifics():
    from core.grounding import mark_unsourced

    c1 = Claim(id="c1", statement="14h shifts", status=ClaimStatus.BROKEN, load_bearing=True)
    invented = mark_unsourced(
        _finding("c1", "devils_advocate", 0.95, contradiction="Akamai edge protection blocks it")
    )
    grounded = _finding(
        "c1",
        "researcher",
        0.3,
        contradiction="11 hours is the cap",
        evidence=[_evidence(title="11 hours")],
    )
    case = Case(id="c", raw_input="x", claims=[c1], findings=[invented, grounded])

    factor = build_deciding_factor(case)
    assert factor.evaluator == "researcher"
    assert "[unverified]" not in factor.the_fact


def test_deciding_factor_still_ships_when_nothing_is_grounded():
    """A thin factor beats a silent omission."""
    from core.grounding import mark_unsourced

    c1 = Claim(id="c1", statement="14h shifts", status=ClaimStatus.BROKEN, load_bearing=True)
    invented = mark_unsourced(
        _finding("c1", "devils_advocate", 0.95, contradiction="Akamai edge protection blocks it")
    )
    case = Case(id="c", raw_input="x", claims=[c1], findings=[invented])

    factor = build_deciding_factor(case)
    assert factor is not None
    assert factor.evaluator == "devils_advocate"


# --- `drop` requires that nothing load-bearing came through ---

from core.reconcile import resolve_decision_state  # noqa: E402


def _rds_claim(cid, status, load_bearing, salvage=None):
    return Claim(
        id=cid,
        statement="s",
        status=status,
        load_bearing=load_bearing,
        salvaged_claim=salvage,
    )


def test_drop_requires_every_load_bearing_claim_broken():
    claims = [
        _rds_claim("c1", ClaimStatus.BROKEN, True),
        _rds_claim("c2", ClaimStatus.WEAKENED, True, salvage="Hand the CAPTCHA to the human."),
    ]
    assert resolve_decision_state(claims) == "proceed_with_changes"


def test_all_load_bearing_broken_still_drops():
    claims = [
        _rds_claim("c1", ClaimStatus.BROKEN, True),
        _rds_claim("c2", ClaimStatus.BROKEN, True),
        _rds_claim("c3", ClaimStatus.WEAKENED, False),
    ]
    assert resolve_decision_state(claims) == "drop"


def test_weakened_without_salvage_does_not_force_pivot():
    claims = [
        _rds_claim("c1", ClaimStatus.BROKEN, True),
        _rds_claim("c2", ClaimStatus.WEAKENED, True),
    ]
    assert resolve_decision_state(claims) in ("drop", "hold")


def test_all_survived_proceeds():
    claims = [
        _rds_claim("c1", ClaimStatus.SURVIVED, True),
        _rds_claim("c2", ClaimStatus.SURVIVED, True),
    ]
    assert resolve_decision_state(claims) == "proceed"


def test_unresolved_load_bearing_holds():
    claims = [
        _rds_claim("c1", ClaimStatus.UNRESOLVED, True),
        _rds_claim("c2", ClaimStatus.SURVIVED, True),
    ]
    assert resolve_decision_state(claims) == "hold"


def test_no_claims_holds():
    assert resolve_decision_state([]) == "hold"


def test_derived_state_pivots_instead_of_dropping_when_a_salvage_stands():
    """The regression this fixes: 'drop it completely' over two salvageable claims."""
    from core.synthesis import _derive_decision_state

    case = Case(
        id="c",
        raw_input="x",
        claims=[
            Claim(
                id="c1",
                statement="Solves the CAPTCHA automatically",
                status=ClaimStatus.BROKEN,
                load_bearing=True,
                salvaged_claim="Hand the CAPTCHA to the human.",
                salvage_scope="redesign",
            ),
            Claim(
                id="c2",
                statement="Fires at the exact second",
                status=ClaimStatus.WEAKENED,
                load_bearing=True,
                salvaged_claim="Prepare the booking, let the human submit.",
            ),
        ],
    )
    assert _derive_decision_state(case)[0] == "proceed_with_changes"
