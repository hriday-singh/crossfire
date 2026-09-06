"""
Markdown text extraction and ingestion feeding Case.context.

Guarantees:
- Reads markdown text from file paths, raw bytes (UTF-8), or string streams.
- Rejects empty documents.
- Feeds Case.context via the curation step (LLM or heuristic if claim_statement is supplied).
"""
from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import BinaryIO

from evidence.curate import curate_snippet, curate_snippet_llm
from providers.base import LLMProvider

logger = logging.getLogger(__name__)


def extract_markdown_text(source: str | Path | bytes | BinaryIO) -> str:
    """Extracts raw text from a Markdown file path, bytes, or text string.

    Raises:
        FileNotFoundError: If a file path is passed but does not exist.
        ValueError: If the source contains no readable text.
    """
    if isinstance(source, Path) or (isinstance(source, str) and "\n" not in source and Path(source).is_file()):
        p = Path(source)
        if not p.is_file():
            raise FileNotFoundError(f"Markdown file not found: {source}")
        text = p.read_text(encoding="utf-8", errors="replace")
    elif isinstance(source, bytes):
        text = source.decode("utf-8", errors="replace")
    elif hasattr(source, "read"):
        content = source.read()
        if isinstance(content, bytes):
            text = content.decode("utf-8", errors="replace")
        else:
            text = str(content)
    else:
        text = str(source)

    cleaned = text.strip()
    if not cleaned:
        raise ValueError("Empty Markdown document with no text content.")

    return cleaned


async def ingest_markdown(
    source: str | Path | bytes | BinaryIO,
    claim_statement: str | None = None,
    provider: LLMProvider | None = None,
) -> str:
    """Ingests a Markdown document and extracts curated context for Case.context.

    If claim_statement is supplied, applies the curation pipeline (LLM or heuristic)
    to yield only the most relevant sentences. Otherwise returns full extracted text.
    """
    raw_text = extract_markdown_text(source)

    if claim_statement:
        if provider is not None:
            return await curate_snippet_llm(raw_text, claim_statement, provider=provider)
        return curate_snippet(raw_text, claim_statement)

    # Return full extracted text for Case.context (supporting multi-page documents)
    return raw_text

