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
    from evidence.search import search_evidence, settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "")

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
    from evidence.search import search_evidence, settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "")
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
    from evidence.search import search_evidence, settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "")

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


# --- Stage 2: keyword queries and source ranking ---


def test_build_query_strips_predictive_framing():
    """search_evidence used to post the full sentence, which is why Researcher kept
    landing on 'inconclusive'."""
    from evidence.search import build_query

    q = build_query("We assume that students will be willing to pay $20 per month for this")
    assert "assume" not in q
    assert "will" not in q.split()
    assert "$20" in q
    assert "students" in q


def test_build_query_is_domain_neutral():
    """Same shape of claim, three unrelated subjects — all keep their specifics."""
    from evidence.search import build_query

    assert "stairs" in build_query("I expect that my mother can still manage the stairs alone")
    assert "Novolog" in build_query("We believe the Novolog copay will stay under $35 a month")
    assert "Kubernetes" in build_query("The API will scale on Kubernetes to 10k concurrent users")


def test_build_query_caps_length_and_never_returns_empty():
    from evidence.search import build_query

    long_claim = " ".join(f"word{i}" for i in range(40))
    assert len(build_query(long_claim).split()) <= 8
    assert build_query("we will do it").strip()  # all-stopword input still searches something


def test_classify_source_ranks_by_authority_not_by_a_domain_list():
    from evidence.search import classify_source

    assert classify_source("https://www.uscis.gov/terms") == "primary"
    assert classify_source("https://docs.stripe.com/checkout") == "primary"
    assert classify_source("https://www.gov.uk/visas") == "primary"
    assert classify_source("https://mit.edu/study") == "institutional"
    assert classify_source("https://who.org/guidance") == "institutional"
    assert classify_source("https://www.reddit.com/r/x") == "community"
    assert classify_source("https://someone.medium.com/post") == "blog"
    assert classify_source("https://ryter.pro/article") == "web"
    assert classify_source("not a url") == "web"


def test_rank_by_source_class_puts_authority_first():
    from core.models import EvidenceItem
    from evidence.search import rank_by_source_class

    def item(url):
        return EvidenceItem(source_url=url, snippet="s", retrieved_at="2026-09-06T00:00:00Z")

    ranked = rank_by_source_class(
        [item("https://blog.example.com/a"), item("https://example.gov/b"), item("https://x.edu/c")]
    )
    assert [i.source_class for i in ranked] == ["primary", "institutional", "blog"]


@pytest.mark.asyncio
async def test_search_evidence_sends_keywords_not_the_sentence(monkeypatch, sample_claim):
    from evidence.search import search_evidence, settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "")

    sent: list[str] = []

    async def fake_search(query: str) -> str:
        sent.append(query)
        return SAMPLE_DDG_HTML

    monkeypatch.setattr("evidence.search._execute_search", fake_search)
    await search_evidence(sample_claim)
    assert sent and sent[0] != sample_claim.statement
    assert len(sent[0].split()) <= 8


def test_parse_serpapi_response_extracts_organic_results():
    from evidence.search import parse_serpapi_response

    sample_serpapi = {
        "organic_results": [
            {
                "position": 1,
                "title": "Official Policy Guide",
                "link": "https://agency.gov/policy",
                "snippet": "Official government regulations on automated submissions.",
            },
            {
                "position": 2,
                "title": "Industry Analysis",
                "link": "https://example.edu/paper",
                "snippet": "Academic analysis of workflow integrity.",
            },
        ]
    }
    items = parse_serpapi_response(sample_serpapi, max_results=2)
    assert len(items) == 2
    assert items[0].source_url == "https://agency.gov/policy"
    assert items[0].title == "Official Policy Guide"
    assert items[0].snippet == "Official government regulations on automated submissions."
    assert items[0].provider == "serpapi"
    assert items[1].provider == "serpapi"


def test_parse_serpapi_response_detects_quota_exhaustion():
    import pytest
    from evidence.search import SerpApiQuotaExceededError, parse_serpapi_response

    quota_error_payload = {
        "error": "Your account has run out of searches."
    }
    with pytest.raises(SerpApiQuotaExceededError):
        parse_serpapi_response(quota_error_payload)


