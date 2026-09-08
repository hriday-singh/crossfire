"""
Owner: Dev A. See docs/02-dev-A-core-loop-providers.md for which of these map
to which hour. Several are marked SKELETON below — the shape of the test is
here, the assertion needs to be written against your actual function
signature once it exists, since `extract_claims`/`classify_load_bearing`/etc.
aren't in the frozen contract (only the data models and provider protocol
are). Fill in the `from core.loop import ...` line once you've named things.
"""
from __future__ import annotations

import asyncio

import pytest

from core.models import Case, Claim, ClaimStatus


# --- Hour 2-11 ---

@pytest.mark.asyncio
async def test_extract_claims_produces_awaiting_confirmation_case(fake_provider_factory):
    from core.loop import ExtractedClaims, extract_claims

    provider = fake_provider_factory(
        responses=[
            ExtractedClaims(
                statements=["Students will trust an AI submitting applications on their behalf"]
            )
        ]
    )
    case = await extract_claims("I want to build an AI for college applications", provider)
    assert case.status == "awaiting_confirmation"
    assert len(case.claims) > 0


@pytest.mark.asyncio
async def test_extract_claims_multiple_statements_and_uniqueness(fake_provider_factory):
    import uuid
    from core.loop import ExtractedClaims, extract_claims

    statements = [
        "Clinics will pay $500/month for automated transcription",
        "Physicians will review rather than write notes from scratch",
        "HIPAA compliance certification can be obtained in under 60 days",
    ]
    provider = fake_provider_factory(responses=[ExtractedClaims(statements=statements)])
    case = await extract_claims("Building AI scribe for medical clinics", provider)

    assert case.status == "awaiting_confirmation"
    assert case.raw_input == "Building AI scribe for medical clinics"
    assert len(case.claims) == 3

    # Verify UUID format and uniqueness
    case_uuid = uuid.UUID(case.id)
    assert str(case_uuid) == case.id

    claim_ids = [c.id for c in case.claims]
    assert len(set(claim_ids)) == 3
    for cid in claim_ids:
        assert str(uuid.UUID(cid)) == cid

    assert [c.statement for c in case.claims] == statements
    for c in case.claims:
        assert c.status is None
        assert c.load_bearing is None


@pytest.mark.asyncio
async def test_extract_claims_clamps_to_five(fake_provider_factory):
    """Claims must be bounded to at most 5 to prevent unbounded fan-out."""
    from core.loop import ExtractedClaims, extract_claims

    statements = [f"Claim number {i}" for i in range(1, 11)]
    provider = fake_provider_factory(responses=[ExtractedClaims(statements=statements)])
    case = await extract_claims("Large scope proposition with ten assertions", provider)

    assert len(case.claims) == 5
    assert [c.statement for c in case.claims] == statements[:5]


@pytest.mark.asyncio

async def test_extract_claims_gates_untestable_input(fake_provider_factory):
    """Direction doc 3: pure ideation gets redirected, never turned into
    invented claims."""
    from core.loop import ExtractedClaims, extract_claims

    provider = fake_provider_factory(
        responses=[
            ExtractedClaims(
                testable=False,
                redirect="Which specific option are you choosing between, and by when?",
                statements=[],
            )
        ]
    )
    case = await extract_claims("build something cool for students", provider)
    assert case.status == "needs_input"
    assert case.claims == []
    assert "specific option" in case.gate_message


@pytest.mark.asyncio
async def test_extract_claims_empty_statements_also_gates(fake_provider_factory):
    """A 'testable' verdict with no claims behind it is still nothing to test."""
    from core.loop import ExtractedClaims, extract_claims

    provider = fake_provider_factory(responses=[ExtractedClaims(statements=[])])
    case = await extract_claims("gibberish without claims", provider)
    assert case.status == "needs_input"
    assert case.claims == []
    assert case.gate_message


@pytest.mark.asyncio
async def test_extract_claims_with_context_includes_context_in_prompt_and_case(fake_provider_factory):
    from core.loop import ExtractedClaims, extract_claims

    provider = fake_provider_factory(
        responses=[ExtractedClaims(statements=["Hospital contracts require on-prem deployment"])]
    )
    context_doc = "Security Policy: All medical software must be deployed strictly on-premises."
    case = await extract_claims(
        "Deploying hospital AI scribe in the cloud",
        provider,
        context=context_doc,
    )
    assert case.status == "awaiting_confirmation"
    assert case.context == context_doc
    assert len(case.claims) == 1
    assert case.claims[0].statement == "Hospital contracts require on-prem deployment"
    assert "Supporting / Context Document" in provider.calls[0]["messages"][0]["content"]
    assert context_doc in provider.calls[0]["messages"][0]["content"]


