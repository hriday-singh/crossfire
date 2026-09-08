"""
Owner: Dev B. DuckDuckGo search wrapper via Scrapling.
Extracts external evidence items with search_depth='basic' equivalent (1 query per claim).
Wrapped in tenacity retry for transient network failures.
"""
from __future__ import annotations

import asyncio
import html
import inspect
import json
import logging
import re
import time
import urllib.parse
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any

from tenacity import (
    retry,
    retry_if_not_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from pydantic import BaseModel, Field

from config import get_settings
from core.models import Claim, EvidenceItem

logger = logging.getLogger(__name__)


class SerpApiError(Exception):
    """Base exception for SerpApi errors."""
    pass


class SerpApiQuotaExceededError(SerpApiError):
    """Raised when SerpApi credits are exhausted (HTTP 429 or quota limit error)."""
    pass


class SettingsProxy:
    """Delegates to base settings while allowing dynamic overrides (e.g. DEMO_MODE, SERPAPI_API_KEY)
    for testing and runtime switches."""

    def __init__(self, base: Any) -> None:
        object.__setattr__(self, "_base", base)

    def __getattr__(self, name: str) -> Any:
        if name in ("DEMO_MODE", "demo_mode"):
            return getattr(self._base, "demo_mode", False)
        if name in ("SERPAPI_API_KEY", "serpapi_api_key"):
            return getattr(self._base, "serpapi_api_key", "")
        if name in ("SEARCH_PROVIDER", "search_provider"):
            return getattr(self._base, "search_provider", "duckduckgo")
        return getattr(self._base, name)

    def __setattr__(self, name: str, value: Any) -> None:
        if name in ("DEMO_MODE", "demo_mode"):
            object.__setattr__(self, "DEMO_MODE", value)
            object.__setattr__(self, "demo_mode", value)
        elif name in ("SERPAPI_API_KEY", "serpapi_api_key"):
            object.__setattr__(self, "SERPAPI_API_KEY", value)
            object.__setattr__(self, "serpapi_api_key", value)
        elif name in ("SEARCH_PROVIDER", "search_provider"):
            object.__setattr__(self, "SEARCH_PROVIDER", value)
            object.__setattr__(self, "search_provider", value)
        else:
            object.__setattr__(self, name, value)


settings = SettingsProxy(get_settings())

DEMO_FIXTURES: dict[str, list[EvidenceItem]] = {
    "claim-abc123": [
        EvidenceItem(
            source_url="https://www.uscis.gov/terms-of-use",
            title="USCIS Website Terms of Use and Automated Submissions",
            snippet="Automated or scripted submissions of visa applications and forms are strictly prohibited. Any application submitted using automated bots or unauthorized third-party proxy tools is subject to immediate rejection and voiding.",
            retrieved_at="2026-09-06T00:00:00Z",
            provider="fixture",
        ),
        EvidenceItem(
            source_url="https://www.gov.uk/visas-immigration-service/terms",
            title="UK Visas and Immigration Terms of Service",
            snippet="Applicants must complete and verify their submission directly. Third-party automation software and unauthorized browser extensions interacting directly with official visa portals violate terms of service and invalidate application integrity.",
            retrieved_at="2026-09-06T00:00:00Z",
            provider="fixture",
        ),
    ],
    "claim-visa-auto-submit": [
        EvidenceItem(
            source_url="https://www.uscis.gov/terms-of-use",
            title="USCIS Website Terms of Use and Automated Submissions",
            snippet="Automated or scripted submissions of visa applications and forms are strictly prohibited. Any application submitted using automated bots or unauthorized third-party proxy tools is subject to immediate rejection and voiding.",
            retrieved_at="2026-09-06T00:00:00Z",
            provider="fixture",
        ),
        EvidenceItem(
            source_url="https://www.gov.uk/visas-immigration-service/terms",
            title="UK Visas and Immigration Terms of Service",
            snippet="Applicants must complete and verify their submission directly. Third-party automation software and unauthorized browser extensions interacting directly with official visa portals violate terms of service and invalidate application integrity.",
            retrieved_at="2026-09-06T00:00:00Z",
            provider="fixture",
        ),
    ],
}


# Source ranking is by URL shape only — no domain allowlist, because a curated
# list of "good sites" is exactly the thing that stops working outside the
# scenarios it was written for.
SOURCE_CLASS_RANK: dict[str, int] = {
    "primary": 0,        # the party that actually sets the fact: government, or a vendor's own docs
    "institutional": 1,  # universities, standards bodies, non-profits
    "web": 2,            # ordinary sites, press, unknown
    "community": 3,      # forums, Q&A, user-generated
    "blog": 4,           # personal/marketing publishing platforms
}

_COMMUNITY_HOSTS = ("reddit.", "quora.", "stackoverflow.", "stackexchange.", "answers.", "forum.", "forums.")
_BLOG_HOSTS = ("medium.com", "substack.com", "blogspot.", "wordpress.", "wixsite.", "tumblr.", "blog.")
_PRIMARY_SUBDOMAINS = ("docs.", "developer.", "developers.", "support.", "help.", "policy.", "policies.", "legal.")


def classify_source(url: str) -> str:
    """Buckets a URL by what kind of authority it carries, from its host alone."""
    host = (urllib.parse.urlparse(url).hostname or "").lower().lstrip(".")
    if not host:
        return "web"
    labels = host.split(".")
    if "gov" in labels or "mil" in labels or "int" in labels:
        return "primary"
    if host.startswith(_PRIMARY_SUBDOMAINS):
        return "primary"
    if "edu" in labels or "ac" in labels or labels[-1] == "org":
        return "institutional"
    if any(h in host for h in _COMMUNITY_HOSTS):
        return "community"
    if any(h in host for h in _BLOG_HOSTS):
        return "blog"
    return "web"


def rank_by_source_class(items: list[EvidenceItem]) -> list[EvidenceItem]:
    """Stamps source_class on each item and orders authority first, stably."""
    for item in items:
        item.source_class = classify_source(item.source_url)
    return sorted(items, key=lambda i: SOURCE_CLASS_RANK.get(i.source_class, 2))


# Words carrying no retrieval signal in any domain: function words, modals, and
# the predictive framing that makes a claim a claim ("we expect X will ...").
_QUERY_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
    "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did", "doing",
    "have", "has", "had", "having", "will", "would", "can", "could", "shall", "should", "may",
    "might", "must", "of", "in", "on", "at", "to", "for", "with", "without", "from", "by",
    "as", "into", "about", "over", "under", "between", "through", "during", "before", "after",
    "we", "i", "you", "they", "he", "she", "it", "our", "my", "your", "their", "its", "his", "her",
    "assume", "assumes", "assuming", "expect", "expects", "expected", "believe", "believes",
    "think", "thinks", "suppose", "likely", "probably", "enough", "very", "more", "most", "much",
    "not", "no", "any", "all", "some", "such", "own", "same", "so", "up", "out", "down", "off",
    "there", "here", "when", "where", "which", "who", "whom", "why", "how", "what",
}

