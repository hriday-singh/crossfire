"""
Owner: Dev B. Scrapling wrapper — deep-verification for load-bearing claims
and pasted-URL ingestion share this module. See docs/03-dev-B-evidence-receipts.md.
"""
from __future__ import annotations

import logging
import urllib.parse
from typing import Any

from tenacity import (
    retry,
    retry_if_not_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

BLOCKED_SERP_DOMAINS = {
    "google.com",
    "bing.com",
    "duckduckgo.com",
    "yahoo.com",
    "yandex.com",
    "baidu.com",
    "ecosia.org",
    "ask.com",
}


def is_serp_url(url: str) -> bool:
    """Checks if a URL belongs to a search engine results page domain."""
    try:
        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc.lower()
        return any(domain in netloc for domain in BLOCKED_SERP_DOMAINS)
    except Exception:
        return False


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=0.1, min=0.1, max=0.5),
    retry=retry_if_not_exception_type((ValueError, AssertionError)),
    reraise=True,
)
async def _do_fetch(url: str) -> str:
    from scrapling import AsyncFetcher

    res = await AsyncFetcher.get(url)
    if hasattr(res, "get_all_text"):
        text = res.get_all_text()
    elif hasattr(res, "text"):
        text = res.text
    else:
        text = str(res)
    return text or ""


async def fetch_page(url: str) -> str:
    """Fetches full page text using Scrapling for deep verification.

    - Rejects search engine results pages directly (structural invariant)
    - Retries transient failures
    - Returns empty string on dead link or un-bypassable bot wall (never crashes)
    """
    if is_serp_url(url):
        raise ValueError(
            f"Fetching search engine results pages directly is disallowed: {url}. "
            "URLs must come from discovery (Tavily), not direct search engine queries."
        )

    try:
        return await _do_fetch(url)
    except (ValueError, AssertionError):
        raise
    except Exception as exc:
        logger.warning(f"Scrapling fetch failed for URL {url}: {exc}")
        return ""

