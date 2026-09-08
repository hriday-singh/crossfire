"""Citation integrity: does the page a snippet claims to come from actually contain it?

A well-formed EvidenceItem is not a real one. `news.csraid.com` reached a shipped
memo with a URL, a title and a plausible snippet, and the evidence gate passed it
because the gate checks that evidence exists, not that it is real.

Zero LLM calls. HTTP and string comparison only.
"""
from __future__ import annotations

import asyncio
import logging
import re

from config import get_settings
from core.models import EvidenceItem
from evidence.fetch import fetch_page

logger = logging.getLogger(__name__)

_WORD = re.compile(r"\w+", re.UNICODE)

# Words that appear on every page and prove nothing about provenance.
_NOISE = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "from",
    "is", "are", "was", "were", "be", "been", "by", "with", "as", "that", "this",
    "it", "its", "not", "no", "but", "if", "then", "than", "so", "such",
}


def _tokens(text: str) -> set[str]:
    return {t for t in (m.group(0).lower() for m in _WORD.finditer(text or "")) if t not in _NOISE}


def snippet_matches(snippet: str, page_text: str, threshold: float) -> bool:
    """True when enough of the snippet's distinctive words appear on the page.

    Containment, not similarity: the page is long and the snippet is short, so a
    symmetric ratio would score every honest match near zero. And not a substring
    test either — `curate_snippet` rewrites and joins sentences, so an exact match
    would reject honest evidence while a fabricated citation fails either way.
    """
    snippet_tokens = _tokens(snippet)
    page_tokens = _tokens(page_text)
    if not snippet_tokens or not page_tokens:
        return False
    overlap = len(snippet_tokens & page_tokens) / len(snippet_tokens)
    return overlap >= threshold


async def _verify_one(item: EvidenceItem, threshold: float, timeout: float) -> EvidenceItem:
    try:
        page_text = await fetch_page(item.source_url, timeout=timeout)
    except Exception as exc:
        # fetch_page raises only on structural refusals (SERP, unsafe URL).
        # Those are our rule, not the source's fault, so they are unreachable.
        logger.info("Citation verification could not fetch %s: %s", item.source_url, exc)
        page_text = ""

    if not page_text:
        item.verified = False
        item.verification = "unreachable"
    elif snippet_matches(item.snippet, page_text, threshold):
        item.verified = True
        item.verification = "snippet_matched"
    else:
        item.verified = False
        item.verification = "snippet_absent"
        logger.warning(
            "Citation dropped: snippet not found on %s (snippet=%.80r)",
            item.source_url,
            item.snippet,
        )
    return item


async def verify_evidence(items: list[EvidenceItem]) -> list[EvidenceItem]:
    """Stamps verification status on each item and drops the fabricated ones.

    `unreachable` is deliberately NOT a failure. Primary sources are exactly the
    ones most likely to be PDFs or bot-walled, and discarding them would leave us
    citing only the sites that are easy to scrape.
    """
    if not items:
        return []
    settings = get_settings()
    if not settings.verify_citations:
        return items

    sem = asyncio.Semaphore(max(1, settings.verify_concurrency))

    async def bounded(item: EvidenceItem) -> EvidenceItem:
        async with sem:
            return await _verify_one(
                item,
                settings.verify_snippet_threshold,
                settings.verify_fetch_timeout_seconds,
            )

    verified = await asyncio.gather(*(bounded(i) for i in items))
    return [i for i in verified if i.verification != "snippet_absent"]


def verification_counts(items: list[EvidenceItem]) -> dict[str, int]:
    """Stage-event payload: how the check landed, for the live feed."""
    counts = {"matched": 0, "unreachable": 0, "unchecked": 0}
    for item in items:
        if item.verification == "snippet_matched":
            counts["matched"] += 1
        elif item.verification == "unreachable":
            counts["unreachable"] += 1
        else:
            counts["unchecked"] += 1
    return counts
