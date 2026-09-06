"""
Owner: Dev B. See docs/03-dev-B-evidence-receipts.md.
"""
from __future__ import annotations

import pytest

from core.models import Finding


@pytest.mark.asyncio
async def test_run_receipts_produces_finding_with_evidence(
    fake_provider_factory, sample_claim, sample_test_plan_item, sample_finding
):
    from core.evaluators.receipts import run_receipts

    provider = fake_provider_factory(responses=[sample_finding])
    finding = await run_receipts(sample_claim, sample_test_plan_item, provider)
    assert isinstance(finding, Finding)
    assert finding.evaluator == "receipts"
    assert finding.claim_id == sample_claim.id
    assert finding.test_id == sample_test_plan_item.id


@pytest.mark.asyncio
async def test_run_receipts_calls_through_llm_provider_not_google_genai_directly(
    monkeypatch, fake_provider_factory, sample_claim, sample_test_plan_item, sample_finding
):
    """Architectural guard: nothing talks to google-genai directly outside providers/gemini.py."""
    import sys
    from core.evaluators.receipts import run_receipts

    class ForbiddenModule:
        def __getattr__(self, name):
            raise AssertionError("Direct access to google.genai is forbidden in evaluators!")

    monkeypatch.setitem(sys.modules, "google.genai", ForbiddenModule())

    provider = fake_provider_factory(responses=[sample_finding])
    finding = await run_receipts(sample_claim, sample_test_plan_item, provider)
    assert finding.evaluator == "receipts"
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_run_receipts_with_zero_evidence_still_returns_a_finding(
    monkeypatch, fake_provider_factory, sample_claim, sample_test_plan_item
):
    """When search_evidence + fetch both come back empty, Receipts still produces a Finding."""
    from core.evaluators.receipts import ReceiptsAssessment, run_receipts

    async def empty_search(c):
        return []

    monkeypatch.setattr("core.evaluators.receipts.search_evidence", empty_search)

    canned_assessment = ReceiptsAssessment(
        result="No external evidence found",
        reasoning="Search yielded zero results.",
        confidence=0.2,
        contradiction=None,
    )
    provider = fake_provider_factory(responses=[canned_assessment])

    finding = await run_receipts(sample_claim, sample_test_plan_item, provider)
    assert isinstance(finding, Finding)
    assert finding.evaluator == "receipts"
    assert finding.evidence == []
    assert finding.confidence <= 0.35


def test_a_finding_with_no_evidence_cannot_silently_become_a_confident_negative(sample_claim):
    """This isn't really a unit test of one function — it's the project's
    core invariant (backend spec + direction docs): 'a negative finding with
    no traceable evidence behind it is the exact failure this architecture
    exists to prevent.' Leave this here as a reminder to check it explicitly
    once reconcile() and run_receipts() both exist — a Finding with
    evidence=[] and a strongly negative `result` should be a red flag your
    eval_set (tests/eval_set/) specifically checks for.
    """
    pytest.skip("covered properly by tests/eval_set/ once the full loop exists — see docs/01-TIMELINE.md hour 38-42")