_MAX_QUERY_TERMS = 8


def build_query(statement: str) -> str:
    """Turns a full-sentence claim into a short keyword query.

    Search engines answer keywords, not predictions — posting the sentence
    verbatim is why so many claims came back inconclusive. Numbers, currency
    and capitalised names are kept whole; everything else is filtered against a
    domain-neutral stopword set. Falls back to the raw statement if filtering
    leaves nothing.
    """
    tokens = re.findall(r"[\w$%.,/-]*\w[\w$%.,/-]*", statement or "")
    kept: list[str] = []
    for raw in tokens:
        token = raw.strip(".,/-")
        if not token:
            continue
        lowered = token.lower()
        is_proper = token[0].isupper() and lowered not in _QUERY_STOPWORDS
        has_digit = any(ch.isdigit() for ch in token)
        if not (is_proper or has_digit):
            if lowered in _QUERY_STOPWORDS or len(lowered) < 3:
                continue
        if lowered not in {k.lower() for k in kept}:
            kept.append(token)
        if len(kept) >= _MAX_QUERY_TERMS:
            break
    return " ".join(kept) or (statement or "").strip()


def source_class_to_tier(source_class: str, url: str = "") -> int:
    """Categorizes a source into authority tiers:
    - Tier 1: Primary docs, SEC/regulatory filings, government portals, official API/developer docs.
    - Tier 2: Neutral reporting, technical journalism, forums (Reddit, StackOverflow).
    - Tier 3: Company landing pages, marketing copy, blog posts, sponsored content.
    """
    sc = (source_class or "").lower().strip()
    if not sc and url:
        sc = classify_source(url)

    if sc in ("primary", "institutional"):
        return 1
    if sc in ("community", "web"):
        return 2
    if sc in ("blog", "marketing"):
        return 3
    return 2