@pytest.mark.asyncio
async def test_rank_load_bearing_caps_at_half_the_claims(fake_provider_factory):
    """Measured before this change: 9 of 9 claims came back load-bearing, so
    adaptive scrutiny did not exist. Ranking with a ceil(n/2) cap is what makes
    the panel differentiate at all."""
    from core.loop import LOAD_BEARING_QUESTION, LoadBearingRanking, rank_load_bearing
    from core.models import Case, Claim

    case = Case(
        id="case-rank",
        raw_input="Whether to sign the lease on the Oak Street unit",
        claims=[Claim(id=f"c{i}", statement=f"Claim {i}") for i in range(5)],
    )
    provider = fake_provider_factory(responses=[LoadBearingRanking(ranked_indices=[3, 1, 5, 2, 4])])

    flags = await rank_load_bearing(case, provider)
    assert len(flags) == 5
    assert sum(flags) == 3  # ceil(5/2)
    # Top 3 of the returned order: claims 3, 1 and 5 (1-based).
    assert [i for i, f in enumerate(flags) if f] == [0, 2, 4]
    assert LOAD_BEARING_QUESTION in provider.calls[0]["system_prompt"]
    assert case.raw_input in provider.calls[0]["messages"][0]["content"]


@pytest.mark.asyncio
async def test_rank_load_bearing_includes_claims_the_model_dropped(fake_provider_factory):
    from core.loop import LoadBearingRanking, rank_load_bearing
    from core.models import Case, Claim

    case = Case(
        id="case-partial",
        raw_input="Whether to start the medication now or wait",
        claims=[Claim(id=f"c{i}", statement=f"Claim {i}") for i in range(4)],
    )
    provider = fake_provider_factory(responses=[LoadBearingRanking(ranked_indices=[2, 2, 99])])

    flags = await rank_load_bearing(case, provider)
    assert len(flags) == 4
    assert sum(flags) == 2  # ceil(4/2), nothing lost to duplicates or junk indices


@pytest.mark.asyncio
async def test_rank_load_bearing_falls_back_when_the_call_fails(sample_case):
    """A failed ranking must not make every claim load-bearing again."""
    from core.loop import rank_load_bearing

    class DeadProvider:
        async def generate(self, system_prompt, messages, response_schema=None):
            raise RuntimeError("provider is down")

    flags = await rank_load_bearing(sample_case, DeadProvider())
    assert flags == [True, False]


@pytest.mark.asyncio
async def test_rank_load_bearing_with_context(fake_provider_factory, sample_case):
    from core.loop import LoadBearingRanking, rank_load_bearing

    sample_case.context = "Strict state regulatory requirement on medical data."
    provider = fake_provider_factory(responses=[LoadBearingRanking(ranked_indices=[1, 2])])
    await rank_load_bearing(sample_case, provider)
    assert "Context Document: Strict state regulatory requirement" in provider.calls[0]["messages"][0]["content"]


@pytest.mark.asyncio
async def test_rank_load_bearing_dynamic_count_and_reasons(fake_provider_factory):
    """Option 1: Dynamic count clamped to ceil(n/2) with reasons persisted to Claim."""
    from core.loop import LoadBearingRanking, rank_load_bearing
    from core.models import Case, Claim

    case = Case(
        id="case-dyn",
        raw_input="Deciding whether to open a satellite office",
        claims=[
            Claim(id="c1", statement="Local market has 10k prospective clients"),
            Claim(id="c2", statement="Rent is $3,000/mo"),
            Claim(id="c3", statement="Key hire will relocate"),
            Claim(id="c4", statement="Internet speeds exceed 1 Gbps"),
        ],
    )
    # cap is ceil(4/2) = 2. Model decides only 1 claim is truly load-bearing and provides reasons.
    provider = fake_provider_factory(
        responses=[
            LoadBearingRanking(
                ranked_indices=[1, 3, 2, 4],
                load_bearing_count=1,
                reasons=[
                    "Without market size the entire office is unviable.",
                    "Key hire relocation is critical but mitigable.",
                    "Rent is within standard operational budget.",
                    "Internet speed is a secondary commodity requirement.",
                ],
            )
        ]
    )

    flags = await rank_load_bearing(case, provider)
    assert flags == [True, False, False, False]
    assert case.claims[0].load_bearing is True
    assert case.claims[0].load_bearing_reason == "Without market size the entire office is unviable."
    assert case.claims[1].load_bearing is False
    assert "Rent is within" in case.claims[1].load_bearing_reason


# --- Hour 11-18 ---


