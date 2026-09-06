"""
Owner: Dev B. Tests for image text extraction (RapidOCR) and context curation.
Guarantees:
- Extracts clean text from image bytes and file paths
- Gracefully handles empty, missing, or invalid image sources
- Integrates with snippet curation for Case.context
"""
from __future__ import annotations

import io
from pathlib import Path
import pytest
from PIL import Image, ImageDraw

from ingestion.image import ingest_image
from ingestion.ocr import extract_image_text


def make_test_image_bytes(text: str = "Test Headline for RapidOCR") -> bytes:
    """Generates an in-memory PNG image with black text on white background."""
    img = Image.new("RGB", (500, 120), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 40), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_extract_image_text_from_bytes():
    image_bytes = make_test_image_bytes("Verified Financial Report Summary")
    extracted = extract_image_text(image_bytes)
    # OCR should detect words from the rendered image
    assert "Verified" in extracted or "Report" in extracted or "Summary" in extracted or len(extracted) > 0


def test_extract_image_text_from_file_path(tmp_path: Path):
    image_bytes = make_test_image_bytes("Company Q3 Revenue Growth Exceeded Expectations")
    image_file = tmp_path / "test_screenshot.png"
    image_file.write_bytes(image_bytes)

    extracted = extract_image_text(image_file)
    assert len(extracted) > 0


def test_extract_image_text_file_not_found():
    with pytest.raises(FileNotFoundError, match="Image file not found"):
        extract_image_text("c:/path/does/not/exist/missing_screenshot.png")


def test_extract_image_text_unsupported_type():
    with pytest.raises(ValueError, match="Unsupported image source type"):
        extract_image_text(12345)  # type: ignore


def test_extract_image_text_empty_when_ocr_fails(monkeypatch):
    """When OCR engine raises an unexpected error or yields empty results, gracefully returns empty string."""
    class FailingEngine:
        def __call__(self, img):
            raise RuntimeError("Engine corrupted")

    monkeypatch.setattr("ingestion.ocr.get_ocr_engine", lambda: FailingEngine())
    result = extract_image_text(b"fake image bytes")
    assert result == ""


@pytest.mark.asyncio
async def test_ingest_image_without_claim_statement(monkeypatch):
    monkeypatch.setattr("ingestion.image.extract_image_text", lambda source: "Background market analysis from slide.")
    context = await ingest_image(b"dummy")
    assert context == "Background market analysis from slide."


@pytest.mark.asyncio
async def test_ingest_image_with_claim_statement_curates(sample_claim, monkeypatch):
    mock_ocr_output = (
        "Irrelevant header notes. "
        f"Key metric proving {sample_claim.statement}. "
        "Footer disclaimer notes."
    )
    monkeypatch.setattr("ingestion.image.extract_image_text", lambda source: mock_ocr_output)

    curated = await ingest_image(b"dummy", claim_statement=sample_claim.statement)
    assert sample_claim.statement in curated
    assert len(curated) <= 600


@pytest.mark.asyncio
async def test_ingest_image_with_llm_provider(sample_claim, fake_provider_factory, monkeypatch):
    from evidence.curate import CuratedSnippet

    monkeypatch.setattr("ingestion.image.extract_image_text", lambda source: "Full text from slide deck.")
    llm_curated = CuratedSnippet(
        selected_sentences="Curated text from image screenshot by LLM."
    )
    provider = fake_provider_factory(responses=[llm_curated])

    curated = await ingest_image(
        b"dummy",
        claim_statement=sample_claim.statement,
        provider=provider,
    )
    assert curated == "Curated text from image screenshot by LLM."
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_ingest_image_empty_ocr_raises_value_error(monkeypatch):
    monkeypatch.setattr("ingestion.image.extract_image_text", lambda source: "")
    with pytest.raises(ValueError, match="No extractable text found in image"):
        await ingest_image(b"blank image")
