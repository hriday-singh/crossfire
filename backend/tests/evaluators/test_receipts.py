"""
Owner: Dev B. See docs/03-dev-B-evidence-receipts.md.
"""
from __future__ import annotations

import pytest

from core.models import Finding


@pytest.mark.asyncio
async def test_run_receipts_produces_finding_with_evidence(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item, sample_finding
):
    from core.evaluators.receipts import run_receipts

    provider = fake_provider_factory(responses=[sample_finding])
    finding = await run_receipts(sample_test_plan_item, sample_case, provider)
    assert isinstance(finding, Finding)
    assert finding.evaluator == "receipts"
    assert finding.claim_id == sample_claim.id
    assert finding.test_id == sample_test_plan_item.id


@pytest.mark.asyncio
async def test_run_receipts_calls_through_llm_provider_not_google_genai_directly(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item, sample_finding
):
    """Architectural guard: nothing talks to google-genai directly outside providers/gemini.py."""
    import sys
    from core.evaluators.receipts import run_receipts

    class ForbiddenModule:
        def __getattr__(self, name):
            raise AssertionError("Direct access to google.genai is forbidden in evaluators!")

    monkeypatch.setitem(sys.modules, "google.genai", ForbiddenModule())

    provider = fake_provider_factory(responses=[sample_finding])
    finding = await run_receipts(sample_test_plan_item, sample_case, provider)
    assert finding.evaluator == "receipts"
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_run_receipts_with_zero_evidence_still_returns_a_finding(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
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

    finding = await run_receipts(sample_test_plan_item, sample_case, provider)
    assert isinstance(finding, Finding)
    assert finding.evaluator == "receipts"
    assert finding.evidence == []
    assert finding.confidence <= 0.35


@pytest.mark.asyncio
async def test_a_finding_with_no_evidence_cannot_silently_become_a_confident_negative(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """Core invariant (backend spec + direction docs):
    'A negative finding with no traceable evidence behind it is the exact failure
    this architecture exists to prevent.'

    Verifies that even if an LLM returns a negative verdict with high confidence,
    empty evidence strictly caps the finding confidence at <= 0.35.
    """
    from core.evaluators.receipts import ReceiptsAssessment, run_receipts

    async def empty_search(c):
        return []

    monkeypatch.setattr("core.evaluators.receipts.search_evidence", empty_search)

    aggressive_negative = ReceiptsAssessment(
        result="The claim is completely false and invalid.",
        reasoning="I believe this is wrong based on general knowledge.",
        confidence=0.95,
        contradiction="Unsupported by standard facts.",
    )
    provider = fake_provider_factory(responses=[aggressive_negative])

    finding = await run_receipts(sample_test_plan_item, sample_case, provider)
    assert finding.evidence == []
    # Structural invariant: must be downgraded to low confidence
    assert finding.confidence <= 0.35


@pytest.mark.asyncio
async def test_run_receipts_with_llm_curation_enabled(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """When use_llm_curation=True, receipts uses curate_snippet_llm for snippets."""
    from core.evaluators.receipts import ReceiptsAssessment, run_receipts
    from core.models import EvidenceItem
    from evidence.curate import CuratedSnippet

    raw_item = EvidenceItem(
        source_url="https://example.com/raw",
        title="Raw Title",
        snippet="Background filler. Crucial sentence confirming the claim. More filler.",
        retrieved_at="2026-09-06T00:00:00Z",
    )

    async def fake_search(c):
        return [raw_item]

    monkeypatch.setattr("core.evaluators.receipts.search_evidence", fake_search)

    curated_response = CuratedSnippet(selected_sentences="Crucial sentence confirming the claim.")
    assessment_response = ReceiptsAssessment(
        result="Direct evidence found",
        reasoning="Curated evidence supports the statement directly.",
        confidence=0.85,
        contradiction=None,
    )

    provider = fake_provider_factory(responses=[curated_response, assessment_response])

    finding = await run_receipts(sample_test_plan_item, sample_case, provider, use_llm_curation=True)
    assert len(provider.calls) == 2
    assert len(finding.evidence) == 1
    assert finding.evidence[0].snippet == "Crucial sentence confirming the claim."
    assert finding.confidence == 0.85


@pytest.mark.asyncio
async def test_run_receipts_with_concurrent_llm_curation_multiple_items(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """Multiple candidate evidence items are curated concurrently and assembled into the final finding."""
    from core.evaluators.receipts import ReceiptsAssessment, run_receipts
    from core.models import EvidenceItem
    from evidence.curate import CuratedSnippet

    items = [
        EvidenceItem(
            source_url=f"https://example.com/item{i}",
            title=f"Title {i}",
            snippet=f"Filler text. Key fact {i} directly supporting claim. Extra padding.",
            retrieved_at="2026-09-06T00:00:00Z",
        )
        for i in range(3)
    ]

    async def fake_search(c):
        return items

    monkeypatch.setattr("core.evaluators.receipts.search_evidence", fake_search)

    curated_responses = [
        CuratedSnippet(selected_sentences=f"Key fact {i} directly supporting claim.")
        for i in range(3)
    ]
    assessment_response = ReceiptsAssessment(
        result="Strong supporting evidence found across all sources",
        reasoning="Multiple corroborating facts confirm the statement.",
        confidence=0.92,
        contradiction=None,
    )

    provider = fake_provider_factory(responses=[*curated_responses, assessment_response])

    finding = await run_receipts(sample_test_plan_item, sample_case, provider, use_llm_curation=True)
    assert len(provider.calls) == 4  # 3 concurrent curations + 1 final receipts assessment
    assert len(finding.evidence) == 3
    for i, ev in enumerate(finding.evidence):
        assert ev.snippet == f"Key fact {i} directly supporting claim."
    assert finding.confidence == 0.92