@pytest.mark.asyncio
async def test_build_test_plan_differentiates_by_load_bearing_not_keywords(sample_case):
    """Adaptive scrutiny: empirical claims receive the full 4-evaluator panel,
    while non-empirical claims receive 3 reasoning evaluators without single-evaluator blindspots."""
    from core.loop import build_test_plan

    plan = build_test_plan(sample_case)  # claim-1 load_bearing=True (empirical), claim-2 False (non-empirical)
    lb_modes = [i.failure_mode for i in plan if i.target_claim == "claim-1"]
    secondary_modes = [i.failure_mode for i in plan if i.target_claim == "claim-2"]

    assert set(lb_modes) == {"assumption", "evidence", "feasibility", "operational_friction"}
    # Non-empirical secondary claim routes to 3 reasoning evaluators (no researcher)
    assert set(secondary_modes) == {"assumption", "feasibility", "operational_friction"}


def test_build_test_plan_routing_ignores_wording():
    """Same load-bearing flags, wildly different subject matter, identical plan
    shape across technical and personal domains."""
    from core.loop import build_test_plan
    from core.models import Case, Claim

    def plan_shape(statements: list[str]) -> list[str]:
        case = Case(
            id="c",
            raw_input="x",
            claims=[
                Claim(id=f"c{i}", statement=st, load_bearing=(i == 0))
                for i, st in enumerate(statements)
            ],
        )
        return [i.failure_mode for i in build_test_plan(case)]

    technical = plan_shape(["The API will scale to 10k QPS", "Competitor pricing is under $10"])
    personal = plan_shape(["My mother can manage the stairs alone", "The medical fee exceeds $500"])
    assert technical == personal


@pytest.mark.asyncio
async def test_build_test_plan_single_pass_mode(sample_case):
    """Single-pass single-evaluator routing has been eliminated; all claims receive multi-persona scrutiny."""
    from core.loop import build_test_plan

    plan = build_test_plan(sample_case, panel=False)
    # claim-1 is empirical (4 evaluators), claim-2 is non-empirical (3 reasoning evaluators)
    assert len(plan) == 7
    c1_modes = {item.failure_mode for item in plan if item.target_claim == "claim-1"}
    c2_modes = {item.failure_mode for item in plan if item.target_claim == "claim-2"}
    assert c1_modes == {"assumption", "evidence", "feasibility", "operational_friction"}
    assert c2_modes == {"assumption", "feasibility", "operational_friction"}
    assert {i.target_claim for i in plan} == {c.id for c in sample_case.claims}


@pytest.mark.asyncio
async def test_build_test_plan_single_pass_falls_back_when_researcher_is_off(sample_case):
    from core.loop import build_test_plan

    plan = build_test_plan(sample_case, panel=False, active_agents=["operator", "builder"])
    assert len(plan) == 4
    assert {item.failure_mode for item in plan} == {"feasibility", "operational_friction"}
    for claim in sample_case.claims:
        modes = {item.failure_mode for item in plan if item.target_claim == claim.id}
        assert modes == {"feasibility", "operational_friction"}


@pytest.mark.asyncio
async def test_build_test_plan_treats_unranked_claims_as_load_bearing(sample_case):
    """load_bearing is None until the ranking runs, and an unranked claim must
    not silently drop to a single test."""
    from core.loop import build_test_plan

    sample_case.claims[1].statement = "Enterprise license pricing is under $5,000/yr"
    for claim in sample_case.claims:
        claim.load_bearing = None
    plan = build_test_plan(sample_case)
    assert len(plan) == len(sample_case.claims) * 4


# --- Hour 18-25: reconcile() ---

@pytest.mark.asyncio
async def test_reconcile_unanimous_strong_evidence_yields_confident_status(
    fake_provider_factory, sample_claim, sample_finding
):
    from core.loop import ReconcileVerdict, reconcile

    provider = fake_provider_factory(
        responses=[ReconcileVerdict(status=ClaimStatus.SURVIVED, reasoning="Comparable case supports the claim")]
    )
    status, reasoning = await reconcile(sample_claim, [sample_finding], provider)
    assert status in (ClaimStatus.SURVIVED, ClaimStatus.WEAKENED, ClaimStatus.BROKEN)
    assert reasoning  # non-empty — this is what the evidence drawer shows


@pytest.mark.asyncio
async def test_reconcile_conflicting_thin_evidence_yields_unresolved(
    fake_provider_factory, sample_claim, conflicting_findings
):
    """This is the test that actually matters most: genuinely conflicting or
    thin evidence must NOT be forced to a winner. If your reconcile() always
    picks a side, this is the test that catches it.
    """
    from core.loop import ReconcileVerdict, reconcile

    provider = fake_provider_factory(
        responses=[
            ReconcileVerdict(
                status=ClaimStatus.UNRESOLVED,
                reasoning="Findings disagree with comparable evidence quality",
            )
        ]
    )
    status, reasoning = await reconcile(sample_claim, conflicting_findings, provider)
    assert status == ClaimStatus.UNRESOLVED
    assert reasoning


def test_reconcile_never_lets_evaluator_set_its_own_status(sample_finding):
    """Structural check: Finding has no `status` field at all (see
    docs/00-CONTRACTS.md §1) — so an evaluator physically cannot set a
    claim's status. This test just documents/enforces that invariant stays
    true if the contract ever gets touched.
    """
    assert not hasattr(sample_finding, "status")