def build_adversarial_query(statement: str) -> str:
    """Transforms a statement into an adversarial 'debunk' query.

    Actively probes for complaints, churn, limitations, and failure rather than validation.
    """
    base = build_query(statement)
    if not base:
        return (statement or "").strip()
    cleaned = re.sub(r"\b(best|highest|reliable|proven|guaranteed|safe|secure)\b", "", base, flags=re.I).strip()
    cleaned = re.sub(r"\s+", " ", cleaned) or base
    return f"{cleaned} complaints churn failure alternative"


AUTHORITY_CLASSES = ("primary", "institutional")


def has_authority_source(items: list[EvidenceItem]) -> bool:
    """Whether anything retrieved is a Tier 1 source rather than ordinary web copy."""
    for item in items:
        # "unranked" is the model default, not a verdict — an item that never went
        # through rank_by_source_class still has a host worth reading.
        sc = getattr(item, "source_class", "") or ""
        if sc in ("", "unranked"):
            sc = classify_source(item.source_url)
        if sc in AUTHORITY_CLASSES:
            return True
    return False


def build_authority_query(statement: str) -> str:
    """Pushes the same keywords at the parties that actually set the fact.

    Every case in the 2026-09-07 corpus that beat the vanilla control did it by
    naming a statute, a filing or a published benchmark; every case that tied the
    control was answered out of ordinary `web` results, which a frontier model
    already has. Ranking retrieved items by authority (`rank_by_source_class`)
    cannot help when the query never surfaced an authoritative one to rank.

    Domain-neutral on purpose: "official" and "statistics" pull a government
    register, a standards body or a published study depending on the subject,
    without the caller having to know which kind of decision this is."""
    base = build_query(statement)
    if not base:
        return (statement or "").strip()
    return f"{base} official regulation statute filing statistics"


def build_competitor_query(statement: str) -> str:
    """Transforms a statement into a competitor triangulation query.

    Targets closest competitors or market leaders to empirically verify claims of uniqueness.
    """
    base = build_query(statement)
    if not base:
        return (statement or "").strip()
    feature = re.sub(r"\b(unique|only|first|exclusive|unmatched|sole|proprietary|cheaper than)\b", "", base, flags=re.I).strip()
    feature = re.sub(r"\s+", " ", feature) or base
    return f"{feature} competitor market leader alternative"


async def reformulate_query(
    statement: str,
    previous_query: str,
    provider: Any | None = None,
) -> str:
    """Diagnostic query reformulation for iterative search when initial queries yield 0 results.

    Strips over-constraining adjectives, extracts core entities/nouns, or uses a fast LLM rewrite
    if an LLM provider is supplied. Caps output to at most 6-8 search terms.
    """
    if provider is not None and hasattr(provider, "generate"):
        try:
            class ReformulatedQuery(BaseModel):
                query: str = Field(description="3 to 6 search keywords targeting documentation, benchmarks, or facts")

            system_prompt = (
                "A web search query returned 0 results. Reformulate it into a broader, high-signal keyword query "
                "of 3 to 6 terms. Focus on primary entity names, official policy terms, technical specs, or industry standards. "
                "Drop marketing buzzwords, speculative verbs, or overly narrow adjectives."
            )
            user_prompt = f"Target Claim: {statement}\nFailed Search Query: {previous_query}"
            res = await provider.generate(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                response_schema=ReformulatedQuery,
            )
            if isinstance(res, ReformulatedQuery) and res.query.strip():
                return res.query.strip()
            if hasattr(res, "query") and res.query:
                return str(res.query).strip()
        except Exception as exc:
            logger.debug("LLM query reformulation failed (%s); using rule-based fallback.", exc)

    # Rule-based fallback: Relax query by extracting proper nouns, numbers, or top keywords
    tokens = re.findall(r"[\w$%.,/-]*\w[\w$%.,/-]*", statement or "")
    proper_nouns = [t.strip(".,/-") for t in tokens if t and t[0].isupper() and t.lower() not in _QUERY_STOPWORDS]
    if len(proper_nouns) >= 2:
        return " ".join(proper_nouns[:4]) + " documentation limits requirements"

    # Strip restrictive adjectives from previous query
    relaxed = re.sub(
        r"\b(unlimited|instant|zero|free|guaranteed|automatic|seamless|effortless|exclusive|complete|total)\b",
        "",
        previous_query,
        flags=re.IGNORECASE,
    )
    relaxed = re.sub(r"\s+", " ", relaxed).strip()
    words = [w for w in relaxed.split() if w.lower() not in _QUERY_STOPWORDS]
    if len(words) > 4:
        return " ".join(words[:4])
    return relaxed or previous_query


