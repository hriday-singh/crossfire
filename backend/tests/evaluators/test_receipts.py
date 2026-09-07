"""
Owner: Dev B. See docs/03-dev-B-evidence-researcher.md.
"""
from __future__ import annotations

import pytest

from core.models import Finding


@pytest.mark.asyncio
async def test_run_researcher_produces_finding_with_evidence(
    fake_provider_factory, sample_case, sample_claim, sample_test_plan_item, sample_finding
):
    from core.evaluators.researcher import run_researcher

    provider = fake_provider_factory(responses=[sample_finding])
    finding = await run_researcher(sample_test_plan_item, sample_case, provider)
    assert isinstance(finding, Finding)
    assert finding.evaluator in ("researcher", "researcher")
    assert finding.claim_id == sample_claim.id
    assert finding.test_id == sample_test_plan_item.id


@pytest.mark.asyncio
async def test_run_researcher_calls_through_llm_provider_not_google_genai_directly(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item, sample_finding
):
    """Architectural guard: nothing talks to google-genai directly outside providers/gemini.py."""
    import sys
    from core.evaluators.researcher import run_researcher

    class ForbiddenModule:
        def __getattr__(self, name):
            raise AssertionError("Direct access to google.genai is forbidden in evaluators!")

    monkeypatch.setitem(sys.modules, "google.genai", ForbiddenModule())

    provider = fake_provider_factory(responses=[sample_finding])
    finding = await run_researcher(sample_test_plan_item, sample_case, provider)
    assert finding.evaluator in ("researcher", "researcher")
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_run_researcher_with_zero_evidence_still_returns_a_finding(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """When search_evidence + fetch both come back empty, Researcher still produces a Finding."""
    from core.evaluators.researcher import ResearcherAssessment, run_researcher

    async def empty_search(c):
        return []

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", empty_search)

    canned_assessment = ResearcherAssessment(
        result="No external evidence found",
        reasoning="Search yielded zero results.",
        confidence=0.2,
        contradiction=None,
    )
    provider = fake_provider_factory(responses=[canned_assessment])

    finding = await run_researcher(sample_test_plan_item, sample_case, provider)
    assert isinstance(finding, Finding)
    assert finding.evaluator in ("researcher", "researcher")
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
    from core.evaluators.researcher import ResearcherAssessment, run_researcher

    async def empty_search(c):
        return []

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", empty_search)

    aggressive_negative = ResearcherAssessment(
        result="The claim is completely false and invalid.",
        reasoning="I believe this is wrong based on general knowledge.",
        confidence=0.95,
        contradiction="Unsupported by standard facts.",
    )
    provider = fake_provider_factory(responses=[aggressive_negative])

    finding = await run_researcher(sample_test_plan_item, sample_case, provider)
    assert finding.evidence == []
    # Structural invariant: must be downgraded to low confidence
    assert finding.confidence <= 0.35


@pytest.mark.asyncio
async def test_run_researcher_with_llm_curation_enabled(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """When use_llm_curation=True, researcher uses curate_snippet_llm for snippets."""
    from core.evaluators.researcher import ResearcherAssessment, run_researcher
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

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", fake_search)

    curated_response = CuratedSnippet(selected_sentences="Crucial sentence confirming the claim.")
    assessment_response = ResearcherAssessment(
        result="Direct evidence found",
        reasoning="Curated evidence supports the statement directly.",
        confidence=0.85,
        contradiction=None,
    )

    provider = fake_provider_factory(responses=[curated_response, assessment_response])

    finding = await run_researcher(sample_test_plan_item, sample_case, provider, use_llm_curation=True)
    assert len(provider.calls) == 2
    assert len(finding.evidence) == 1
    assert finding.evidence[0].snippet == "Crucial sentence confirming the claim."
    assert finding.confidence == 0.85


@pytest.mark.asyncio
async def test_run_researcher_with_concurrent_llm_curation_multiple_items(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """Multiple candidate evidence items are curated concurrently and assembled into the final finding."""
    from core.evaluators.researcher import ResearcherAssessment, run_researcher
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

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", fake_search)

    curated_responses = [
        CuratedSnippet(selected_sentences=f"Key fact {i} directly supporting claim.")
        for i in range(3)
    ]
    assessment_response = ResearcherAssessment(
        result="Strong supporting evidence found across all sources",
        reasoning="Multiple corroborating facts confirm the statement.",
        confidence=0.92,
        contradiction=None,
    )

    provider = fake_provider_factory(responses=[*curated_responses, assessment_response])

    finding = await run_researcher(sample_test_plan_item, sample_case, provider, use_llm_curation=True)
    assert len(provider.calls) == 4  # 3 concurrent curations + 1 final researcher assessment
    assert len(finding.evidence) == 3
    for i, ev in enumerate(finding.evidence):
        assert ev.snippet == f"Key fact {i} directly supporting claim."
    assert finding.confidence == 0.92



# --- Stage 2/3: only cited sources survive, each carrying a stance ---


@pytest.mark.asyncio
async def test_researcher_keeps_only_the_sources_it_cited(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """All four hits used to be attached whether the evaluator referenced them
    or not, which is what made the drawer four undifferentiated links."""
    from core.evaluators.researcher import CitedSource, ResearcherAssessment, run_researcher
    from core.models import EvidenceItem

    async def fake_search(claim):
        return [
            EvidenceItem(
                source_url=f"https://example.gov/{n}",
                title=f"Doc {n}",
                snippet="The published rule states the limit is four per household.",
                retrieved_at="2026-09-06T00:00:00Z",
            )
            for n in ("used", "ignored")
        ]

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", fake_search)
    provider = fake_provider_factory(
        responses=[
            ResearcherAssessment(
                result="The published limit contradicts the claim",
                reasoning="The rule caps it at four.",
                confidence=0.8,
                contradiction="The rule caps it at four per household",
                cited=[CitedSource(source_url="https://example.gov/used", stance="contradicts")],
            )
        ]
    )

    finding = await run_researcher(sample_test_plan_item, sample_case, provider)

    assert [e.source_url for e in finding.evidence] == ["https://example.gov/used"]
    assert finding.evidence[0].stance == "contradicts"
    assert finding.evidence[0].source_class == "primary"


@pytest.mark.asyncio
async def test_researcher_keeps_everything_when_nothing_was_cited(
    monkeypatch, fake_provider_factory, sample_case, sample_test_plan_item
):
    from core.evaluators.researcher import ResearcherAssessment, run_researcher
    from core.models import EvidenceItem

    async def fake_search(claim):
        return [
            EvidenceItem(
                source_url="https://example.com/a",
                snippet="Some relevant sentence about the claim. And a second one.",
                retrieved_at="2026-09-06T00:00:00Z",
            )
        ]

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", fake_search)
    provider = fake_provider_factory(
        responses=[
            ResearcherAssessment(result="Mixed", reasoning="Unclear.", confidence=0.5, cited=[])
        ]
    )

    finding = await run_researcher(sample_test_plan_item, sample_case, provider)
    assert len(finding.evidence) == 1
    assert finding.evidence[0].stance == "context"


@pytest.mark.asyncio
async def test_researcher_drops_a_contradiction_it_cannot_source(
    monkeypatch, fake_provider_factory, sample_case, sample_test_plan_item
):
    """Stage 1a upstream guard: no evidence means no contradiction to hand the judge."""
    from core.evaluators.researcher import ResearcherAssessment, run_researcher

    async def empty_search(claim):
        return []

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", empty_search)
    provider = fake_provider_factory(
        responses=[
            ResearcherAssessment(
                result="Nothing supports this",
                reasoning="No sources found.",
                confidence=0.9,
                contradiction="Nobody does this",
            )
        ]
    )

    finding = await run_researcher(sample_test_plan_item, sample_case, provider)
    assert finding.contradiction is None
    assert finding.confidence <= 0.35


@pytest.mark.asyncio
async def test_researcher_drops_contradiction_when_nothing_cited(
    monkeypatch, fake_provider_factory, sample_case, sample_test_plan_item
):
    """When sources exist but model cited none of them, keep evidence as context but clear contradiction."""
    from core.evaluators.researcher import ResearcherAssessment, run_researcher
    from core.models import EvidenceItem

    async def fake_search(claim):
        return [
            EvidenceItem(
                source_url="https://example.com/unrelated",
                snippet="Some general background text about the industry.",
                retrieved_at="2026-09-06T00:00:00Z",
            )
        ]

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", fake_search)
    provider = fake_provider_factory(
        responses=[
            ResearcherAssessment(
                result="Contradiction claim",
                reasoning="I believe this is false but did not cite any link.",
                confidence=0.8,
                contradiction="Uncited claim contradiction",
                cited=[],
            )
        ]
    )

    finding = await run_researcher(sample_test_plan_item, sample_case, provider)
    assert len(finding.evidence) == 1
    assert finding.evidence[0].stance == "context"
    assert finding.contradiction is None


# ==============================================================================
# Researcher Persona Enhancement Tests (4 Analytical Constraints)
# ==============================================================================


def test_researcher_system_prompt_contains_all_four_constraints():
    from core.evaluators.researcher import RESEARCHER_SYSTEM_PROMPT

    # 1. Adversarial Query Generation (Debunk search)
    assert "Adversarial Query Generation" in RESEARCHER_SYSTEM_PROMPT
    assert "Debunk" in RESEARCHER_SYSTEM_PROMPT
    assert "complaints" in RESEARCHER_SYSTEM_PROMPT
    assert "churn" in RESEARCHER_SYSTEM_PROMPT

    # 2. Source Authority Tiering (Marketing Mirage)
    assert "Source Authority Tiering" in RESEARCHER_SYSTEM_PROMPT
    assert "Marketing Mirage" in RESEARCHER_SYSTEM_PROMPT
    assert "Tier 1" in RESEARCHER_SYSTEM_PROMPT
    assert "Tier 2" in RESEARCHER_SYSTEM_PROMPT
    assert "Tier 3" in RESEARCHER_SYSTEM_PROMPT
    assert "0.5" in RESEARCHER_SYSTEM_PROMPT

    # 3. Temporal Decay (Data Freshness)
    assert "Temporal Decay" in RESEARCHER_SYSTEM_PROMPT
    assert "18-24 months" in RESEARCHER_SYSTEM_PROMPT
    assert "weakened" in RESEARCHER_SYSTEM_PROMPT
    assert "Data Staleness" in RESEARCHER_SYSTEM_PROMPT

    # 4. Competitor Triangulation
    assert "Competitor Triangulation" in RESEARCHER_SYSTEM_PROMPT
    assert "competitor" in RESEARCHER_SYSTEM_PROMPT
    assert "market leader" in RESEARCHER_SYSTEM_PROMPT


def test_researcher_backward_compatibility_aliases():
    from core.evaluators.researcher import (
        RECEIPTS_SYSTEM_PROMPT,
        RESEARCHER_SYSTEM_PROMPT,
        ResearcherAssessment,
        ResearcherAssessment,
        run_researcher,
        run_researcher,
    )

    assert run_researcher is run_researcher
    assert ResearcherAssessment is ResearcherAssessment
    assert RECEIPTS_SYSTEM_PROMPT == RESEARCHER_SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_researcher_marketing_mirage_caps_confidence_and_flags_reasoning(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """Source Authority Tiering: When only Tier 3 sources are found, confidence must be capped at <= 0.5
    and reasoning must explicitly flag 'Marketing Mirage'."""
    from core.evaluators.researcher import CitedSource, ResearcherAssessment, run_researcher
    from core.models import EvidenceItem

    # Provide only blog / marketing sources (Tier 3)
    marketing_items = [
        EvidenceItem(
            source_url="https://vendor-blog.com/promotional-post",
            title="Why Our Product Outperforms Everyone",
            snippet="Our proprietary benchmarks show 10x speed improvements over all competitors.",
            retrieved_at="2026-09-06T00:00:00Z",
            source_class="blog",
        )
    ]

    async def fake_search(c, query_override=None):
        return marketing_items

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", fake_search)

    # Model returned a confident assessment based on Tier 3 evidence
    overconfident_assessment = ResearcherAssessment(
        result="Benchmarks prove 10x improvement",
        reasoning="Vendor documentation confirms 10x speed boost.",
        confidence=0.9,
        contradiction=None,
        cited=[CitedSource(source_url="https://vendor-blog.com/promotional-post", stance="supports", tier=3)],
    )
    provider = fake_provider_factory(responses=[overconfident_assessment])

    finding = await run_researcher(sample_test_plan_item, sample_case, provider)
    assert finding.evaluator in ("researcher", "researcher")
    # Structural invariant: confidence capped at <= 0.5 for pure Tier 3
    assert finding.confidence <= 0.5
    # Structural invariant: reasoning must flag Marketing Mirage
    assert "Marketing Mirage" in finding.reasoning


@pytest.mark.asyncio
async def test_researcher_temporal_decay_downgrades_to_weakened_and_notes_data_staleness(
    monkeypatch, fake_provider_factory, sample_case, sample_claim, sample_test_plan_item
):
    """Temporal Decay: If core evidence is > 18-24 months old, verdict is downgraded to 'weakened'
    and 'Data Staleness' is noted in contradiction."""
    from core.evaluators.researcher import CitedSource, ResearcherAssessment, run_researcher
    from core.models import EvidenceItem

    stale_items = [
        EvidenceItem(
            source_url="https://tech-reviews.org/2023-survey",
            title="2023 Industry Survey",
            snippet="Published January 2023: Initial adoption metrics showed positive consumer interest across institutions. A follow-up study confirmed historical baseline numbers were solid at that time.",
            retrieved_at="2026-09-06T00:00:00Z",
            source_class="institutional",
        )
    ]


    async def fake_search(c, query_override=None):
        return stale_items

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", fake_search)

    stale_assessment = ResearcherAssessment(
        result="Survey shows positive adoption",
        reasoning="2023 survey indicates early adoption.",
        confidence=0.7,
        contradiction="Data Staleness: Survey data is from 2023, exceeding 24 months old.",
        cited=[CitedSource(source_url="https://tech-reviews.org/2023-survey", stance="supports", tier=1)],
    )
    provider = fake_provider_factory(responses=[stale_assessment])

    finding = await run_researcher(sample_test_plan_item, sample_case, provider)
    assert finding.evaluator in ("researcher", "researcher")
    # Invariant: result must reflect weakened
    assert "weakened" in finding.result.lower()
    # Invariant: contradiction must record Data Staleness
    assert finding.contradiction is not None
    assert "Data Staleness" in finding.contradiction


@pytest.mark.asyncio
async def test_researcher_competitor_triangulation_triggers_on_uniqueness_claim(
    monkeypatch, fake_provider_factory, sample_case
):
    """Competitor Triangulation: Claims asserting uniqueness trigger a secondary competitor search."""
    from core.evaluators.researcher import ResearcherAssessment, run_researcher
    from core.models import Claim, EvidenceItem, TestPlanItem

    # Claim asserting uniqueness
    unique_claim = Claim(
        id="c-unique",
        statement="We are the only platform offering automated instant tax reconciliations",
        load_bearing=True,
    )
    sample_case.claims.append(unique_claim)

    item = TestPlanItem(
        id="t-unique",
        target_claim="c-unique",
        failure_mode="evidence",
        objective="Verify uniqueness of automated tax reconciliations",
    )

    searched_queries = []

    async def tracking_search(claim, query_override=None):
        searched_queries.append(query_override or claim.statement)
        return [
            EvidenceItem(
                source_url=f"https://example.com/result-{len(searched_queries)}",
                title="Search Result",
                snippet="Market leader Intuit already launched automated instant tax reconciliation in 2024.",
                retrieved_at="2026-09-06T00:00:00Z",
                source_class="web",
            )
        ]

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", tracking_search)

    assessment = ResearcherAssessment(
        result="Competitor Intuit already offers instant tax reconciliation",
        reasoning="Market leader already provides the feature.",
        confidence=0.85,
        contradiction="Intuit offers the exact same capability",
        cited=[],
    )
    provider = fake_provider_factory(responses=[assessment])

    finding = await run_researcher(item, sample_case, provider)
    assert finding.evaluator in ("researcher", "researcher")
    # Verified: secondary search query was executed
    assert len(searched_queries) >= 2
    # Check that competitor triangulation terms were in the second search query
    assert any("competitor" in q.lower() or "market leader" in q.lower() for q in searched_queries)


