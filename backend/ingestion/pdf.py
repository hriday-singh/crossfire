"""
Owner: Dev B. PDF text extraction and ingestion feeding Case.context.
See docs/03-dev-B-evidence-receipts.md hour 35+ stretch.

Guarantees:
- Extracts clean text using pypdf
- Feeds Case.context via same curation step
- Rejects scanned/image-only PDFs cleanly with explicit error (no OCR path)
"""
from __future__ import annotations

import io
import logging
import re
from pathlib import Path
from typing import Any, BinaryIO

import pypdf

from evidence.curate import curate_snippet, curate_snippet_llm
from providers.base import LLMProvider

logger = logging.getLogger(__name__)


def extract_pdf_text(source: str | Path | bytes | BinaryIO) -> str:
    """Extracts raw text from a PDF file path, raw bytes, or file stream.

    Raises:
        FileNotFoundError: If a file path is passed but does not exist.
        ValueError: If the PDF contains no pages or is a scanned/image-only PDF
            with no extractable text (OCR is intentionally unsupported).
    """
    stream: BinaryIO | str | Path
    if isinstance(source, (str, Path)):
        p = Path(source)
        if not p.is_file():
            raise FileNotFoundError(f"PDF file not found: {source}")
        stream = p
    elif isinstance(source, bytes):
        stream = io.BytesIO(source)
    else:
        stream = source

    try:
        reader = pypdf.PdfReader(stream)
    except Exception as exc:
        raise ValueError(f"Could not parse PDF file: {exc}") from exc

    if not reader.pages:
        raise ValueError("Empty PDF document with no pages.")

    extracted_pages: list[str] = []
    for idx, page in enumerate(reader.pages):
        try:
            page_text = page.extract_text() or ""
            if page_text.strip():
                extracted_pages.append(page_text.strip())
        except Exception as err:
            logger.warning(f"Error extracting text from PDF page {idx}: {err}")

    full_text = "\n\n".join(extracted_pages).strip()
    non_ws_chars = len(re.sub(r"\s+", "", full_text))

    # Reject scanned or image-only PDFs with no extractable text
    if non_ws_chars < 20:
        raise ValueError(
            "Scanned or image-only PDF detected: no extractable text found. "
            "OCR is not supported."
        )

    return full_text


async def ingest_pdf(
    source: str | Path | bytes | BinaryIO,
    claim_statement: str | None = None,
    provider: LLMProvider | None = None,
) -> str:
    """Ingests a PDF document and extracts curated context for Case.context.

    If claim_statement is supplied, applies the curation pipeline (LLM or heuristic)
    to yield only the most relevant sentences. Otherwise returns a bounded text summary.
    """
    raw_text = extract_pdf_text(source)

    if claim_statement:
        if provider is not None:
            return await curate_snippet_llm(raw_text, claim_statement, provider=provider)
        return curate_snippet(raw_text, claim_statement)

    # Return clean bounded text for Case.context
    if len(raw_text) > 2000:
        truncated = raw_text[:2000]
        last_space = truncated.rsplit(" ", 1)
        return last_space[0] + "..." if len(last_space) > 1 else truncated
    return raw_text
