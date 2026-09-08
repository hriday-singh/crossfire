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
    "for an unrelated decision.\n"
    "\n"
    "GROUNDING RULE — every named specific must be checkable.\n"
    "If you name a vendor, a product, a statute, a named system, or a quantity, it "
    "must either appear in the evidence you were given, or you must write it followed "
    "by [unverified]. 'Akamai blocks this' with no source in hand is not an argument, "
    "it is a decoration. Reasoning without specifics is fine and is what you are for; "
    "inventing a specific to make reasoning sound like research is not."
)

# Every evaluator's `confidence` field means ONE thing: how hard this finding
# argues AGAINST the claim. Not "how sure am I of my own analysis" — that scale
# is unrankable across evaluators, because a Researcher who is certain the claim
# is FINE would score high on it and then sort above a Builder who found a hard
# blocker (see rank_findings). Objection strength is comparable; certainty is not.
#
# The 0.0-0.1 band is the important one. Without it a persona has no way to say
# "nothing here", so it invents friction to fill the field, and every claim
# collects four objections regardless of quality.
OBJECTION_SCALE = (
    "Calibrated objection strength ('confidence'):\n"
    "This float is NOT how sure you are of your own analysis. It is how hard "
    "your finding argues AGAINST the claim. Use the full range:\n"
    "- 0.0 to 0.1: No real objection. The claim is sound on your dimension, or "
    "the friction you found is the ordinary cost of doing this kind of thing. "
    "USE THIS BAND. A claim that is genuinely fine must be scoreable as fine, "
    "and inventing a token concern to avoid a low score is a failure.\n"
    "- 0.2 to 0.35: A real but minor issue, cheaply mitigated, that does not "
    "change whether the decision goes ahead.\n"
    "- 0.4 to 0.6: A substantive problem that changes the shape of the decision "
    "— it needs a named fix, a scope cut, or more budget.\n"
    "- 0.7 to 0.85: Severe. The claim as written probably does not hold without "
    "restructuring.\n"
    "- 0.9 to 1.0: Fatal. The claim contradicts a hard limit — physical, "
    "mathematical, statutory, or contractual.\n"
    "If the proposal names its own mitigation for a risk, that risk is not an "
    "objection to it. Do not score the failure the proposal already handles."
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


def format_concise_rationale(text: str, max_chars: int = 120) -> str:
    """Format an agent recommendation rationale into a concise sentence (fitting 2-3 lines)."""
    text = " ".join((text or "").split()).strip()
    if not text:
        return ""
    # Strip common redundant prefixes if present
    text = re.sub(
        r"^(?:why (?:selected|chosen|recommended):\s*|(?:agent )?rationale:\s*)",
        "",
        text,
        flags=re.IGNORECASE,
    )
    # Extract only the first sentence
    sentences = [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]
    first_sentence = sentences[0] if sentences else text
    if len(first_sentence) > max_chars:
        head, _, _ = first_sentence[:max_chars].rpartition(" ")
        first_sentence = (head or first_sentence[:max_chars]).rstrip(",;:") + "…"
    elif not first_sentence.endswith((".", "!", "?", "…")):
        first_sentence += "."
    return first_sentence


_EMPIRICAL_QUANT_PATTERN = re.compile(
    r"(\b\d+(\.\d+)?\s*(%|percent|qps|rps|ms|seconds?|mins?|minutes?|hours?|days?|months?|years?|usd|\$|k|m|b|gb|tb|mb|users|customers|queries)\b|\$\d+|\b\d+k\b)",
    re.IGNORECASE,
)
_EMPIRICAL_TERMS_PATTERN = re.compile(
    r"\b(market|competitor|competitors|industry|pricing|cost|costs|regulation|regulations|compliance|soc\s*2|hipaa|gdpr|sec|fda|law|statute|standard|standards|benchmark|benchmarks|adoption|survey|patent|court|contract|contracts|api|apis|sdk|vendor|vendors|aws|gcp|azure|postgres|postgresql|mysql|redis|openai|anthropic|stripe|google|apple|meta|microsoft|github|docker|kubernetes|saas|churn|retention|conversion|revenue|arr|mrr|cac|ltv|latency|throughput|uptime|sla|downtime|trust|distrust)\b",
    re.IGNORECASE,
)
_EMPIRICAL_COMPARE_PATTERN = re.compile(
    r"\b(unique|only|first|cheaper than|faster than|more expensive|unmatched|sole|exclusive|proprietary|superior to|nobody else|no other|widely used|industry standard|adoption rate|market share)\b",
    re.IGNORECASE,
)
_NON_EMPIRICAL_SUBJECTIVE_PATTERN = re.compile(
    r"\b(should use|should be|theme|dark theme|light theme|color|button color|font|aesthetic|looks better|we believe|our mission|philosophy|prefer|by definition|should lead)\b",
    re.IGNORECASE,
)


def is_empirical_claim(statement: str) -> bool:
    """Determines if a claim asserts verifiable real-world facts, metrics,
    outside benchmarks, or third-party realities requiring the Researcher (researcher).

    Claims that are purely subjective design choices, aesthetic preferences,
    internal definitions, or abstract logic return False.
    """
    if not statement:
        return False
    has_subjective = bool(_NON_EMPIRICAL_SUBJECTIVE_PATTERN.search(statement))
    has_quant = bool(_EMPIRICAL_QUANT_PATTERN.search(statement))
    has_terms = bool(_EMPIRICAL_TERMS_PATTERN.search(statement))
    has_compare = bool(_EMPIRICAL_COMPARE_PATTERN.search(statement))

    if has_subjective and not (has_quant or has_terms or has_compare):
        return False
    return has_quant or has_terms or has_compare or (not has_subjective)



