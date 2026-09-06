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


@pytest.mark.asyncio
async def test_classify_load_bearing_obvious_no(fake_provider_factory, sample_low_stakes_claim, sample_case):
    """'The onboarding screen should use a dark theme' — should classify False."""
    from core.loop import LoadBearingAnswer, classify_load_bearing

    provider = fake_provider_factory(responses=[LoadBearingAnswer(answer=False)])
    result = await classify_load_bearing(sample_low_stakes_claim, sample_case, provider)
    assert result is False


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
    pytest.skip("fill in once core.loop.build_test_plan exists")


# --- Hour 18-25: reconcile() ---

@pytest.mark.asyncio
async def test_reconcile_unanimous_strong_evidence_yields_confident_status(
    fake_provider_factory, sample_claim, sample_finding
):
    """SKELETON:
    from core.loop import reconcile
    provider = fake_provider_factory(responses=[ClaimStatus.SURVIVED])
    status, reasoning = await reconcile(sample_claim, [sample_finding], provider)
    assert status in (ClaimStatus.SURVIVED, ClaimStatus.WEAKENED, ClaimStatus.BROKEN)
    assert reasoning  # non-empty — this is what the evidence drawer shows
    """
    pytest.skip("fill in once core.loop.reconcile exists")


@pytest.mark.asyncio
async def test_reconcile_conflicting_thin_evidence_yields_unresolved(
    fake_provider_factory, sample_claim, conflicting_findings
):
    """This is the test that actually matters most: genuinely conflicting or
    thin evidence must NOT be forced to a winner. If your reconcile() always
    picks a side, this is the test that catches it.
    """
    pytest.skip("fill in once core.loop.reconcile exists")


def test_reconcile_never_lets_evaluator_set_its_own_status(sample_finding):
    """Structural check: Finding has no `status` field at all (see
    docs/00-CONTRACTS.md §1) — so an evaluator physically cannot set a
    claim's status. This test just documents/enforces that invariant stays
    true if the contract ever gets touched.
    """
    assert not hasattr(sample_finding, "status")


# --- build_consequences() ---

@pytest.mark.asyncio
async def test_build_consequences_sets_next_validation_for_broken_load_bearing_claims(
    fake_provider_factory, sample_claim
):
    """Every broken/unresolved load-bearing claim needs a concrete
    next_validation — not None, not 'do more research' as a literal string.
    """
    pytest.skip("fill in once core.loop.build_consequences exists")


# --- Hour 25-30: race-condition-free orchestration ---

@pytest.mark.asyncio
async def test_confirm_does_not_await_the_full_pipeline():
    """This is the specific bug the spec calls out by name (backend spec §4):
    if /confirm awaited run_pipeline() before responding, every SSE event
    fired during the run would already be gone by the time the frontend's
    stream connection existed. Simulate a slow run_pipeline (asyncio.sleep)
    and assert whatever handles confirmation returns well before it completes.

    SKELETON:
    async def slow_pipeline(case_id):
        await asyncio.sleep(5)

    start = asyncio.get_event_loop().time()
    await handle_confirm(case_id, run_pipeline=slow_pipeline)  # should create_task, not await
    elapsed = asyncio.get_event_loop().time() - start
    assert elapsed < 1.0
    """
    pytest.skip("fill in once the confirm handler exists (coordinate with Dev C — this may live in api/routes.py calling into core.loop)")


@pytest.mark.asyncio
async def test_queue_emits_events_in_documented_order():
    """claim_map_ready -> awaiting_confirmation -> test_started(*) ->
    finding_ready(*) -> verdict_ready(*) -> consequence_ready(*) ->
    run_complete. Feed run_pipeline a trivial fixed case and assert the
    queue's event *types* come out in an order consistent with this — exact
    interleaving of the repeated events doesn't matter, but run_complete
    must always be last.
    """
    pytest.skip("fill in once run_pipeline() and its queue wiring exist")
