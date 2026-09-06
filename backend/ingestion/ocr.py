"""
Owner: Dev B. OCR text extraction for images and scanned PDFs using RapidOCR and PyMuPDF.
Guarantees:
- Zero external C system dependencies (pure Python wheels for onnxruntime and pymupdf)
- Fast CPU-based inference via ONNX Runtime
- In-memory rasterization of scanned PDF pages to PNG pixmaps
"""
from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import Any, BinaryIO

logger = logging.getLogger(__name__)

# Lazy singleton for the RapidOCR engine to prevent reload overhead
_ocr_engine: Any | None = None


def get_ocr_engine() -> Any:
    """Returns the singleton RapidOCR instance, lazily initialized on first use."""
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR

        _ocr_engine = RapidOCR()
    return _ocr_engine


def extract_image_text(
    source: str | Path | bytes | BinaryIO,
    min_confidence: float = 0.4,
) -> str:
    """Extracts text from an image (PNG, JPG, WEBP, etc.) using RapidOCR.

    Args:
        source: Image file path, raw bytes, or binary file stream.
        min_confidence: Threshold (0.0 - 1.0) below which OCR detections are ignored.

    Returns:
        Extracted text as a clean multi-line string.
    """
    img_data: str | bytes
    if isinstance(source, (str, Path)):
        p = Path(source)
        if not p.is_file():
            raise FileNotFoundError(f"Image file not found: {source}")
        img_data = str(p)
    elif isinstance(source, bytes):
        img_data = source
    elif hasattr(source, "read"):
        img_data = source.read()
    else:
        raise ValueError(f"Unsupported image source type: {type(source)}")

    engine = get_ocr_engine()
    try:
        result, _ = engine(img_data)
    except Exception as exc:
        logger.warning(f"RapidOCR extraction failed: {exc}")
        return ""

    if not result:
        return ""

    # Each detection is [bounding_box, text, confidence]
    lines: list[str] = []
    for item in result:
        if len(item) > 2 and item[1] and str(item[1]).strip():
            try:
                conf = float(item[2])
            except (ValueError, TypeError):
                conf = 0.0
            if conf >= min_confidence:
                lines.append(str(item[1]).strip())
    return "\n".join(lines).strip()


def ocr_pdf_pages(
    source: str | Path | bytes | BinaryIO,
    max_pages: int = 15,
    dpi: int = 150,
) -> str:
    """Renders PDF pages into images via PyMuPDF and runs RapidOCR on each page.

    Args:
        source: PDF file path, raw bytes, or binary stream.
        max_pages: Maximum number of pages to process.
        dpi: Resolution for rendering pages to pixmaps (150 DPI balances speed and OCR accuracy).

    Returns:
        Extracted text across all processed pages.
    """
    try:
        import pymupdf as fitz
    except ImportError:
        import fitz  # PyMuPDF fallback

    pdf_bytes: bytes
    if isinstance(source, (str, Path)):
        p = Path(source)
        if not p.is_file():
            raise FileNotFoundError(f"PDF file not found: {source}")
        pdf_bytes = p.read_bytes()
    elif isinstance(source, bytes):
        pdf_bytes = source
    elif hasattr(source, "read"):
        pdf_bytes = source.read()
    else:
        raise ValueError(f"Unsupported PDF source type: {type(source)}")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        logger.warning(f"PyMuPDF failed to open PDF document: {exc}")
        return ""

    page_texts: list[str] = []
    num_pages = min(len(doc), max_pages)

    for page_num in range(num_pages):
        page = doc[page_num]
        try:
            pix = page.get_pixmap(dpi=dpi)
            img_bytes = pix.tobytes("png")
            text = extract_image_text(img_bytes)
            if text.strip():
                page_texts.append(text.strip())
        except Exception as exc:
            logger.warning(f"Failed to render or OCR PDF page {page_num}: {exc}")

    return "\n\n".join(page_texts).strip()