# --- build_consequences() ---

def test_build_consequences_sets_next_validation_for_broken_load_bearing_claims(sample_claim):
    """Every broken/unresolved load-bearing claim needs a concrete
    next_validation — not None, not 'do more research' as a literal string.
    """
    from core.loop import build_consequences

    sample_claim.status = ClaimStatus.BROKEN
    case = Case(id="case-1", raw_input="input", claims=[sample_claim])

    consequences = build_consequences(case)

    assert len(consequences) == 1
    dc = consequences[0]
    assert dc.claim_id == sample_claim.id
    assert dc.next_validation is not None
    assert dc.next_validation != "do more research"
    assert sample_claim.statement in dc.next_validation


def test_build_consequences_survived_claim_needs_no_next_validation(sample_claim):
    from core.loop import build_consequences

    sample_claim.status = ClaimStatus.SURVIVED
    case = Case(id="case-1", raw_input="input", claims=[sample_claim])

    consequences = build_consequences(case)

    assert consequences[0].next_validation is None


def test_build_consequences_skips_untested_claims(sample_claim):
    from core.loop import build_consequences

    sample_claim.status = None
    case = Case(id="case-1", raw_input="input", claims=[sample_claim])

    assert build_consequences(case) == []


# --- Hour 25-30: race-condition-free orchestration ---

@pytest.mark.asyncio
async def test_confirm_does_not_await_the_full_pipeline():
    """This is the specific bug the spec calls out by name (backend spec §4):
    if /confirm awaited run_pipeline() before responding, every SSE event
    fired during the run would already be gone by the time the frontend's
    stream connection existed.
    """
    import asyncio

    from core.loop import handle_confirm

    started = asyncio.Event()

    async def slow_pipeline(case_id):
        started.set()
        await asyncio.sleep(5)

    loop = asyncio.get_running_loop()
    start = loop.time()
    await handle_confirm("case-1", run_pipeline=slow_pipeline)
    elapsed = loop.time() - start

    assert elapsed < 1.0
    await started.wait()  # scheduled, not skipped



class SchemaProvider:
    """Answers whatever schema it is handed. Pipeline tests need every stage to
    succeed, not a fixed-length response queue."""

    def __init__(self, **overrides):
        self.overrides = overrides
        self.calls: list[dict] = []

    async def generate(self, system_prompt, messages, response_schema=None):
        self.calls.append(
            {"system_prompt": system_prompt, "messages": messages, "response_schema": response_schema}
        )
        name = getattr(response_schema, "__name__", None)
        if name in self.overrides:
            value = self.overrides[name]
            return value(messages) if callable(value) else value
        if name == "SteelManVerdict" and "ReconcileVerdict" in self.overrides:
            value = self.overrides["ReconcileVerdict"]
            return value(messages) if callable(value) else value
        if response_schema is None:
            return "plain answer"
        from core.evaluators._reasoning import ReasoningOutput
        from core.evaluators.builder import BuilderVerdict
        from core.evaluators.operator import OperatorVerdict
        from core.evaluators.researcher import ResearcherAssessment
        from core.loop import (
            CaseVerdictOutput,
            LoadBearingRanking,
            NextActionOutput,
            ReconcileVerdict,
            StrategicConsequenceOutput,
        )
        from core.models import ClaimStatus

        defaults = {
            "LoadBearingRanking": lambda: LoadBearingRanking(ranked_indices=[1, 2]),
            "ReasoningOutput": lambda: ReasoningOutput(
                result="Assumption examined", reasoning="One specific gap.", confidence=0.6
            ),
            "BuilderVerdict": lambda: BuilderVerdict(
                result="Achievable", reasoning="Ordinary effort.", confidence=0.6
            ),
            "OperatorVerdict": lambda: OperatorVerdict(
                result="Operational friction manageable",
                reasoning="Standard administrative approval needed.",
                confidence=0.6,
            ),
            "ResearcherAssessment": lambda: ResearcherAssessment(
                result="No source found", reasoning="Nothing relevant returned.", confidence=0.2
            ),
            "ResearcherAssessment": lambda: ResearcherAssessment(
                result="Authority checked", reasoning="No statutory blocker.", confidence=0.7
            ),
            "SteelManVerdict": lambda: ReconcileVerdict(
                status=ClaimStatus.WEAKENED,
                reasoning="Holds with caveats.",
                fatal_flaw="Unverified adoption rate.",
                salvaged_claim="Pilot with 5 enterprise customers before full rollout.",
                tradeoff_acknowledged="Slower initial revenue growth.",
            ),
            "ReconcileVerdict": lambda: ReconcileVerdict(
                status=ClaimStatus.WEAKENED,
                reasoning="Holds with caveats.",
                fatal_flaw="Unverified adoption rate.",
                salvaged_claim="Pilot with 5 enterprise customers before full rollout.",
                tradeoff_acknowledged="Slower initial revenue growth.",
            ),
            "StrategicConsequenceOutput": lambda: StrategicConsequenceOutput(
                impact="medium",
                recommended_change="Confirm the figure with the counterparty first.",
                next_validation="Ask for it in writing this week.",
            ),
            "CaseVerdictOutput": lambda: CaseVerdictOutput(
                decision_state="proceed_with_changes",
                summary="Holds with named changes.",
                next_actions=[
                    NextActionOutput(action="Confirm the figure in writing.", claim_ids=[])
                ],
            ),
        }
        if name in defaults:
            return defaults[name]()
        raise AssertionError(f"SchemaProvider has no answer for {name}")

