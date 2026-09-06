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
    """SKELETON:
    from core.evaluators.receipts import run_receipts
    provider = fake_provider_factory(responses=[sample_finding])
    finding = await run_receipts(sample_claim, sample_test_plan_item, provider)
    assert isinstance(finding, Finding)
    assert finding.evaluator == "receipts"
    """
    pytest.skip("fill in once core.evaluators.receipts.run_receipts exists")


@pytest.mark.asyncio
async def test_run_receipts_calls_through_llm_provider_not_google_genai_directly(monkeypatch):
    """Architectural guard, backend spec §3: 'nothing talks to google-genai
    directly outside providers/gemini.py'. If receipts.py ever imports
    google_genai directly, that's the bug this test exists to catch —
    monkeypatch `google.genai` (or however it's imported) to raise if touched,
    and assert calling run_receipts with a FakeLLMProvider never triggers it.
    """
    pytest.skip("fill in once core.evaluators.receipts exists")


@pytest.mark.asyncio
async def test_run_receipts_with_zero_evidence_still_returns_a_finding(fake_provider_factory, sample_claim, sample_test_plan_item):
    """When search_evidence + fetch both come back empty (dead sources), Receipts
    should still produce a Finding — just one with empty `evidence` and
    reasoning that reflects the lack of support, which should push the claim
    toward `unresolved` at reconciliation, not raise an exception here.
    """
    pytest.skip("fill in once core.evaluators.receipts.run_receipts exists")


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
