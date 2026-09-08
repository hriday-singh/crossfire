"""Force every checkable specific in a finding to be checkable.

The panel's job is to argue. Its failure mode is inventing a vendor, a statute or
a number to make an argument land — "Akamai edge bot protection", "Section 143
criminalises this" — neither of which any source we retrieved supports.

Crude on purpose. A wrongly marked specific costs a little confidence; a
fabricated specific presented as fact costs the whole memo.
"""
from __future__ import annotations

import re

from core.models import EvidenceItem, Finding

UNVERIFIED_MARKER = "[unverified]"

# A capitalised token, or a run of them: vendor, product and system names.
_PROPER = re.compile(r"\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,})*)\b")
# Statute-shaped references.
_STATUTE = re.compile(r"\b((?:Section|Article|Clause|Rule)\s+\d+[A-Za-z]?)\b")
# Percentages and quantities with a unit or scale word. No trailing \b: `%` is not
# a word character, so a boundary after it could never match ("58% of" ends on a space).
_QUANTITY = re.compile(
    r"\b(\d[\d,.]*\s*(?:%|(?:percent|million|billion|crore|lakh|thousand)\b))",
    re.IGNORECASE,
)

# Capitalised words that are grammar, not claims. Sentence openers dominate the
# list: they are capitalised for position, never because they name anything.
_STOP_PROPER = {
    "The", "This", "That", "These", "Those", "There", "Their", "They", "It", "Its",
    "If", "When", "While", "Because", "However", "Therefore", "Furthermore", "Since",
    "Although", "Though", "Unless", "Until", "After", "Before", "During", "Within",
    "Across", "Against", "Between", "Under", "Over", "Above", "Below", "Instead",
    "Rather", "Given", "Even", "Once", "Only", "Both", "Neither", "Either", "Every",
    "Each", "Most", "Many", "Some", "Any", "All", "Not", "But", "And", "For", "With",
    "Without", "Yet", "Still", "Also", "Thus", "Hence", "Where", "What", "Which",
    "Who", "How", "Why", "Whether", "Nothing", "Nobody", "Anyone", "Someone", "Here",
    "Are", "Was", "Were", "Has", "Have", "Had", "Can", "Could", "Should", "Would",
    "May", "Might", "Must", "Will", "Shall", "Does", "Did", "Doing", "Being",
    "Day", "One", "Two", "Three", "First", "Second", "Third",
    # Handled by _STATUTE, which keeps the number attached to the label.
    "Section", "Article", "Clause", "Rule",
}


def _evidence_text(evidence: list[EvidenceItem]) -> str:
    return " ".join(f"{e.title or ''} {e.snippet}" for e in evidence).lower()


def find_unsourced_specifics(text: str, evidence: list[EvidenceItem]) -> list[str]:
    """Returns the checkable specifics in `text` that no evidence snippet supports."""
    haystack = _evidence_text(evidence)
    candidates: list[str] = []
    for match in _STATUTE.finditer(text or ""):
        candidates.append(match.group(1))
    for match in _QUANTITY.finditer(text or ""):
        candidates.append(match.group(1))
    for match in _PROPER.finditer(text or ""):
        token = match.group(1)
        if token in _STOP_PROPER:
            continue
        candidates.append(token)

    unsourced: list[str] = []
    for candidate in candidates:
        if candidate.lower() in haystack:
            continue
        if candidate not in unsourced:
            unsourced.append(candidate)
    return unsourced


def _annotate(text: str | None, evidence: list[EvidenceItem]) -> str | None:
    if not text:
        return text
    if UNVERIFIED_MARKER in text:
        return text
    if find_unsourced_specifics(text, evidence):
        return f"{text.rstrip()} {UNVERIFIED_MARKER}"
    return text


def mark_unsourced(finding: Finding) -> Finding:
    """Appends the unverified marker to any finding text carrying unsourced specifics."""
    finding.contradiction = _annotate(finding.contradiction, finding.evidence)
    finding.reasoning = _annotate(finding.reasoning, finding.evidence) or finding.reasoning
    return finding


def has_unsourced_specifics(finding: Finding) -> bool:
    """True when this finding must not be allowed to carry the case verdict."""
    return UNVERIFIED_MARKER in (finding.contradiction or "") or UNVERIFIED_MARKER in (
        finding.reasoning or ""
    )
