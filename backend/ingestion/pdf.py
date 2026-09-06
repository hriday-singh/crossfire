"""
Owner: Dev B. Stretch only (hour 35+ slack). pypdf/pdfplumber text extraction
only — rejects scanned/image-only PDFs. See docs/03-dev-B-evidence-receipts.md.
"""
from __future__ import annotations


def extract_text(pdf_bytes: bytes) -> str:
    raise NotImplementedError
