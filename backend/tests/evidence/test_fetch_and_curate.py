"""
Owner: Dev B. Covers evidence/fetch.py (Scrapling) and evidence/curate.py.
See docs/03-dev-B-evidence-receipts.md hour 11-35.
"""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_deep_fetch_only_triggered_for_load_bearing_thin_snippet(
    monkeypatch, sample_claim, sample_test_plan_item, fake_provider_factory, sample_finding
):
    """Adaptive scrutiny, backend spec §5: Scrapling only runs when
    claim.load_bearing is True AND the Tavily snippet isn't strong enough.
    Assert fetch() is NOT called for a non-load-bearing claim, and IS called
    for a load-bearing one with a thin snippet."""
    from core.evaluators.receipts import run_receipts
    from core.models import Claim, EvidenceItem

    fetch_calls: list[str] = []

    async def fake_fetch(url: str) -> str:
        fetch_calls.append(url)
        return "Full page text containing detailed evidence."

    monkeypatch.setattr("core.evaluators.receipts.fetch_page", fake_fetch)

    # 1. Non-load-bearing claim: should NOT trigger deep fetch
    non_lb_claim = Claim(id="c-non-lb", statement="Test statement", load_bearing=False)
    thin_item = EvidenceItem(
        source_url="https://example.com/item1",
        title="Title 1",
        snippet="Short snippet.",
        retrieved_at="2026-09-06T00:00:00Z",
    )

    async def fake_search(c):
        return [
            EvidenceItem(
                source_url="https://example.com/item1",
                title="Title 1",
                snippet="Short snippet.",
                retrieved_at="2026-09-06T00:00:00Z",
            )
        ]

    monkeypatch.setattr("core.evaluators.receipts.search_evidence", fake_search)
    provider = fake_provider_factory(responses=[sample_finding])

    await run_receipts(non_lb_claim, sample_test_plan_item, provider)
    assert len(fetch_calls) == 0

    # 2. Load-bearing claim with thin snippet: MUST trigger deep fetch
    lb_claim = Claim(id="c-lb", statement="Test statement", load_bearing=True)
    provider2 = fake_provider_factory(responses=[sample_finding])

    await run_receipts(lb_claim, sample_test_plan_item, provider2)
    assert len(fetch_calls) == 1
    assert fetch_calls[0] == "https://example.com/item1"


@pytest.mark.asyncio
async def test_deep_fetch_never_targets_a_search_engine_results_page():
    """Structural guard: Scrapling must never fetch a SERP directly."""
    from evidence.fetch import fetch_page

    with pytest.raises(ValueError, match="search engine"):
        await fetch_page("https://www.google.com/search?q=test")

    with pytest.raises(ValueError, match="search engine"):
        await fetch_page("https://bing.com/search?q=test")

    with pytest.raises(ValueError, match="search engine"):
        await fetch_page("https://www.google.co.uk/search?q=test")


@pytest.mark.asyncio
async def test_fetch_page_rejects_ssrf_private_ips():
    from evidence.fetch import fetch_page

    with pytest.raises(ValueError, match="private or unsafe"):
        await fetch_page("http://127.0.0.1:8000/internal")

    with pytest.raises(ValueError, match="private or unsafe"):
        await fetch_page("http://169.254.169.254/latest/meta-data/")

    with pytest.raises(ValueError, match="private or unsafe"):
        await fetch_page("http://localhost:8080/secrets")



@pytest.mark.asyncio
async def test_fetch_failure_drops_the_source_without_crashing(
    monkeypatch, sample_claim, sample_test_plan_item, fake_provider_factory, sample_finding
):
    """A dead link or wall drops the source without crashing, producing a Finding."""
    from core.evaluators.receipts import run_receipts
    from evidence.fetch import fetch_page

    async def failing_fetch(url: str) -> str:
        raise ConnectionError("Dead link")

    monkeypatch.setattr("evidence.fetch._do_fetch", failing_fetch)
    res = await fetch_page("https://example.com/broken")
    assert res == ""

    # In receipts, zero search results still return a Finding
    async def empty_search(c):
        return []

    monkeypatch.setattr("core.evaluators.receipts.search_evidence", empty_search)
    provider = fake_provider_factory(responses=[sample_finding])
    finding = await run_receipts(sample_claim, sample_test_plan_item, provider)
    assert finding is not None
    assert finding.evaluator == "receipts"