def _clean_ddg_url(raw_url: str) -> str:

    """Decodes DuckDuckGo redirect URLs if present, otherwise returns cleaned URL."""
    clean = html.unescape(raw_url)
    parsed = urllib.parse.urlparse(clean)
    qs = urllib.parse.parse_qs(parsed.query)
    if "uddg" in qs and qs["uddg"]:
        return qs["uddg"][0]
    return clean



def parse_duckduckgo_lite_html(html_content: str, max_results: int = 4) -> list[EvidenceItem]:
    """Parses DuckDuckGo Lite HTML into well-formed EvidenceItem models.

    Filters out internal ads/navigation and extracts clean target URLs, titles, and snippets.
    """
    if not html_content:
        return []

    now = datetime.now(timezone.utc).isoformat()

    link_pattern = re.compile(
        r"<a\s+([^>]*class=[\"'][^\"']*result-link[^\"']*[\"'][^>]*)>(.*?)</a>",
        re.DOTALL | re.IGNORECASE,
    )

    snippet_pattern = re.compile(
        r"<td\s+[^>]*class=[\"'][^\"']*result-snippet[^\"']*[\"'][^>]*>(.*?)</td>",
        re.DOTALL | re.IGNORECASE,
    )

    snippets = list(snippet_pattern.finditer(html_content))
    items: list[EvidenceItem] = []

    for link_m in link_pattern.finditer(html_content):
        if len(items) >= max_results:
            break

        attrs = link_m.group(1)
        title_raw = link_m.group(2)

        href_m = re.search(r'href=[\"\']([^\"\']+)[\"\']', attrs, re.IGNORECASE)
        if not href_m:
            continue

        raw_url = href_m.group(1).strip()
        url = _clean_ddg_url(raw_url)

        # Skip DuckDuckGo internal ads and helper pages
        if not url or "duckduckgo.com/y.js" in url or "duckduckgo-help-pages" in url:
            continue
        if url.startswith("/") or url.startswith("#"):
            continue

        title_clean = html.unescape(re.sub(r"<[^>]+>", "", title_raw))
        title = re.sub(r"\s+", " ", title_clean).strip() or None

        # Find the first snippet appearing after this link
        link_end = link_m.end()
        snippet_text = ""
        for snip_m in snippets:
            if snip_m.start() >= link_end:
                snip_raw = snip_m.group(1)
                snip_clean = html.unescape(re.sub(r"<[^>]+>", "", snip_raw))
                snippet_text = re.sub(r"\s+", " ", snip_clean).strip()
                break

        items.append(
            EvidenceItem(
                source_url=url,
                title=title,
                snippet=snippet_text,
                retrieved_at=now,
                provider="duckduckgo",
            )
        )

    return items


def parse_serpapi_response(data: dict[str, Any], max_results: int = 4) -> list[EvidenceItem]:
    """Parses SerpApi Google search JSON response into well-formed EvidenceItem models.

    Extracts organic results with clean URLs, titles, snippets, and sets provider='serpapi'.
    Raises SerpApiQuotaExceededError if the response indicates quota or account credit exhaustion.
    """
    if not isinstance(data, dict):
        return []

    if "error" in data:
        err_msg = str(data["error"])
        lowered = err_msg.lower()
        if any(term in lowered for term in ("run out of searches", "quota", "limit", "rate limit")):
            raise SerpApiQuotaExceededError(err_msg)
        raise SerpApiError(err_msg)

    now = datetime.now(timezone.utc).isoformat()
    organic_results = data.get("organic_results", [])
    if not isinstance(organic_results, list):
        return []

    items: list[EvidenceItem] = []
    for res in organic_results:
        if len(items) >= max_results:
            break
        if not isinstance(res, dict):
            continue

        raw_url = res.get("link") or res.get("url")
        if not raw_url or not isinstance(raw_url, str) or not raw_url.startswith("http"):
            continue

        title_raw = res.get("title")
        title = title_raw.strip() if isinstance(title_raw, str) and title_raw.strip() else None

        snippet_raw = res.get("snippet") or ""
        snippet = snippet_raw.strip() if isinstance(snippet_raw, str) else ""

        items.append(
            EvidenceItem(
                source_url=raw_url.strip(),
                title=title,
                snippet=snippet,
                retrieved_at=now,
                provider="serpapi",
            )
        )

    return items


