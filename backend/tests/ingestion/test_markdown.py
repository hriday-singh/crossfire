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
async def test_ingest_markdown_without_claim_statement_returns_full_context():
    long_md = "# Header\n\n" + ("Word " * 600)
    result = await ingest_markdown(long_md)
    assert "# Header" in result
    assert result == long_md.strip()


@pytest.mark.asyncio
async def test_ingest_markdown_with_claim_statement_curates_context(sample_claim):
    sample_text = (
        "Some unrelated background filler about weather. "
        f"Key sentence directly relating to {sample_claim.statement}. "
        "More irrelevant corporate boilerplates."
    )
    curated_context = await ingest_markdown(sample_text, claim_statement=sample_claim.statement)
    assert sample_claim.statement in curated_context
    assert len(curated_context) <= 600

