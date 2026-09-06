"""
Owner: Dev B. Tests for ingestion/pdf.py text extraction, scanned rejection,
and context curation. See docs/03-dev-B-evidence-receipts.md hour 35+ stretch.
"""
from __future__ import annotations

import io
import pytest
import pypdf
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ingestion.pdf import extract_pdf_text, ingest_pdf


def make_pdf_with_text(text: str) -> bytes:
    """Helper to generate an in-memory valid text PDF using pypdf."""
    w = pypdf.PdfWriter()
    p = w.add_blank_page(width=300, height=300)
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    content = f"BT /Helvetica 12 Tf 50 250 Td ({escaped}) Tj ET".encode("latin-1")
    stream = DecodedStreamObject()
    stream.set_data(content)
    p[NameObject("/Contents")] = stream
    p[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject(
                {
                    NameObject("/Helvetica"): DictionaryObject(
                        {
                            NameObject("/Type"): NameObject("/Font"),
                            NameObject("/Subtype"): NameObject("/Type1"),
                            NameObject("/BaseFont"): NameObject("/Helvetica"),
                        }
                    )
                }
            )
        }
    )
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def make_blank_pdf() -> bytes:
    """Helper to generate a blank (image-only / no-text) PDF."""
    w = pypdf.PdfWriter()
    w.add_blank_page(width=300, height=300)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def test_extract_pdf_text_from_bytes():
    pdf_bytes = make_pdf_with_text("This is an official document containing verified statements.")
    extracted = extract_pdf_text(pdf_bytes)
    assert "This is an official document containing verified statements." in extracted


def test_extract_pdf_text_from_file_path(tmp_path):
    pdf_bytes = make_pdf_with_text("File-based text extraction test payload.")
    file_path = tmp_path / "test_doc.pdf"
    file_path.write_bytes(pdf_bytes)

    extracted = extract_pdf_text(file_path)
    assert "File-based text extraction test payload." in extracted


def test_extract_pdf_text_file_not_found():
    with pytest.raises(FileNotFoundError, match="PDF file not found"):
        extract_pdf_text("c:/path/does/not/exist/fake_file.pdf")


def test_extract_pdf_text_scanned_or_blank_pdf_raises_value_error():
    """Scanned or image-only PDFs with no extractable text must cleanly raise ValueError (no OCR)."""
    blank_bytes = make_blank_pdf()
    with pytest.raises(ValueError, match="Scanned or image-only PDF detected"):
        extract_pdf_text(blank_bytes)


@pytest.mark.asyncio
async def test_ingest_pdf_without_claim_statement_returns_context():
    sample_text = "Background context from the ingested company report for review."
    pdf_bytes = make_pdf_with_text(sample_text)
    context = await ingest_pdf(pdf_bytes)
    assert "Background context from the ingested company report" in context


@pytest.mark.asyncio
async def test_ingest_pdf_with_claim_statement_curates_context(sample_claim):
    sample_text = (
        "Some unrelated background filler about weather. "
        f"Key sentence directly relating to {sample_claim.statement}. "
        "More irrelevant corporate boilerplates."
    )
    pdf_bytes = make_pdf_with_text(sample_text)
    curated_context = await ingest_pdf(pdf_bytes, claim_statement=sample_claim.statement)
    assert sample_claim.statement in curated_context
    assert len(curated_context) <= 600


@pytest.mark.asyncio
async def test_ingest_pdf_with_llm_provider(sample_claim, fake_provider_factory):
    from evidence.curate import CuratedSnippet

    sample_text = "Full extracted document text with lots of detailed terms."
    pdf_bytes = make_pdf_with_text(sample_text)

    llm_curated = CuratedSnippet(
        selected_sentences="Extracted and curated specifically by LLM."
    )
    provider = fake_provider_factory(responses=[llm_curated])

    curated_context = await ingest_pdf(
        pdf_bytes, claim_statement=sample_claim.statement, provider=provider
    )
    assert curated_context == "Extracted and curated specifically by LLM."
    assert len(provider.calls) == 1