async def _execute_serpapi_search(query: str, api_key: str, max_results: int = 4) -> list[EvidenceItem]:
    """Executes a Google search via SerpApi using Scrapling's AsyncFetcher.

    Detects HTTP 429 (out of searches / rate limit) and HTTP 401 (unauthorized) and raises
    specific exceptions so caller can fall back gracefully.
    """
    from scrapling import AsyncFetcher

    params = {
        "engine": "google",
        "q": query,
        "api_key": api_key,
        "num": str(max_results),
    }
    url = f"https://serpapi.com/search.json?{urllib.parse.urlencode(params)}"

    res = await AsyncFetcher.get(url, timeout=get_settings().search_timeout_seconds)
    status = getattr(res, "status", getattr(res, "status_code", 200))

    if status == 429:
        raise SerpApiQuotaExceededError("SerpApi account has run out of searches or is rate limited (HTTP 429)")
    if status == 401:
        raise SerpApiError("SerpApi unauthorized: invalid or inactive API key (HTTP 401)")
    if status >= 400:
        raise SerpApiError(f"SerpApi request failed with HTTP {status}")

    try:
        data = res.json() if hasattr(res, "json") else json.loads(res.text or res.body.decode("utf-8"))
    except Exception as exc:
        raise SerpApiError(f"Failed to parse SerpApi response as JSON: {exc}") from exc

    return parse_serpapi_response(data, max_results=max_results)


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=0.1, min=0.1, max=1.0),
    retry=retry_if_not_exception_type(AssertionError),
    reraise=True,
)
async def _execute_search(query: str) -> str:
    """Executes a search against DuckDuckGo Lite using Scrapling's AsyncFetcher.

    Two attempts, not three: a third try on an endpoint that just refused twice
    is another request into the same block, and the caller already has an
    authority pass and a reformulation pass behind this one.
    """
    from scrapling import AsyncFetcher

    res = await AsyncFetcher.post(
        "https://lite.duckduckgo.com/lite/",
        data={"q": query},
        timeout=get_settings().search_timeout_seconds,
    )
    if hasattr(res, "html_content") and res.html_content:
        return res.html_content
    if hasattr(res, "body") and res.body:
        return res.body.decode("utf-8", errors="ignore")
    if hasattr(res, "text") and res.text:
        return res.text
    return str(res)


async def _search_engines(claim_id: str, query: str) -> list[EvidenceItem]:
    """One trip to the search engines for one query. Never called directly —
    `search_evidence` coalesces and caches around it."""
    api_key = (getattr(settings, "SERPAPI_API_KEY", "") or getattr(settings, "serpapi_api_key", "") or "").strip()
    provider_mode = (
        getattr(settings, "SEARCH_PROVIDER", "duckduckgo")
        or getattr(settings, "search_provider", "duckduckgo")
        or "duckduckgo"
    ).lower().strip()

    # If explicitly configured to prioritize SerpApi (e.g. in targeted tests or explicit config)
    if provider_mode == "serpapi" and api_key:
        try:
            serp_items = await _execute_serpapi_search(query, api_key, max_results=4)
            if inspect.isawaitable(serp_items):
                serp_items = await serp_items
            if serp_items:
                return rank_by_source_class(serp_items)
            logger.info(f"SerpApi returned 0 results for '{query}'. Falling back to DuckDuckGo Lite.")
        except SerpApiQuotaExceededError as exc:
            logger.warning(
                f"SerpApi credits exhausted or quota reached for claim {claim_id}: {exc}. "
                "Smoothly falling back to DuckDuckGo Lite via Scrapling."
            )
        except Exception as exc:
            logger.warning(
                f"SerpApi search failed for claim {claim_id}: {exc}. "
                "Falling back to DuckDuckGo Lite via Scrapling."
            )

    # Primary engine: DuckDuckGo Lite via Scrapling (fast, zero-cost, no rate limit)
    try:
        html_resp = await _execute_search(query)
        if inspect.isawaitable(html_resp):
            html_resp = await html_resp
        ddg_items = parse_duckduckgo_lite_html(html_resp, max_results=4)
        if ddg_items:
            return rank_by_source_class(ddg_items)
        logger.info(f"DuckDuckGo Lite returned 0 results for '{query}'.")
    except AssertionError:
        raise
    except Exception as exc:
        logger.warning(f"DuckDuckGo search failed for claim {claim_id}: {exc}")

    # Fallback to SerpApi if DDG returned 0 results and SerpApi wasn't already attempted
    if provider_mode != "serpapi" and api_key and provider_mode != "duckduckgo_only":
        try:
            serp_items = await _execute_serpapi_search(query, api_key, max_results=4)
            if inspect.isawaitable(serp_items):
                serp_items = await serp_items
            if serp_items:
                return rank_by_source_class(serp_items)
        except Exception as exc:
            logger.warning(f"SerpApi fallback failed for claim {claim_id}: {exc}")

    return []





