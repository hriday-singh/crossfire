"""
Owner: Dev B. DuckDuckGo search wrapper via Scrapling.
Extracts external evidence items with search_depth='basic' equivalent (1 query per claim).
Wrapped in tenacity retry for transient network failures.
"""
from __future__ import annotations

import html
import inspect
import logging
import re
import urllib.parse
from datetime import datetime, timezone
from typing import Any

from tenacity import (
    retry,
    retry_if_not_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import get_settings
from core.models import Claim, EvidenceItem

logger = logging.getLogger(__name__)


class SettingsProxy:
    """Delegates to base settings while allowing dynamic overrides (e.g. DEMO_MODE)
    for testing and runtime switches."""

    def __init__(self, base: Any) -> None:
        object.__setattr__(self, "_base", base)

    def __getattr__(self, name: str) -> Any:
        if name == "DEMO_MODE":
            return getattr(self._base, "demo_mode", False)
        return getattr(self._base, name)

    def __setattr__(self, name: str, value: Any) -> None:
        if name == "DEMO_MODE":
            object.__setattr__(self, "DEMO_MODE", value)
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
        ),
        EvidenceItem(
            source_url="https://www.gov.uk/visas-immigration-service/terms",
            title="UK Visas and Immigration Terms of Service",
            snippet="Applicants must complete and verify their submission directly. Third-party automation software and unauthorized browser extensions interacting directly with official visa portals violate terms of service and invalidate application integrity.",
            retrieved_at="2026-09-06T00:00:00Z",
        ),
    ],
    "claim-visa-auto-submit": [
        EvidenceItem(
            source_url="https://www.uscis.gov/terms-of-use",
            title="USCIS Website Terms of Use and Automated Submissions",
            snippet="Automated or scripted submissions of visa applications and forms are strictly prohibited. Any application submitted using automated bots or unauthorized third-party proxy tools is subject to immediate rejection and voiding.",
            retrieved_at="2026-09-06T00:00:00Z",
        ),
        EvidenceItem(
            source_url="https://www.gov.uk/visas-immigration-service/terms",
            title="UK Visas and Immigration Terms of Service",
            snippet="Applicants must complete and verify their submission directly. Third-party automation software and unauthorized browser extensions interacting directly with official visa portals violate terms of service and invalidate application integrity.",
            retrieved_at="2026-09-06T00:00:00Z",
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
            )
        )

    return items


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.1, min=0.1, max=1.0),
    retry=retry_if_not_exception_type(AssertionError),
    reraise=True,
)
async def _execute_search(query: str) -> str:
    """Executes a search against DuckDuckGo Lite using Scrapling's AsyncFetcher."""
    from scrapling import AsyncFetcher

    res = await AsyncFetcher.post(
        "https://lite.duckduckgo.com/lite/",
        data={"q": query},
        timeout=15,
    )
    if hasattr(res, "html_content") and res.html_content:
        return res.html_content
    if hasattr(res, "body") and res.body:
        return res.body.decode("utf-8", errors="ignore")
    if hasattr(res, "text") and res.text:
        return res.text
    return str(res)


async def search_evidence(claim: Claim) -> list[EvidenceItem]:
    """Searches external evidence for a given claim via DuckDuckGo Lite.

    - Single query per claim
    - Explicit DEMO_FIXTURES switch when DEMO_MODE is True
    - Gracefully degrades to an empty list on failure (never raises)
    """
    is_demo = getattr(settings, "DEMO_MODE", False) or getattr(settings, "demo_mode", False)
    if is_demo and claim.id in DEMO_FIXTURES:
        return DEMO_FIXTURES[claim.id]

    try:
        html_resp = await _execute_search(build_query(claim.statement))
        if inspect.isawaitable(html_resp):
            html_resp = await html_resp
        return rank_by_source_class(parse_duckduckgo_lite_html(html_resp, max_results=4))
    except AssertionError:
        raise
    except Exception as exc:
        logger.warning(f"DuckDuckGo search failed for claim {claim.id}: {exc}")
        return []

