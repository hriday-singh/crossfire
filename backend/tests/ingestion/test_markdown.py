"""
Tests for ingestion/markdown.py text extraction and context curation.
"""
from __future__ import annotations

import io
import pytest

from ingestion.markdown import extract_markdown_text, ingest_markdown


def test_extract_markdown_text_from_string():
    md = "# Project Specification\n\n- Feature A\n- Feature B\n\nAll assumptions verified."
    extracted = extract_markdown_text(md)
    assert "# Project Specification" in extracted
    assert "All assumptions verified." in extracted


def test_extract_markdown_text_from_bytes():
    md_bytes = b"## Architecture Overview\n\nDatabase: PostgreSQL\nCache: Redis\n"
    extracted = extract_markdown_text(md_bytes)
    assert "Database: PostgreSQL" in extracted


def test_extract_markdown_text_from_file(tmp_path):
    f = tmp_path / "notes.md"
    f.write_text("# Meeting Notes\n\nKey decision: deploy to multi-region.", encoding="utf-8")
    extracted = extract_markdown_text(f)
    assert "Key decision: deploy to multi-region." in extracted


def test_extract_markdown_text_empty_raises_value_error():
    with pytest.raises(ValueError, match="Empty Markdown document"):
        extract_markdown_text("   \n\n  \t  ")


@pytest.mark.asyncio
async def test_ingest_markdown_bounded_length():
    long_md = "# Header\n\n" + ("Word " * 600)
    result = await ingest_markdown(long_md)
    assert len(result) <= 2005
    assert result.endswith("...")
