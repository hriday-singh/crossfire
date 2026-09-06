"""
Owner: Dev B. Tests for web URL ingestion (ingestion/url.py).
Covers Scrapling page fetching, SERP protection, claim-based curation, and failure handling.
"""
from __future__ import annotations

import pytest

from core.models import Claim
from ingestion.url import ingest_url


@pytest.mark.asyncio
async def test_ingest_url_success_with_bounded_text(monkeypatch):
    """Ingests a standard web page and bounds it to 2000 chars when no claim statement is provided."""
    async def fake_fetch(url: str) -> str:
        return "This is a detailed analysis of market trends. " * 60

    monkeypatch.setattr("ingestion.url.fetch_page", fake_fetch)

    result = await ingest_url("https://example.com/trends")
    assert result.startswith("This is a detailed analysis")
    assert len(result) <= 2003
    assert result.endswith("...")


@pytest.mark.asyncio
async def test_ingest_url_with_claim_curation(monkeypatch, sample_claim):
    """When a claim statement is provided, ingest_url extracts only 1-3 relevant sentences."""
    async def fake_fetch(url: str) -> str:
        return (
            "Filler background statement that has nothing to do with the topic. "
            f"Key regulation regarding {sample_claim.statement}. "
            "Another irrelevant sentence."
        )

    monkeypatch.setattr("ingestion.url.fetch_page", fake_fetch)

    result = await ingest_url("https://example.com/policy", claim_statement=sample_claim)
    assert f"Key regulation regarding {sample_claim.statement}." in result
    assert len(result) < 300


@pytest.mark.asyncio
async def test_ingest_url_with_llm_provider(monkeypatch, sample_claim, fake_provider_factory):
    """When a provider is passed, ingest_url uses curate_snippet_llm."""
    from evidence.curate import CuratedSnippet

    async def fake_fetch(url: str) -> str:
        return "Full text content with lots of facts."

    monkeypatch.setattr("ingestion.url.fetch_page", fake_fetch)

    fake_snippet = CuratedSnippet(selected_sentences="Official confirmation of the stated claim.")
    provider = fake_provider_factory(responses=[fake_snippet])

    result = await ingest_url(
        "https://example.com/source",
        claim_statement=sample_claim,
        provider=provider,
    )
    assert result == "Official confirmation of the stated claim."
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_ingest_url_rejects_serp_domains():
    """Structural invariant: SERP pages are strictly rejected with ValueError."""
    with pytest.raises(ValueError, match="search engine"):
        await ingest_url("https://www.google.com/search?q=visa+rules")

    with pytest.raises(ValueError, match="search engine"):
        await ingest_url("https://duckduckgo.com/?q=test")


@pytest.mark.asyncio
async def test_ingest_url_degrades_gracefully_on_network_error(monkeypatch):
    """Network failures return an empty string instead of raising an exception."""
    async def failing_fetch(url: str) -> str:
        raise ConnectionError("Timeout contacting server")

    monkeypatch.setattr("ingestion.url.fetch_page", failing_fetch)

    result = await ingest_url("https://example.com/unreachable")
    assert result == ""
