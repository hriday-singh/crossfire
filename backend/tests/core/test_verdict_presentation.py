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
                "receipts",
                0.8,
                contradiction="FMCSA caps driving at 11 hours",
                evidence=[_evidence()],
            ),
        ],
    )

    factor = build_deciding_factor(case)
    assert factor.evaluator == "receipts"
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
        findings=[_finding("c1", "receipts", 0.6, contradiction="cited", evidence=[_evidence()])],
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
        findings=[_finding("c1", "receipts", 0.6, contradiction="cited", evidence=[_evidence()])],
    )

    verdict = await synthesize_case_verdict(case, StubProvider())
    assert verdict.deciding_factor is not None
    assert verdict.deciding_factor.the_fact == "cited"
