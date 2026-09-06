"""
Owner: Dev B. Snippet curation, shared by receipts.py and ingestion/.
See docs/03-dev-B-evidence-receipts.md.
"""
from __future__ import annotations

import re
from typing import Any

STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren", "as",
    "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "cannot",
    "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had",
    "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if",
    "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not",
    "now", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own",
    "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very",
    "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your",
}


def curate_snippet(raw_text: str, claim_statement: str | Any) -> str:
    """Extracts 1 to 3 sentences most relevant to the claim from raw text.

    Guarantees:
    - Truncates arbitrary text to 1-3 sentences
    - Never passes full page text untouched
    - Keeps claim-relevant sentences based on keyword overlap
    """
    if hasattr(claim_statement, "statement"):
        statement = str(claim_statement.statement)
    else:
        statement = str(claim_statement)

    text = raw_text.strip()
    if not text:
        return ""

    raw_sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in raw_sentences if s.strip()]
    if not sentences:
        return text[:400]

    # Extract keywords from the claim statement
    claim_words = set(re.findall(r"\b\w+\b", statement.lower())) - STOPWORDS
    claim_words.update({"claim", "claims"})

    scored: list[tuple[int, int, int, str]] = []
    for idx, sentence in enumerate(sentences):
        s_words = set(re.findall(r"\b\w+\b", sentence.lower()))
        overlap = len(claim_words & s_words)
        # Sort by overlap desc, earlier position in text asc
        scored.append((overlap, -idx, idx, sentence))

    scored.sort(reverse=True)
    matches = [item for item in scored if item[0] > 0]
    if matches:
        top = matches[:3]
    else:
        top = scored[:min(3, len(scored))]

    # Preserve natural document order
    top.sort(key=lambda item: item[2])
    result = " ".join(item[3] for item in top)

    # Invariant guard: ensure result does not exceed 600 chars
    if len(result) > 600:
        truncated = result[:600]
        last_space = truncated.rsplit(" ", 1)
        result = last_space[0] + "." if len(last_space) > 1 else truncated

    return result


curate = curate_snippet

