"""
Owner: Dev C. See docs/04-dev-C-api-sse-evaluators.md hour 2-11.
"""
from __future__ import annotations

import pytest

from core.models import Finding


@pytest.mark.asyncio
async def test_run_devils_advocate_produces_finding_with_reasoning(
    fake_provider_factory, sample_claim, sample_test_plan_item
):
    """SKELETON:
    from core.evaluators.devils_advocate import run_devils_advocate
    fake_finding = Finding(
        claim_id=sample_claim.id, test_id=sample_test_plan_item.id,
        evaluator="devils_advocate", result="Assumption doesn't hold",
        reasoning="No comparable precedent found", confidence=0.6,
    )
    provider = fake_provider_factory(responses=[fake_finding])
    finding = await run_devils_advocate(sample_claim, sample_test_plan_item, provider)
    assert finding.evaluator == "devils_advocate"
    assert finding.reasoning
    """
    pytest.skip("fill in once core.evaluators.devils_advocate.run_devils_advocate exists")


@pytest.mark.asyncio
async def test_run_devils_advocate_never_calls_the_evidence_pipeline(monkeypatch):
    """Structural boundary: Devil's Advocate is prompt-only, no tool chain.
    Monkeypatch evidence.search.search_evidence to raise if called, and
    assert running Devil's Advocate never touches it — that's Receipts' job.
    """
    pytest.skip("fill in once core.evaluators.devils_advocate exists")


@pytest.mark.asyncio
async def test_run_devils_advocate_sees_only_its_own_claim(fake_provider_factory, sample_case):
    """Independence-by-construction check: assert the prompt/messages sent to
    the provider only reference the one claim + case context being evaluated,
    never another claim's findings — this is what 'each evaluator forms its
    own first finding before seeing anyone else's' actually means in code,
    per direction doc §6.
    """
    pytest.skip("fill in once core.evaluators.devils_advocate exists")