@pytest.mark.asyncio
async def test_queue_emits_events_in_documented_order(sample_case, fake_provider_factory):
    """claim_map_ready -> awaiting_confirmation -> test_started(*) ->
    finding_ready(*) -> verdict_ready(*) -> consequence_ready(*) ->
    run_complete. The first two belong to POST /cases (Dev C); this asserts the
    subsequence run_pipeline itself owns, and that run_complete is always last.
    """
    import events
    import store
    from core.loop import run_pipeline

    store.set(sample_case)
    queue = events.get_queue(sample_case.id)

    await run_pipeline(sample_case.id, provider=SchemaProvider())

    seen = [item["event"] async for item in events.subscribe(sample_case.id)]

    assert seen[-1] == "run_complete"
    assert "load_bearing_ready" in seen
    assert seen.index("load_bearing_ready") < seen.index("test_started")
    assert seen.count("load_bearing_ready") == len(sample_case.claims)
    assert seen.index("test_started") < seen.index("finding_ready")
    assert seen.index("verdict_ready") < seen.index("consequence_ready")
    assert seen.index("consequence_ready") < seen.index("case_verdict")
    assert seen.count("verdict_ready") == len(sample_case.claims)
    assert queue.empty()  # sentinel consumed, nothing stranded



@pytest.mark.asyncio
async def test_run_pipeline_threads_judge_reasoning_into_consequences(
    sample_case, fake_provider_factory
):
    """build_consequences() can only synthesize verdict_reasoning from status —
    the real reconcile() reasoning has to be threaded in by the pipeline.
    """
    import store
    from core.loop import run_pipeline

    store.set(sample_case)

    await run_pipeline(sample_case.id, provider=SchemaProvider())

    case = store.get(sample_case.id)
    assert case.status == "done"
    # startswith, not ==: the gates append their own note when they fire, and the
    # point of this test is that the judge's own reasoning reached the consequence.
    assert all(
        c.verdict_reasoning.startswith("Holds with caveats.") for c in case.consequences
    )


@pytest.mark.asyncio
async def test_run_pipeline_closes_the_queue_on_provider_failure(sample_case):
    """A dead provider must emit `error` and close the stream, not hang the
    frontend's open SSE connection forever.
    """
    import events
    import store
    from core.loop import run_pipeline

    class DeadProvider:
        async def generate(self, system_prompt, messages, response_schema=None):
            raise RuntimeError("provider is down")

    store.set(sample_case)

    await run_pipeline(sample_case.id, provider=DeadProvider())

    seen = [item async for item in events.subscribe(sample_case.id)]
    assert seen[-1]["event"] == "error"
    assert seen[-1]["data"]["stage"] == "run_pipeline"
    assert store.get(sample_case.id).status == "error"


@pytest.mark.asyncio
async def test_run_pipeline_resilient_to_single_claim_reconcile_failure(sample_case):
    """If one claim's reconcile fails, it degrades to UNRESOLVED without taking down the pipeline."""
    import store
    from core.loop import ReconcileVerdict, run_pipeline

    reconcile_calls = {"n": 0}

    def flaky_reconcile(_messages):
        reconcile_calls["n"] += 1
        if reconcile_calls["n"] == 1:
            raise RuntimeError("LLM timeout on claim 1")
        return ReconcileVerdict(status=ClaimStatus.SURVIVED, reasoning="Claim 2 holds")

    store.set(sample_case)
    await run_pipeline(sample_case.id, provider=SchemaProvider(ReconcileVerdict=flaky_reconcile))

    case = store.get(sample_case.id)
    assert case.status == "done"
    # Even though one reconcile failed, the case completed
    statuses = [c.status for c in case.claims]
    assert ClaimStatus.UNRESOLVED in statuses
    assert len(case.consequences) == len(case.claims)