@pytest.mark.asyncio
async def test_search_evidence_defaults_to_duckduckgo_even_when_serpapi_key_present(monkeypatch, sample_claim):
    """By default, search_evidence prioritizes DuckDuckGo Lite via Scrapling and does not call SerpApi."""
    from evidence.search import search_evidence, settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "test-serp-key")
    monkeypatch.setattr(settings, "SEARCH_PROVIDER", "duckduckgo")

    serp_called = False

    async def fake_serpapi(query: str, api_key: str, max_results: int = 4):
        nonlocal serp_called
        serp_called = True
        return []

    ddg_called = False

    async def fake_ddg_search(query: str) -> str:
        nonlocal ddg_called
        ddg_called = True
        return SAMPLE_DDG_HTML

    monkeypatch.setattr("evidence.search._execute_serpapi_search", fake_serpapi)
    monkeypatch.setattr("evidence.search._execute_search", fake_ddg_search)

    items = await search_evidence(sample_claim)
    assert ddg_called is True
    assert serp_called is False
    assert len(items) == 3
    assert all(i.provider == "duckduckgo" for i in items)


@pytest.mark.asyncio
async def test_search_evidence_uses_serpapi_when_key_present(monkeypatch, sample_claim):
    from evidence.search import search_evidence, settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "test-serp-key")
    monkeypatch.setattr(settings, "SEARCH_PROVIDER", "serpapi")

    async def fake_serpapi(query: str, api_key: str, max_results: int = 4):
        return [
            EvidenceItem(
                source_url="https://docs.example.com/api",
                title="SerpApi Result",
                snippet="Snipped returned via SerpApi.",
                retrieved_at="2026-09-06T00:00:00Z",
                provider="serpapi",
            )
        ]

    def should_not_be_called(query: str):
        raise AssertionError("DuckDuckGo should not be called when SerpApi succeeds")

    monkeypatch.setattr("evidence.search._execute_serpapi_search", fake_serpapi)
    monkeypatch.setattr("evidence.search._execute_search", should_not_be_called)

    items = await search_evidence(sample_claim)
    assert len(items) == 1
    assert items[0].provider == "serpapi"
    assert items[0].source_url == "https://docs.example.com/api"


@pytest.mark.asyncio
async def test_search_evidence_falls_back_to_ddg_on_serpapi_quota_exhausted(monkeypatch, sample_claim):
    from evidence.search import SerpApiQuotaExceededError, search_evidence, settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "test-serp-key")
    monkeypatch.setattr(settings, "SEARCH_PROVIDER", "serpapi")

    async def failing_serpapi(query: str, api_key: str, max_results: int = 4):
        raise SerpApiQuotaExceededError("Account has run out of searches (HTTP 429)")

    ddg_called = False

    async def fake_ddg_search(query: str) -> str:
        nonlocal ddg_called
        ddg_called = True
        return SAMPLE_DDG_HTML

    monkeypatch.setattr("evidence.search._execute_serpapi_search", failing_serpapi)
    monkeypatch.setattr("evidence.search._execute_search", fake_ddg_search)

    items = await search_evidence(sample_claim)
    assert ddg_called is True
    assert len(items) == 3
    assert all(i.provider == "duckduckgo" for i in items)


@pytest.mark.asyncio
async def test_search_evidence_falls_back_to_ddg_on_serpapi_error(monkeypatch, sample_claim):
    from evidence.search import SerpApiError, search_evidence, settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "test-serp-key")
    monkeypatch.setattr(settings, "SEARCH_PROVIDER", "serpapi")

    async def failing_serpapi(query: str, api_key: str, max_results: int = 4):
        raise SerpApiError("SerpApi HTTP 500 error")

    ddg_called = False

    async def fake_ddg_search(query: str) -> str:
        nonlocal ddg_called
        ddg_called = True
        return SAMPLE_DDG_HTML

    monkeypatch.setattr("evidence.search._execute_serpapi_search", failing_serpapi)
    monkeypatch.setattr("evidence.search._execute_search", fake_ddg_search)

    items = await search_evidence(sample_claim)
    assert ddg_called is True
    assert len(items) == 3
    assert all(i.provider == "duckduckgo" for i in items)


@pytest.mark.asyncio
async def test_search_evidence_defaults_to_ddg_when_key_empty(monkeypatch, sample_claim):
    from evidence.search import search_evidence, settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "")

    def should_not_be_called(*args, **kwargs):
        raise AssertionError("SerpApi should not be called when API key is empty")

    ddg_called = False

    async def fake_ddg_search(query: str) -> str:
        nonlocal ddg_called
        ddg_called = True
        return SAMPLE_DDG_HTML

    monkeypatch.setattr("evidence.search._execute_serpapi_search", should_not_be_called)
    monkeypatch.setattr("evidence.search._execute_search", fake_ddg_search)

    items = await search_evidence(sample_claim)
    assert ddg_called is True
    assert len(items) == 3
    assert all(i.provider == "duckduckgo" for i in items)
