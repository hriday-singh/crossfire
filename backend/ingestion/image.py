"""
Owner: Dev B. Screenshot and image ingestion feeding Case.context.
Extracts text via RapidOCR and curates snippets into Case.context.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, BinaryIO

from evidence.curate import curate_snippet, curate_snippet_llm
from ingestion.ocr import extract_image_text
from providers.base import LLMProvider

logger = logging.getLogger(__name__)


async def ingest_image(
    source: str | Path | bytes | BinaryIO,
    claim_statement: str | None = None,
    provider: LLMProvider | None = None,
) -> str:
    """Ingests an image document (screenshot, JPEG, PNG, etc.) and extracts curated text for Case.context.

    Args:
        source: Image path, bytes, or binary stream.
        claim_statement: Optional claim to orient the curation heuristic / LLM.
        provider: Optional LLMProvider for low-token LLM-based curation.

    Returns:
        Curated text (1-3 sentences) if claim_statement is supplied, or bounded
        document text (up to 2,000 characters) for general context.
    """
    raw_text = extract_image_text(source)

    if not raw_text or not raw_text.strip():
        raise ValueError(
            "No extractable text found in image: OCR detected no recognizable text or "
            "confidence was below threshold."
        )

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
