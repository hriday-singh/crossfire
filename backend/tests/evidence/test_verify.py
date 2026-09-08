"""Owner: Dev A. Citation integrity — a snippet must come from the page it cites."""
from __future__ import annotations

import pytest

from core.models import EvidenceItem
from evidence.verify import snippet_matches, verification_counts, verify_evidence

PAGE = (
    "For Tatkal booking, opening day means one day in advance from date of "
    "departure of train from originating station. For AC classes, Tatkal "
    "Booking commences at 10:00 AM and for Non AC classes at 11:00 AM."
)


def _item(url: str, snippet: str) -> EvidenceItem:
    return EvidenceItem(source_url=url, snippet=snippet, retrieved_at="2026-09-08")


def test_snippet_matches_curated_paraphrase():
    snippet = "For AC classes Tatkal Booking commences at 10:00 AM"
    assert snippet_matches(snippet, PAGE, threshold=0.7) is True


def test_snippet_matches_ignores_case_and_punctuation():
    snippet = "tatkal booking commences at 10:00 am, for ac classes."
    assert snippet_matches(snippet, PAGE, threshold=0.7) is True


def test_snippet_absent_when_words_are_not_on_the_page():
    snippet = "IRCTC has blocked 30 million suspicious user IDs this fiscal year"
    assert snippet_matches(snippet, PAGE, threshold=0.7) is False


def test_empty_page_never_matches():
    assert snippet_matches("anything at all here", "", threshold=0.7) is False


def test_empty_snippet_never_matches():
    assert snippet_matches("", PAGE, threshold=0.7) is False


@pytest.mark.asyncio
async def test_verify_marks_matched_items(monkeypatch):
    async def fake_fetch(url, timeout=5.0):
        return PAGE

    monkeypatch.setattr("evidence.verify.fetch_page", fake_fetch)
    items = [_item("https://contents.irctc.co.in/en/tc.pdf", "Tatkal Booking commences at 10:00 AM")]
    result = await verify_evidence(items)
    assert len(result) == 1
    assert result[0].verified is True
    assert result[0].verification == "snippet_matched"


@pytest.mark.asyncio
async def test_verify_drops_fabricated_citation(monkeypatch):
    async def fake_fetch(url, timeout=5.0):
        return "This is an unrelated project showcase site."

    monkeypatch.setattr("evidence.verify.fetch_page", fake_fetch)
    items = [
        _item(
            "https://news.csraid.com/en/hub/irctc-blocks-30-million",
            "IRCTC has blocked 30 million suspicious user IDs",
        )
    ]
    result = await verify_evidence(items)
    assert result == []


@pytest.mark.asyncio
async def test_verify_keeps_unreachable_but_unverified(monkeypatch):
    async def fake_fetch(url, timeout=5.0):
        return ""

    monkeypatch.setattr("evidence.verify.fetch_page", fake_fetch)
    items = [_item("https://contents.irctc.co.in/en/Agent_Policy.pdf", "Tatkal Robot Facility is prohibited")]
    result = await verify_evidence(items)
    assert len(result) == 1
    assert result[0].verified is False
    assert result[0].verification == "unreachable"


@pytest.mark.asyncio
async def test_verify_treats_fetch_exception_as_unreachable(monkeypatch):
    async def fake_fetch(url, timeout=5.0):
        raise ValueError("Fetching private or unsafe URL is disallowed")

    monkeypatch.setattr("evidence.verify.fetch_page", fake_fetch)
    items = [_item("http://127.0.0.1/secret", "anything")]
    result = await verify_evidence(items)
    assert len(result) == 1
    assert result[0].verification == "unreachable"


@pytest.mark.asyncio
async def test_verify_is_a_no_op_when_disabled(monkeypatch):
    """The switch must not fetch at all, not merely ignore the result."""
    calls: list[str] = []

    async def fake_fetch(url, timeout=5.0):
        calls.append(url)
        return ""

    from config import get_settings

    monkeypatch.setattr("evidence.verify.fetch_page", fake_fetch)
    monkeypatch.setattr(get_settings(), "verify_citations", False)
    items = [_item("https://example.com", "x")]
    result = await verify_evidence(items)
    assert result == items
    assert calls == []


@pytest.mark.asyncio
async def test_verify_handles_an_empty_list():
    assert await verify_evidence([]) == []


def test_verification_counts_reports_each_bucket():
    items = [
        _item("https://a.example", "x"),
        _item("https://b.example", "y"),
        _item("https://c.example", "z"),
    ]
    items[0].verification = "snippet_matched"
    items[1].verification = "unreachable"
    counts = verification_counts(items)
    assert counts == {"matched": 1, "unreachable": 1, "unchecked": 1}
