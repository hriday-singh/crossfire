"""
Owner: Dev A. Output-shaping helpers shared by every evaluator and the judge.

Stage 3 of the refinement plan: readability is fixed at *generation*, not by
truncating in the UI. These bounds are the deterministic backstop for when the
model ignores the prompt — nothing here is domain-specific, so it holds for a
career decision, a policy call or a system migration alike.
"""
from __future__ import annotations

import re

# Every evaluator prompt appends this. Domain-neutral on purpose: the "named
# specific" is whatever the decision actually contains, not a tech artefact.
SPECIFICITY_RULE = (
    "Output rules:\n"
    "- 'result' is ONE line, under 140 characters, stating what you found.\n"
    "- 'reasoning' is at most 3 sentences.\n"
    "- Name at least one concrete specific drawn from the claim or the evidence: "
    "a number, a date, a named party, a rule, a cost, a source. If you have none, "
    "say plainly that you have none.\n"
    "- Forbidden: 'consider', 'it is important to note', 'stakeholders', "
    "'leverage', 'robust', 'holistic', and any advice that would read the same "
    "for an unrelated decision."
)

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def clamp_sentences(text: str, max_sentences: int = 3, max_chars: int = 600) -> str:
    """Trim to whole sentences first, then hard-cap length on a word boundary."""
    text = " ".join((text or "").split())
    if not text:
        return text
    sentences = [s for s in _SENTENCE_SPLIT.split(text) if s]
    if len(sentences) > max_sentences:
        text = " ".join(sentences[:max_sentences])
    if len(text) > max_chars:
        head, _, _ = text[:max_chars].rpartition(" ")
        text = (head or text[:max_chars]).rstrip(",;:") + "…"
    return text


def one_line(text: str, max_chars: int = 140) -> str:
    """Collapse to a single line and cap it — `result` is a headline, not a paragraph."""
    text = " ".join((text or "").split())
    if len(text) <= max_chars:
        return text
    head, _, _ = text[:max_chars].rpartition(" ")
    return (head or text[:max_chars]).rstrip(",;:") + "…"