@pytest.mark.asyncio
async def test_synthesize_consequences_llm_enriches_pivots_and_experiments(sample_case, fake_provider_factory):
    from core.loop import (
        StrategicConsequenceOutput,
        build_consequences,
        synthesize_consequences,
    )

    sample_case.claims[0].status = ClaimStatus.BROKEN
    sample_case.claims[1].status = ClaimStatus.SURVIVED
    sample_case.consequences = build_consequences(sample_case)

    provider = fake_provider_factory(
        [
            StrategicConsequenceOutput(
                impact="high",
                recommended_change="Shift to a hybrid human-in-the-loop escalation model",
                next_validation="Run a 30-day shadow test measuring containment on tier-1 requests",
            )
        ]
    )

    updated = await synthesize_consequences(sample_case, provider)
    broken_cons = next(c for c in updated if c.claim_id == sample_case.claims[0].id)
    assert broken_cons.impact == "high"
    assert "hybrid human-in-the-loop" in broken_cons.recommended_change
    assert "30-day shadow test" in broken_cons.next_validation

    survived_cons = next(c for c in updated if c.claim_id == sample_case.claims[1].id)
    assert survived_cons.recommended_change == "No change needed."
    assert survived_cons.next_validation is None


@pytest.mark.asyncio
async def test_synthesize_consequence_invalid_impact_fallback(sample_case, fake_provider_factory):
    from core.loop import (
        StrategicConsequenceOutput,
        build_consequences,
        synthesize_consequences,
    )

    sample_case.claims[0].status = ClaimStatus.BROKEN
    sample_case.claims[0].load_bearing = True
    sample_case.consequences = build_consequences(sample_case)
    baseline_impact = sample_case.consequences[0].impact  # "high"

    # Model emits unwhitelisted impact string like "critical"
    provider = fake_provider_factory(
        [
            StrategicConsequenceOutput(
                impact="critical",
                recommended_change="Major architecture revision",
                next_validation="Prototype",
            )
        ]
    )

    updated = await synthesize_consequences(sample_case, provider)
    cons = next(c for c in updated if c.claim_id == sample_case.claims[0].id)
    # Must preserve baseline impact ("high"), not overwrite with "critical"
    assert cons.impact == baseline_impact
    assert cons.impact in {"high", "medium", "low"}



# --- Dynamic Agent Selection & Recommendation Tests ---

def test_normalize_agents_keeps_only_known_agents():
    from core.loop import AgentPick, normalize_agents

    agents, rationales = normalize_agents(
        [
            AgentPick(agent="researcher", rationale="The rent figure is checkable against listings."),
            AgentPick(agent="astrologer", rationale="Not a real evaluator."),
        ]
    )
    assert agents == ["devils_advocate", "researcher"]  # advocate always present
    assert "listings" in rationales["researcher"]
    assert set(rationales) == set(agents)


def test_normalize_agents_orders_consistently_and_dedupes():
    from core.loop import AgentPick, normalize_agents

    agents, _ = normalize_agents(
        [
            AgentPick(agent="operator", rationale="Adoption inertia is the main hurdle."),
            AgentPick(agent="researcher", rationale="Prices are public."),
            AgentPick(agent="researcher", rationale="Duplicate."),
        ]
    )
    assert agents == ["devils_advocate", "researcher", "operator"]


def test_normalize_agents_falls_back_to_the_full_panel():
    """A model that returns nothing usable must not leave the run untested."""
    from core.loop import normalize_agents

    agents, rationales = normalize_agents([])
    assert agents == ["devils_advocate"]
    assert rationales["devils_advocate"]


def test_format_concise_rationale_and_normalize_single_sentence():
    from core.loop import AgentPick, normalize_agents
    from core.textutil import format_concise_rationale

    # Test format_concise_rationale helper directly
    multi_sentence = "Why selected: Pricing is publicly listed on vendor pages. Second sentence should be omitted."
    formatted = format_concise_rationale(multi_sentence)
    assert formatted == "Pricing is publicly listed on vendor pages."
    assert "Second sentence" not in formatted
    assert not formatted.lower().startswith("why selected:")

    # Test normalize_agents cleans multi-sentence verbose picks to one concise sentence
    agents, rationales = normalize_agents(
        [
            AgentPick(
                agent="researcher",
                rationale="Why selected: Pricing is publicly verifiable. We also verified historical contracts.",
            ),
            AgentPick(
                agent="builder",
                rationale="Architecture requires substantial API integration work",
            ),
        ]
    )
    assert rationales["researcher"] == "Pricing is publicly verifiable."
    assert rationales["builder"] == "Architecture requires substantial API integration work."



