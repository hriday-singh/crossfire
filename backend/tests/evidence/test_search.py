"""
Owner: Dev B. See docs/03-dev-B-evidence-receipts.md hour 2-11 and 11-35.
"""
from __future__ import annotations

import pytest

from core.models import EvidenceItem


@pytest.mark.asyncio
async def test_search_evidence_returns_well_formed_evidence_items(monkeypatch, sample_claim):
    """Mock the Tavily client call itself, not search_evidence — proves wrapper
    shapes Tavily's raw response into EvidenceItem correctly."""
    from evidence.search import search_evidence

    fake_results = {
        "results": [
            {
                "url": "https://example.com/item1",
                "title": "Item 1",
                "content": "This is content 1 for the claim.",
            },
            {
                "url": "https://example.com/item2",
                "title": "Item 2",
                "content": "This is content 2 for the claim.",
            },
        ]
    }
    monkeypatch.setattr("evidence.search._tavily_client.search", lambda **kwargs: fake_results)
    items = await search_evidence(sample_claim)
    assert all(isinstance(i, EvidenceItem) for i in items)
    assert len(items) == 2
    assert items[0].source_url == "https://example.com/item1"
    assert items[0].title == "Item 1"
    assert items[0].snippet == "This is content 1 for the claim."
    assert items[0].retrieved_at is not None


@pytest.mark.asyncio
async def test_search_evidence_one_query_per_claim(monkeypatch, sample_claim):
    """Cost control: assert the Tavily client is called exactly once for a
    single claim, not once per candidate URL or per retry-that-succeeded."""
    from evidence.search import search_evidence

    call_count = 0

    def fake_search(**kwargs):
        nonlocal call_count
        call_count += 1
        return {
            "results": [
                {"url": "https://example.com/1", "title": "1", "content": "C1"},
                {"url": "https://example.com/2", "title": "2", "content": "C2"},
            ]
        }

    monkeypatch.setattr("evidence.search._tavily_client.search", fake_search)
    items = await search_evidence(sample_claim)
    assert call_count == 1
    assert len(items) == 2


@pytest.mark.asyncio
async def test_search_evidence_demo_mode_returns_fixture_and_skips_real_call(monkeypatch, sample_claim):
    """DEMO_MODE=True + a claim_id present in DEMO_FIXTURES returns the fixture
    and makes ZERO real Tavily calls."""
    from evidence.search import DEMO_FIXTURES, search_evidence

    fixture_item = EvidenceItem(
        source_url="https://demo.example.com",
        title="Demo Fixture Title",
        snippet="Pre-captured demo evidence.",
        retrieved_at="2026-09-06T00:00:00Z",
    )
    monkeypatch.setattr("evidence.search.settings.DEMO_MODE", True)
    monkeypatch.setattr("evidence.search.DEMO_FIXTURES", {sample_claim.id: [fixture_item]})

    def should_not_be_called(**kwargs):
        raise AssertionError("Tavily search should not be called in demo mode with matching fixture")

    monkeypatch.setattr("evidence.search._tavily_client.search", should_not_be_called)
    items = await search_evidence(sample_claim)
    assert items == [fixture_item]


@pytest.mark.asyncio
async def test_search_evidence_degrades_gracefully_on_tavily_failure(monkeypatch, sample_claim):
    """A dead/failing Tavily call returns an empty list, never raises past this function."""
    from evidence.search import search_evidence

    def failing_search(**kwargs):
        raise ConnectionError("Tavily network failure")

    monkeypatch.setattr("evidence.search._tavily_client.search", failing_search)
    items = await search_evidence(sample_claim)
    assert items == []
