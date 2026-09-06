"""
Owner: Dev B. Ingestion module for documents/PDFs feeding Case.context.
See docs/03-dev-B-evidence-receipts.md hour 35+ stretch.
"""
from __future__ import annotations

from ingestion.pdf import extract_pdf_text, ingest_pdf

__all__ = ["extract_pdf_text", "ingest_pdf"]
