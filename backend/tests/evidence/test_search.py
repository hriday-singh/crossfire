"""
Owner: Dev B. Evidence Pipeline Search Tests.
Covers DuckDuckGo Lite search via Scrapling/curl-cffi and HTML parsing into EvidenceItems.
"""
from __future__ import annotations

import pytest

from core.models import EvidenceItem


SAMPLE_DDG_HTML = """
<html>
<body>
  <table border="0">
    <tr>
      <td valign="top">1.&nbsp;</td>
      <td>
        <a rel="nofollow" href="https://example.com/article-1" class="result-link">First Result Title</a>
      </td>
    </tr>
    <tr>
      <td>&nbsp;&nbsp;&nbsp;</td>
      <td class="result-snippet">
        This is the snippet for the <b>first</b> result with some extra facts.
      </td>
    </tr>
    <tr>
      <td valign="top">2.&nbsp;</td>
      <td>
        <a rel="nofollow" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Ftarget-page&rut=123" class="result-link">Second Result With Redirect</a>
      </td>
    </tr>
    <tr>
      <td>&nbsp;&nbsp;&nbsp;</td>
      <td class="result-snippet">
        Snippet for second result with detailed context.
      </td>
    </tr>
    <tr>
      <td valign="top">3.&nbsp;</td>
      <td>
        <a rel="nofollow" href="https://example.net/page-3" class="result-link">Third Result Title</a>
      </td>
    </tr>
    <tr>
      <td>&nbsp;&nbsp;&nbsp;</td>
      <td class="result-snippet">
        Snippet for third result.
      </td>
    </tr>
  </table>
</body>
</html>
"""


def test_parse_duckduckgo_lite_html():
    """Parses DuckDuckGo Lite HTML into well-formed EvidenceItems, decoding redirect URLs and extracting snippets."""
    from evidence.search import parse_duckduckgo_lite_html

    items = parse_duckduckgo_lite_html(SAMPLE_DDG_HTML, max_results=2)
    assert len(items) == 2
    assert all(isinstance(i, EvidenceItem) for i in items)

    # First item: direct URL
    assert items[0].source_url == "https://example.com/article-1"
    assert items[0].title == "First Result Title"
    assert "snippet for the first result" in items[0].snippet

    # Second item: decoded redirect URL
    assert items[1].source_url == "https://example.org/target-page"
    assert items[1].title == "Second Result With Redirect"
    assert "Snippet for second result" in items[1].snippet
    assert items[1].retrieved_at is not None


def test_clean_ddg_url_preserves_query_parameters_and_html_entities():
    from evidence.search import _clean_ddg_url

    raw_url = "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpath%3Fparam1%3Dval1%26param2%3Dval2&amp;rut=1"
    cleaned = _clean_ddg_url(raw_url)
    assert cleaned == "https://example.com/path?param1=val1&param2=val2"



@pytest.mark.asyncio
async def test_search_evidence_returns_well_formed_evidence_items(monkeypatch, sample_claim):
    """Mock raw search response to verify search_evidence parses and returns EvidenceItems correctly."""
    from evidence.search import search_evidence

    async def fake_search(query: str) -> str:
        return SAMPLE_DDG_HTML

    monkeypatch.setattr("evidence.search._execute_search", fake_search)
    items = await search_evidence(sample_claim)
    assert all(isinstance(i, EvidenceItem) for i in items)
    assert len(items) == 3
    # Stage 2: authority-ranked, not page-ranked — .org (institutional) leads .com (web).
    assert items[0].source_url == "https://example.org/target-page"
    assert items[0].source_class == "institutional"
    assert {i.source_url for i in items} >= {
        "https://example.com/article-1",
        "https://example.org/target-page",
    }


@pytest.mark.asyncio
async def test_search_evidence_one_query_per_claim(monkeypatch, sample_claim):
    """Cost/bandwidth control: assert search execution is called exactly once for a single claim."""
    from evidence.search import search_evidence

    call_count = 0

    async def fake_search(query: str) -> str:
        nonlocal call_count
        call_count += 1
        return SAMPLE_DDG_HTML

    monkeypatch.setattr("evidence.search._execute_search", fake_search)
    items = await search_evidence(sample_claim)
    assert call_count == 1
    assert len(items) == 3


@pytest.mark.asyncio
async def test_search_evidence_demo_mode_returns_fixture_and_skips_real_call(monkeypatch, sample_claim):
    """DEMO_MODE=True + a claim_id present in DEMO_FIXTURES returns the fixture and makes ZERO search calls."""
    from evidence.search import DEMO_FIXTURES, search_evidence

    fixture_item = EvidenceItem(
        source_url="https://demo.example.com",
        title="Demo Fixture Title",
        snippet="Pre-captured demo evidence.",
        retrieved_at="2026-09-06T00:00:00Z",
    )
    monkeypatch.setattr("evidence.search.settings.DEMO_MODE", True)
    monkeypatch.setattr("evidence.search.DEMO_FIXTURES", {sample_claim.id: [fixture_item]})

    def should_not_be_called(query: str):
        raise AssertionError("Search should not be called in demo mode with matching fixture")

    monkeypatch.setattr("evidence.search._execute_search", should_not_be_called)
    items = await search_evidence(sample_claim)
    assert items == [fixture_item]


@pytest.mark.asyncio
async def test_search_evidence_degrades_gracefully_on_failure(monkeypatch, sample_claim):
    """A dead/failing search call returns an empty list, never raises past this function."""
    from evidence.search import search_evidence

    async def failing_search(query: str) -> str:
        raise ConnectionError("Search network failure")

    monkeypatch.setattr("evidence.search._execute_search", failing_search)
    items = await search_evidence(sample_claim)
    assert items == []


@pytest.mark.asyncio
async def test_search_evidence_uses_preloaded_demo_fixtures(monkeypatch):
    """Verifies that built-in DEMO_FIXTURES entries for demo anchor claims work in DEMO_MODE."""
    from core.models import Claim
    from evidence.search import DEMO_FIXTURES, search_evidence

    monkeypatch.setattr("evidence.search.settings.DEMO_MODE", True)

    def should_not_be_called(query: str):
        raise AssertionError("Network search triggered while matching DEMO_FIXTURE exists")

    monkeypatch.setattr("evidence.search._execute_search", should_not_be_called)

    demo_claim = Claim(id="claim-abc123", statement="Some statement")
    items = await search_evidence(demo_claim)
    assert len(items) == len(DEMO_FIXTURES["claim-abc123"])
    assert "USCIS" in items[0].title
    assert "strictly prohibited" in items[0].snippet
