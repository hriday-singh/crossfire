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

from core.models import Case, ClaimStatus


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
async def test_extract_claims_empty_statements(fake_provider_factory):
    from core.loop import ExtractedClaims, extract_claims

    provider = fake_provider_factory(responses=[ExtractedClaims(statements=[])])
    case = await extract_claims("gibberish without claims", provider)
    assert case.status == "awaiting_confirmation"
    assert case.claims == []


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
async def test_classify_load_bearing_obvious_yes(fake_provider_factory, sample_claim, sample_case):
    """A claim like 'students will trust autonomous submission' — if false, the
    decision changes materially. Assert the function returns True, and that
    the underlying LLM call asked the explicit yes/no question from the spec
    ('if this claim turns out false, would the recommended decision
    materially change?'), not a raw confidence score.
    """
    from core.loop import LOAD_BEARING_QUESTION, LoadBearingAnswer, classify_load_bearing

    provider = fake_provider_factory(responses=[LoadBearingAnswer(answer=True)])
    result = await classify_load_bearing(sample_claim, sample_case, provider)
    assert result is True
    assert LOAD_BEARING_QUESTION in provider.calls[0]["system_prompt"]
    assert sample_case.raw_input in provider.calls[0]["messages"][0]["content"]
    assert sample_claim.statement in provider.calls[0]["messages"][0]["content"]


@pytest.mark.asyncio
async def test_classify_load_bearing_obvious_no(fake_provider_factory, sample_low_stakes_claim, sample_case):
    """'The onboarding screen should use a dark theme' — should classify False."""
    from core.loop import LoadBearingAnswer, classify_load_bearing

    provider = fake_provider_factory(responses=[LoadBearingAnswer(answer=False)])
    result = await classify_load_bearing(sample_low_stakes_claim, sample_case, provider)
    assert result is False


@pytest.mark.asyncio
async def test_classify_load_bearing_with_context(fake_provider_factory, sample_claim, sample_case):
    from core.loop import LoadBearingAnswer, classify_load_bearing

    sample_case.context = "Strict state regulatory requirement on medical data."
    provider = fake_provider_factory(responses=[LoadBearingAnswer(answer=True)])
    result = await classify_load_bearing(sample_claim, sample_case, provider)
    assert result is True
    assert "Context Document: Strict state regulatory requirement" in provider.calls[0]["messages"][0]["content"]


# --- Hour 11-18 ---

@pytest.mark.asyncio
async def test_build_test_plan_routes_different_claims_to_different_failure_modes(sample_case):
    """The whole point of build_test_plan: claims route by what they actually
    need (evidence / alternative / behavior / constraint / failure-mode), not
    round-robin across whichever evaluator is free. Assert that two
    dissimilar claims (e.g. 'users will pay for this' vs 'this architecture
    will scale') produce TestPlanItems with different failure_mode values —
    a plan where every item has the same failure_mode is a failing test.
    """
    from core.loop import build_test_plan

    plan = build_test_plan(sample_case)
    assert len(plan) == len(sample_case.claims)
    failure_modes = {item.failure_mode for item in plan}
    assert len(failure_modes) > 1
    target_claim_ids = {item.target_claim for item in plan}
    assert target_claim_ids == {c.id for c in sample_case.claims}


@pytest.mark.asyncio
async def test_build_test_plan_routes_assumption_claims_to_assumption_mode():
    from core.loop import build_test_plan
    from core.models import Case, Claim

    case = Case(
        id="case-assumption",
        raw_input="Startup idea",
        claims=[
            Claim(id="c1", statement="We assume users expect immediate responses"),
            Claim(id="c2", statement="People believe AI will replace manual data entry"),
        ],
    )
    plan = build_test_plan(case)
    assert all(item.failure_mode == "assumption" for item in plan)


@pytest.mark.asyncio
async def test_build_test_plan_routes_mixed_assumption_and_evidence_to_evidence_mode():
    from core.loop import build_test_plan
    from core.models import Case, Claim

    case = Case(
        id="case-mixed",
        raw_input="Enterprise SaaS",
        claims=[
            Claim(id="c1", statement="We assume enterprise clients will pay $50k/year"),
            Claim(id="c2", statement="We expect customer demand will drive subscription pricing"),
        ],
    )
    plan = build_test_plan(case)
    assert all(item.failure_mode == "evidence" for item in plan)



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


@pytest.mark.asyncio
async def test_queue_emits_events_in_documented_order(sample_case, fake_provider_factory):
    """claim_map_ready -> awaiting_confirmation -> test_started(*) ->
    finding_ready(*) -> verdict_ready(*) -> consequence_ready(*) ->
    run_complete. The first two belong to POST /cases (Dev C); this asserts the
    subsequence run_pipeline itself owns, and that run_complete is always last.
    """
    import events
    import store
    from core.loop import LoadBearingAnswer, run_pipeline

    store.set(sample_case)
    queue = events.get_queue(sample_case.id)
    provider = fake_provider_factory(
        [LoadBearingAnswer(answer=True), LoadBearingAnswer(answer=False)]
    )

    await run_pipeline(sample_case.id, provider=provider)

    seen = [item["event"] async for item in events.subscribe(sample_case.id)]

    assert seen[-1] == "run_complete"
    assert seen.index("verdict_ready") < seen.index("consequence_ready")
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
    from core.loop import LoadBearingAnswer, run_pipeline

    store.set(sample_case)
    provider = fake_provider_factory(
        [LoadBearingAnswer(answer=True), LoadBearingAnswer(answer=False)]
    )

    await run_pipeline(sample_case.id, provider=provider)

    case = store.get(sample_case.id)
    assert case.status == "done"
    assert all(c.status == ClaimStatus.UNRESOLVED for c in case.claims)  # no evaluators yet
    assert all(
        c.verdict_reasoning == "No evaluator produced a finding for this claim."
        for c in case.consequences
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
    from core.loop import LoadBearingAnswer, ReconcileVerdict, run_pipeline

    class PartialFailingProvider:
        def __init__(self):
            self.load_bearing_count = 0
            self.reconcile_count = 0

        async def generate(self, system_prompt, messages, response_schema=None):
            if response_schema == LoadBearingAnswer:
                return LoadBearingAnswer(answer=True)
            if response_schema == ReconcileVerdict:
                self.reconcile_count += 1
                if self.reconcile_count == 1:
                    raise RuntimeError("LLM timeout on claim 1")
                return ReconcileVerdict(status=ClaimStatus.SURVIVED, reasoning="Claim 2 holds")
            return "ok"

    store.set(sample_case)
    await run_pipeline(sample_case.id, provider=PartialFailingProvider())

    case = store.get(sample_case.id)
    assert case.status == "done"
    # Even though one reconcile failed, the case completed
    statuses = [c.status for c in case.claims]
    assert ClaimStatus.UNRESOLVED in statuses
    assert len(case.consequences) == len(case.claims)

