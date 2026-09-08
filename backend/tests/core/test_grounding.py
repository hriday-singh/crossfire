"""Owner: Dev A. Unsourced specifics — a named vendor, statute or number with no
source behind it gets marked, not printed as fact."""
from __future__ import annotations

from core.grounding import find_unsourced_specifics, has_unsourced_specifics, mark_unsourced
from core.models import EvidenceItem, Finding


def _ev(snippet: str) -> EvidenceItem:
    return EvidenceItem(source_url="https://example.com", snippet=snippet, retrieved_at="2026-09-08")


def test_flags_a_vendor_name_no_source_mentions():
    text = "Akamai edge bot protection blocks headless sessions."
    assert "Akamai" in find_unsourced_specifics(text, [_ev("an anti-bot system and CDN")])


def test_does_not_flag_a_vendor_the_evidence_names():
    text = "Akamai edge bot protection blocks headless sessions."
    assert find_unsourced_specifics(text, [_ev("IRCTC deployed Akamai bot manager")]) == []


def test_flags_a_statute_reference():
    text = "This violates Section 143 of the Indian Railways Act."
    found = find_unsourced_specifics(text, [_ev("unauthorised agents are punishable")])
    assert "Section 143" in found


def test_flags_a_bare_percentage():
    text = "Bots accounted for 58% of booking requests."
    assert "58%" in find_unsourced_specifics(text, [_ev("more than half of requests")])


def test_does_not_flag_a_percentage_the_evidence_carries():
    text = "Bots accounted for 58% of booking requests."
    assert find_unsourced_specifics(text, [_ev("bots made 58% of booking attempts")]) == []


def test_ordinary_prose_is_not_flagged():
    text = "The booking window is short and demand is high."
    assert find_unsourced_specifics(text, [_ev("demand exceeds supply")]) == []


def test_mark_unsourced_annotates_the_contradiction():
    finding = Finding(
        claim_id="c1",
        test_id="t1",
        evaluator="devils_advocate",
        result="refuted",
        reasoning="r",
        contradiction="Akamai edge bot protection blocks it.",
        evidence=[_ev("an anti-bot system and CDN")],
    )
    marked = mark_unsourced(finding)
    assert "[unverified]" in marked.contradiction
    assert has_unsourced_specifics(marked) is True


def test_mark_unsourced_leaves_grounded_findings_alone():
    finding = Finding(
        claim_id="c1",
        test_id="t1",
        evaluator="researcher",
        result="refuted",
        reasoning="r",
        contradiction="Tatkal opens at 10:00 AM for AC classes.",
        evidence=[_ev("For AC classes, Tatkal Booking commences at 10:00 AM")],
    )
    marked = mark_unsourced(finding)
    assert "[unverified]" not in (marked.contradiction or "")
    assert has_unsourced_specifics(marked) is False


def test_marking_is_idempotent():
    """The pipeline may mark the same finding twice; one marker, not two."""
    finding = Finding(
        claim_id="c1",
        test_id="t1",
        evaluator="devils_advocate",
        result="refuted",
        reasoning="r",
        contradiction="Akamai blocks it.",
        evidence=[],
    )
    once = mark_unsourced(finding).contradiction
    twice = mark_unsourced(finding).contradiction
    assert once == twice
    assert twice.count("[unverified]") == 1
