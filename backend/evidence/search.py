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


def _clean_ddg_url(raw_url: str) -> str:
    """Decodes DuckDuckGo redirect URLs if present, otherwise returns cleaned URL."""
    if "uddg=" in raw_url:
        match = re.search(r"uddg=([^&]+)", raw_url)
        if match:
            return urllib.parse.unquote(match.group(1))
    return raw_url


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
        html_resp = await _execute_search(claim.statement)
        if inspect.isawaitable(html_resp):
            html_resp = await html_resp
        return parse_duckduckgo_lite_html(html_resp, max_results=4)
    except AssertionError:
        raise
    except Exception as exc:
        logger.warning(f"DuckDuckGo search failed for claim {claim.id}: {exc}")
        return []