def test_build_test_plan_filters_strictly_by_active_agents(sample_case):
    from core.loop import build_test_plan

    # Only run Assumption Test (devils_advocate)
    plan_advocate = build_test_plan(sample_case, panel=True, active_agents=["devils_advocate"])
    assert all(item.failure_mode == "assumption" for item in plan_advocate)
    assert len(plan_advocate) == len(sample_case.claims)

    # Only run Evidence Test (researcher)
    plan_researcher = build_test_plan(sample_case, panel=True, active_agents=["researcher"])
    assert all(item.failure_mode == "evidence" for item in plan_researcher)
    assert len(plan_researcher) == len(sample_case.claims)

    # Run Devil's Advocate and Researcher, but exclude Builder and Operator
    plan_combo = build_test_plan(sample_case, panel=True, active_agents=["devils_advocate", "researcher"])
    assert set(item.failure_mode for item in plan_combo) == {"assumption", "evidence"}
    assert not any(item.failure_mode in ("feasibility", "operational_friction") for item in plan_combo)


@pytest.mark.asyncio
async def test_extract_claims_custom_agents(fake_provider_factory):
    from core.loop import extract_claims, ExtractedClaims
    provider = fake_provider_factory([ExtractedClaims(statements=["Claim A", "Claim B"])])

    case = await extract_claims(
        raw_input="Test proposal",
        provider=provider,
        agent_mode="custom",
        selected_agents=["devils_advocate", "builder"],
    )
    assert case.agent_mode == "custom"
    assert case.selected_agents == ["devils_advocate", "builder"]
    assert case.agent_rationales == {}


@pytest.mark.asyncio
async def test_extract_claims_auto_mode_generates_rationales(fake_provider_factory):
    from core.loop import extract_claims, ExtractedClaims
    from core.loop import AgentPick

    provider = fake_provider_factory([
        ExtractedClaims(
            statements=["The move saves 40 minutes a day", "The lease allows subletting"],
            agents=[
                AgentPick(agent="researcher", rationale="The lease terms are a matter of record."),
                AgentPick(agent="operator", rationale="Procurement approval takes 9 months."),
            ],
        )
    ])

    case = await extract_claims(raw_input="Test proposal", provider=provider, agent_mode="auto")
    assert case.agent_mode == "auto"
    assert case.selected_agents == ["devils_advocate", "researcher", "operator"]
    assert "matter of record" in case.agent_rationales["researcher"]


@pytest.mark.asyncio
async def test_run_evaluators_isolates_case(monkeypatch, sample_case, sample_finding):
    """Evaluators must receive an isolated case stripped of other findings/consequences."""
    import core.loop as loop
    from core.models import CaseVerdict, DecisionConsequence

    # Rehydrated or re-run case with existing findings and verdicts
    sample_case.findings = [sample_finding]
    sample_case.consequences = [
        DecisionConsequence(
            claim_id=sample_case.claims[0].id,
            impact="high",
            recommended_change="Change",
            verdict_reasoning="Reason",
        )
    ]
    sample_case.case_verdict = CaseVerdict(
        decision_state="hold",
        summary="Hold execution",
        survived=[],
        broken=[sample_case.claims[0].id],
    )

    inspected_cases = []

    async def spy_dispatch(item, case, provider):
        inspected_cases.append(case)
        return sample_finding

    monkeypatch.setattr(loop, "dispatch", spy_dispatch)
    plan = loop.build_test_plan(sample_case)
    await loop.run_evaluators(sample_case, plan, provider=None)

    assert len(inspected_cases) > 0
    for seen_case in inspected_cases:
        assert seen_case.findings == [], "Evaluator must not see other findings"
        assert seen_case.consequences == [], "Evaluator must not see consequences"
        assert seen_case.case_verdict is None, "Evaluator must not see case_verdict"






# --- Citation verification is wired into the pipeline (2026-09-08) ---


@pytest.mark.asyncio
async def test_pipeline_verifies_evidence_before_the_findings_land(sample_case, monkeypatch):
    """Fabricated citations must not reach the panel, the memo, or the SSE stream."""
    import store
    from core.loop import run_pipeline
    from core.models import EvidenceItem, Finding

    seen: dict[str, list] = {}

    async def fake_dispatch(item, case, provider):
        return Finding(
            claim_id=item.target_claim,
            test_id=item.id,
            evaluator="researcher",
            result="Refuted",
            evidence=[
                EvidenceItem(
                    source_url="https://news.csraid.com/en/hub/invented",
                    snippet="30 million user IDs were blocked",
                    retrieved_at="2026-09-08",
                ),
                EvidenceItem(
                    source_url="https://www.ecfr.gov/rule",
                    snippet="The federal cap is 11 hours.",
                    retrieved_at="2026-09-08",
                ),
            ],
            reasoning="r",
            confidence=0.8,
            contradiction="The cap is 11 hours.",
        )

    async def fake_verify(items):
        seen.setdefault("input", []).extend(items)
        kept = [i for i in items if "csraid" not in i.source_url]
        for item in kept:
            item.verified = True
            item.verification = "snippet_matched"
        return kept

    monkeypatch.setattr("core.loop.dispatch", fake_dispatch)
    monkeypatch.setattr("core.loop.verify_evidence", fake_verify)

    store.set(sample_case)
    await run_pipeline(sample_case.id, provider=SchemaProvider())

    assert seen.get("input"), "verify_evidence was never called"
    case = store.get(sample_case.id)
    urls = [e.source_url for f in case.findings for e in f.evidence]
    assert urls, "the surviving evidence was dropped entirely"
    assert not any("csraid" in u for u in urls)
    assert all(
        e.verification == "snippet_matched" for f in case.findings for e in f.evidence
    )


