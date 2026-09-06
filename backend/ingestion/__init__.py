"""
Owner: Dev B. Ingestion module for documents/PDFs feeding Case.context.
See docs/03-dev-B-evidence-receipts.md hour 35+ stretch.
"""
from __future__ import annotations

from ingestion.image import ingest_image
from ingestion.markdown import extract_markdown_text, ingest_markdown
from ingestion.ocr import extract_image_text, ocr_pdf_pages
from ingestion.pdf import extract_pdf_text, ingest_pdf
from ingestion.url import ingest_url

__all__ = [
    "extract_image_text",
    "extract_markdown_text",
    "extract_pdf_text",
    "ingest_image",
    "ingest_markdown",
    "ingest_pdf",
    "ingest_url",
    "ocr_pdf_pages",
]
