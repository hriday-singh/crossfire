"""
Owner: Dev B. Web URL text extraction and ingestion feeding Case.context.
See docs/03-dev-B-evidence-receipts.md hour 11-35 item (b).

Guarantees:
- Extracts clean text using Scrapling AsyncFetcher via evidence.fetch.fetch_page
- Rejects search engine results pages (SERPs) directly with explicit ValueError
- Feeds Case.context via same curation step (heuristic or LLM)
- Gracefully degrades to an empty string on network failure / bot walls (never crashes)
"""
from __future__ import annotations

import logging
from typing import Any

from evidence.curate import curate_snippet, curate_snippet_llm
from evidence.fetch import fetch_page, is_serp_url
from providers.base import LLMProvider

logger = logging.getLogger(__name__)


async def ingest_url(
    url: str,
    claim_statement: str | Any | None = None,
    provider: LLMProvider | None = None,
) -> str:
    """Ingests a web document from a URL and extracts curated text for Case.context.

    Args:
        url: The web URL to fetch.
        claim_statement: Optional claim to orient the curation heuristic / LLM.
        provider: Optional LLMProvider for low-token LLM-based curation.

    Returns:
        Curated text (1-3 sentences) if claim_statement is supplied, or bounded
        document text (up to 2000 characters) for general context.
    """
    if is_serp_url(url):
        raise ValueError(
            f"Direct search engine results page ingestion is disallowed: {url}. "
            "Pasted URLs must point to content pages, not search result listings."
        )

    try:
        raw_text = await fetch_page(url)
    except (ValueError, AssertionError):
        raise
    except Exception as exc:
        logger.warning(f"Failed to ingest URL {url}: {exc}")
        return ""

    if not raw_text or not raw_text.strip():
        return ""

    if claim_statement:
        if provider is not None:
            return await curate_snippet_llm(raw_text, claim_statement, provider=provider)
        return curate_snippet(raw_text, claim_statement)

    # Return clean bounded text for Case.context
    if len(raw_text) > 2000:
        truncated = raw_text[:2000]
        last_space = truncated.rsplit(" ", 1)
        return last_space[0] + "..." if len(last_space) > 1 else truncated
    return raw_text.strip()
