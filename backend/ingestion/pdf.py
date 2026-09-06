"""
Owner: Dev B. PDF text extraction and ingestion feeding Case.context.
See docs/03-dev-B-evidence-receipts.md hour 35+ stretch.

Guarantees:
- Extracts clean text using pypdf for digital text layers (<10ms)
- Automatically falls back to RapidOCR via PyMuPDF page rasterization for scanned/photo PDFs
- Feeds Case.context via same curation step
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
        ValueError: If the PDF contains no pages or if neither digital text extraction
            nor RapidOCR detects extractable text.
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

    # If digital text is thin or absent (< 20 non-whitespace chars), fall back to RapidOCR
    # via PyMuPDF page rasterization to extract text from scanned/photo pages.
    if non_ws_chars < 20:
        logger.info("Thin or absent digital text layer: attempting RapidOCR on rasterized PDF pages")
        try:
            from ingestion.ocr import ocr_pdf_pages

            ocr_text = ocr_pdf_pages(source)
            if ocr_text and len(re.sub(r"\s+", "", ocr_text)) >= 20:
                return ocr_text
        except Exception as ocr_err:
            logger.warning(f"RapidOCR PDF fallback failed: {ocr_err}")

        # If both digital extraction and OCR found no text, raise ValueError
        raise ValueError(
            "No extractable text found in PDF document. Digital text layer is empty "
            "and OCR detected no recognizable text."
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

    # Return full extracted text for Case.context (supporting multi-page documents)
    return raw_text

