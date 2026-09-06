"""
Owner: Dev B. See docs/03-dev-B-evidence-receipts.md hour 2-11 and 11-35.
"""
from __future__ import annotations

import pytest

from core.models import EvidenceItem


@pytest.mark.asyncio
async def test_search_evidence_returns_well_formed_evidence_items(monkeypatch, sample_claim):
    """Mock the Tavily client call itself, not search_evidence — you want to
    prove your wrapper shapes Tavily's raw response into EvidenceItem
    correctly.
    SKELETON:
    from evidence.search import search_evidence
    monkeypatch.setattr("evidence.search._tavily_client.search", fake_tavily_search)
    items = await search_evidence(sample_claim)
    assert all(isinstance(i, EvidenceItem) for i in items)
    assert 1 <= len(items) <= 4  # spec says 3-4 candidate URLs
    """
    pytest.skip("fill in once evidence.search.search_evidence exists")


@pytest.mark.asyncio
async def test_search_evidence_one_query_per_claim(monkeypatch, sample_claim):
    """Cost control: assert the Tavily client is called exactly once for a
    single claim, not once per candidate URL or per retry-that-succeeded.
    """
    pytest.skip("fill in once evidence.search.search_evidence exists")


@pytest.mark.asyncio
async def test_search_evidence_demo_mode_returns_fixture_and_skips_real_call(monkeypatch, sample_claim):
    """The explicit switch from backend spec §5 — DEMO_MODE=True + a claim_id
    present in DEMO_FIXTURES should return the fixture and make ZERO real
    Tavily calls. Assert this with a mock that raises if called, so a
    regression here is loud, not silently falling back to a live call during
    a demo.
    SKELETON:
    monkeypatch.setattr("evidence.search.settings.DEMO_MODE", True)
    monkeypatch.setattr("evidence.search.DEMO_FIXTURES", {sample_claim.id: [some_fixture_item]})
    real_call = mocker.patch("evidence.search._tavily_client.search", side_effect=AssertionError("should not be called"))
    items = await search_evidence(sample_claim)
    real_call.assert_not_called()
    """
    pytest.skip("fill in once evidence.search.search_evidence and DEMO_FIXTURES exist")


@pytest.mark.asyncio
async def test_search_evidence_degrades_gracefully_on_tavily_failure(monkeypatch, sample_claim):
    """A dead/failing Tavily call (after tenacity's retries are exhausted)
    should return an empty list, never raise past this function — that's
    what lets the claim land on `unresolved` instead of crashing the run.
    """
    pytest.skip("fill in once evidence.search.search_evidence exists")