@pytest.mark.asyncio
async def test_fetch_page_times_out_strictly_and_returns_empty(monkeypatch):
    import asyncio
    from evidence.fetch import fetch_page

    async def hanging_fetch(url: str) -> str:
        await asyncio.sleep(2.0)
        return "too late"

    monkeypatch.setattr("evidence.fetch._do_fetch", hanging_fetch)
    # Using 0.05s timeout to test timeout handling quickly without slowing test suite
    res = await fetch_page("https://example.com/slow", timeout=0.05)
    assert res == ""


def test_curate_truncates_to_relevant_sentences(sample_claim):
    """curate() reduces arbitrary text down to 1-3 sentences relevant to the claim."""
    from evidence.curate import curate

    long_text = "Irrelevant filler. " * 50 + "The actual relevant sentence about the claim." + " More filler." * 50
    result = curate(long_text, sample_claim)
    assert "actual relevant sentence" in result
    assert len(result) < len(long_text) / 2


def test_curate_never_passes_full_page_through_untouched(sample_claim):
    """Nothing beyond the curated snippet reaches the LLM prompt."""
    from evidence.curate import curate

    long_page = "Some general filler sentence here. " * 100
    result = curate(long_page, sample_claim)
    assert result != long_page
    assert len(result) < len(long_page)
    # Never passes entire page, bounded in length
    assert len(result) <= 600


@pytest.mark.asyncio
async def test_curate_snippet_llm_success(fake_provider_factory, sample_claim):
    """curate_snippet_llm calls through provider and extracts relevant sentences."""
    from evidence.curate import CuratedSnippet, curate_snippet_llm

    fake_response = CuratedSnippet(
        selected_sentences="Official regulations require applicants to apply directly in person."
    )
    provider = fake_provider_factory(responses=[fake_response])
    raw_text = (
        "Introductory text. Official regulations require applicants to apply directly in person. Additional background."
    )
    result = await curate_snippet_llm(raw_text, sample_claim, provider=provider)
    assert result == "Official regulations require applicants to apply directly in person."
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_curate_snippet_llm_falls_back_on_exception(sample_claim):
    """If provider raises, curate_snippet_llm degrades cleanly to heuristic."""
    from evidence.curate import curate_snippet_llm

    class FailingProvider:
        async def generate(self, **kwargs):
            raise RuntimeError("API timeout or outage")

    raw_text = (
        "Irrelevant filler. " * 20
        + f"Crucial evidence regarding {sample_claim.statement}."
        + " More irrelevant filler." * 20
    )
    result = await curate_snippet_llm(raw_text, sample_claim, provider=FailingProvider())
    assert "Crucial evidence" in result
    assert len(result) <= 600


@pytest.mark.asyncio
async def test_curate_snippet_llm_enforces_sentence_and_char_limits(fake_provider_factory, sample_claim):
    """Even if LLM returns a verbose response, output is strictly clamped to 1-3 sentences and <= 600 chars."""
    from evidence.curate import CuratedSnippet, curate_snippet_llm

    verbose_response = CuratedSnippet(
        selected_sentences=". ".join([f"Sentence {i} with some detailed words" for i in range(10)]) + "."
    )
    provider = fake_provider_factory(responses=[verbose_response])
    result = await curate_snippet_llm("Some raw text", sample_claim, provider=provider)
    sentences = [s for s in result.split(". ") if s.strip()]
    assert len(sentences) <= 3
    assert len(result) <= 600