# ---------------------------------------------------------------- retrieval budget
#
# One run asks the same engines the same things repeatedly: the Researcher runs a
# base sweep, an authority pass and (on zero results) a reformulation pass per
# claim, and cross-examination probes fire again for the load-bearing ones. Those
# queries overlap heavily, and firing all of them at once is what got DuckDuckGo
# Lite to answer with an empty page — which the caller reads as "no evidence" and
# answers with *another* query. The cascade was self-feeding.
#
# Two mechanisms, both here rather than at each call site:
#   * coalescing + TTL cache — an identical query in flight is joined, not re-sent;
#   * a concurrency gate — at most `search_concurrency` requests leave the process
#     at once, so a 20-evaluator fan-out arrives as a queue, not a burst.
#
# Quality is unaffected: the same query returns the same results either way.

_search_cache: "OrderedDict[str, tuple[float, list[EvidenceItem]]]" = OrderedDict()
_search_inflight: dict[str, asyncio.Future] = {}
_SEARCH_CACHE_MAX = 256

_search_gate: asyncio.Semaphore | None = None
_search_gate_loop: Any = None


def clear_search_cache() -> None:
    """Drops cached and in-flight queries. Tests call this between cases."""
    _search_cache.clear()
    _search_inflight.clear()


def _gate() -> asyncio.Semaphore:
    """Loop-bound semaphore, rebuilt when the event loop changes (test runs)."""
    global _search_gate, _search_gate_loop
    loop = asyncio.get_running_loop()
    if _search_gate is None or _search_gate_loop is not loop:
        _search_gate = asyncio.Semaphore(max(1, int(get_settings().search_concurrency)))
        _search_gate_loop = loop
    return _search_gate


def _detach(items: list[EvidenceItem]) -> list[EvidenceItem]:
    """Callers mutate what they get back — stance, source_class, and the snippet
    on deep fetch. Handing two evaluators the same objects would let one rewrite
    the other's evidence."""
    return [item.model_copy(deep=True) for item in items]


def _remember(query: str, task: asyncio.Future) -> None:
    _search_inflight.pop(query, None)
    if task.cancelled() or task.exception() is not None:
        return
    _search_cache[query] = (time.monotonic(), task.result())
    _search_cache.move_to_end(query)
    while len(_search_cache) > _SEARCH_CACHE_MAX:
        _search_cache.popitem(last=False)


async def _gated_search(claim_id: str, query: str) -> list[EvidenceItem]:
    async with _gate():
        return await _search_engines(claim_id, query)


async def search_evidence(claim: Claim, query_override: str | None = None) -> list[EvidenceItem]:
    """Searches external evidence for a given claim.

    Primary engine is DuckDuckGo Lite via Scrapling (fast, zero-cost, high Tier-1 authority signal).
    Falls back to SerpApi only when SEARCH_PROVIDER is explicitly set to 'serpapi' or when
    DuckDuckGo yields 0 results and SERPAPI_API_KEY is configured.

    Identical queries are coalesced and cached for `search_cache_ttl_seconds`, and
    outbound requests are capped at `search_concurrency`.
    """
    is_demo = getattr(settings, "DEMO_MODE", False) or getattr(settings, "demo_mode", False)
    if is_demo and claim.id in DEMO_FIXTURES:
        return DEMO_FIXTURES[claim.id]

    query = (query_override or build_query(claim.statement) or "").strip()
    if not query:
        return []

    ttl = float(get_settings().search_cache_ttl_seconds)
    cached = _search_cache.get(query)
    if cached is not None and (time.monotonic() - cached[0]) < ttl:
        _search_cache.move_to_end(query)
        return _detach(cached[1])
    if cached is not None:
        _search_cache.pop(query, None)

    pending = _search_inflight.get(query)
    if pending is None:
        pending = asyncio.ensure_future(_gated_search(claim.id, query))
        _search_inflight[query] = pending
        pending.add_done_callback(lambda t, q=query: _remember(q, t))

    # shield: an evaluator hitting its own timeout must not cancel a search other
    # evaluators are waiting on.
    return _detach(await asyncio.shield(pending))