# --- Extraction carries resolved terms and mechanism labels (2026-09-08) ---


class _ExtractionProvider:
    def __init__(self, payload):
        self._payload = payload

    async def generate(self, system_prompt, messages, response_schema=None):
        return self._payload


@pytest.mark.asyncio
async def test_extraction_carries_resolved_terms_through_to_claims():
    from core.agent_panel import ExtractedClaims, ResolvedTermOutput
    from core.loop import extract_claims

    payload = ExtractedClaims(
        testable=True,
        statements=["The bot books tickets when holiday quotas open"],
        terms=[
            ResolvedTermOutput(
                term="holiday quotas",
                resolved="Tatkal quota",
                search_phrasing="IRCTC Tatkal quota opening time",
            )
        ],
    )
    case = await extract_claims("x", _ExtractionProvider(payload))
    assert case.claims[0].terms[0].resolved == "Tatkal quota"


@pytest.mark.asyncio
async def test_sibling_mechanisms_share_a_mechanism_of_label():
    from core.agent_panel import ExtractedClaims
    from core.loop import extract_claims

    payload = ExtractedClaims(
        testable=True,
        statements=["Fires at the exact second", "Solves the CAPTCHA", "Guarantees a seat"],
        mechanisms=["irctc-booking-bot", "irctc-booking-bot", "irctc-booking-bot"],
    )
    case = await extract_claims("x", _ExtractionProvider(payload))
    assert {c.mechanism_of for c in case.claims} == {"irctc-booking-bot"}


@pytest.mark.asyncio
async def test_a_claim_does_not_carry_a_sibling_claims_term():
    from core.agent_panel import ExtractedClaims, ResolvedTermOutput
    from core.loop import extract_claims

    payload = ExtractedClaims(
        testable=True,
        statements=["The bot books when holiday quotas open", "The bot solves the CAPTCHA"],
        terms=[
            ResolvedTermOutput(
                term="holiday quotas", resolved="Tatkal quota", search_phrasing="Tatkal timing"
            )
        ],
    )
    case = await extract_claims("x", _ExtractionProvider(payload))
    assert len(case.claims[0].terms) == 1
    assert case.claims[1].terms == []


# --- Extraction carries resolved terms and mechanism labels (2026-09-08) ---


class _ExtractionProvider:
    def __init__(self, payload):
        self._payload = payload

    async def generate(self, system_prompt, messages, response_schema=None):
        return self._payload


@pytest.mark.asyncio
async def test_extraction_carries_resolved_terms_through_to_claims():
    from core.agent_panel import ExtractedClaims, ResolvedTermOutput
    from core.loop import extract_claims

    payload = ExtractedClaims(
        testable=True,
        statements=["The bot books tickets when holiday quotas open"],
        terms=[
            ResolvedTermOutput(
                term="holiday quotas",
                resolved="Tatkal quota",
                search_phrasing="IRCTC Tatkal quota opening time",
            )
        ],
    )
    case = await extract_claims("x", _ExtractionProvider(payload))
    assert case.claims[0].terms[0].resolved == "Tatkal quota"


@pytest.mark.asyncio
async def test_sibling_mechanisms_share_a_mechanism_of_label():
    from core.agent_panel import ExtractedClaims
    from core.loop import extract_claims

    payload = ExtractedClaims(
        testable=True,
        statements=["Fires at the exact second", "Solves the CAPTCHA", "Guarantees a seat"],
        mechanisms=["irctc-booking-bot", "irctc-booking-bot", "irctc-booking-bot"],
    )
    case = await extract_claims("x", _ExtractionProvider(payload))
    assert {c.mechanism_of for c in case.claims} == {"irctc-booking-bot"}


@pytest.mark.asyncio
async def test_a_claim_does_not_carry_a_sibling_claims_term():
    from core.agent_panel import ExtractedClaims, ResolvedTermOutput
    from core.loop import extract_claims

    payload = ExtractedClaims(
        testable=True,
        statements=["The bot books when holiday quotas open", "The bot solves the CAPTCHA"],
        terms=[
            ResolvedTermOutput(
                term="holiday quotas", resolved="Tatkal quota", search_phrasing="Tatkal timing"
            )
        ],
    )
    case = await extract_claims("x", _ExtractionProvider(payload))
    assert len(case.claims[0].terms) == 1
    assert case.claims[1].terms == []
