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

import ipaddress
import re
import socket

_SERP_PATTERN = re.compile(
    r"(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|ask)\.",
    re.IGNORECASE,
)


def is_serp_url(url: str) -> bool:
    """Checks if a URL belongs to a search engine results page domain."""
    try:
        parsed = urllib.parse.urlparse(url)
        netloc = (parsed.netloc or "").split(":")[0].lower()
        if not netloc:
            return False
        return bool(_SERP_PATTERN.search(netloc))
    except Exception:
        return False


def is_safe_url(url: str) -> bool:
    """Validates that a URL does not target private, loopback, or internal metadata addresses."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = (parsed.hostname or "").strip().lower()
        if not hostname:
            return False

        if hostname in ("localhost", "127.0.0.1", "::1", "0.0.0.0", "169.254.169.254"):
            return False
        if hostname.endswith(".local") or hostname.endswith(".internal"):
            return False

        try:
            # Check if hostname itself is an IP literal
            ip = ipaddress.ip_address(hostname)
            return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
        except ValueError:
            pass

        # Resolve hostname and check resolved IPs
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for _, _, _, _, sockaddr in addr_info:
                ip = ipaddress.ip_address(sockaddr[0])
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                    return False
        except (socket.gaierror, socket.error):
            # If DNS resolution fails, allow requests or let fetch fail naturally
            pass

        return True
    except Exception:
        return False



import asyncio

@retry(
    stop=stop_after_attempt(1),
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


async def fetch_page(url: str, timeout: float = 5.0) -> str:
    """Fetches full page text using Scrapling for deep verification.

    - Rejects search engine results pages directly (structural invariant)
    - Times out strictly at 5s per URL, returning empty string on timeout
    - Returns empty string on dead link or un-bypassable bot wall (never crashes)
    """
    if is_serp_url(url):
        raise ValueError(
            f"Fetching search engine results pages directly is disallowed: {url}. "
            "URLs must come from discovery (Tavily/DDG), not direct search engine queries."
        )

    if not is_safe_url(url):
        raise ValueError(f"Fetching private or unsafe URL is disallowed: {url}")

    try:
        return await asyncio.wait_for(_do_fetch(url), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning(f"Scrapling fetch timed out after {timeout}s for URL {url}")
        return ""
    except (ValueError, AssertionError):
        raise
    except Exception as exc:
        logger.warning(f"Scrapling fetch failed for URL {url}: {exc}")
        return ""

