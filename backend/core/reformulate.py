"""
Owner: Dev A / Dev C. Module for reformulating user decision prompts by integrating
Steel Man minimal viable solutions (salvaged claims) in place of invalidated assumptions.
"""
from __future__ import annotations

import logging
import re
from typing import Sequence

from pydantic import BaseModel, Field

from api.schemas import AppliedSalvage
from core.models import Case, Claim
from providers.base import LLMProvider

logger = logging.getLogger(__name__)

PROMPT_REFORMULATION_SYSTEM_PROMPT = (
    "You are the Decision Architecture Refiner in Crossfire.\n"
    "A user submitted an architectural, business, or operational proposal for adversarial testing. "
    "Adversarial evaluators tested the claims, and the Steel Man generated minimal viable fixes "
    "('salvaged claims') for the premises that failed.\n\n"
    "Your Mission:\n"
    "Rewrite the user's original proposal so that it naturally and coherently incorporates the "
    "Steel Man's solutions in place of the failed claims.\n\n"
    "Rules:\n"
    "1. Preserve the user's original objective, core intent, and voice.\n"
    "2. Substitute the refuted or weakened assumptions with the specified Steel Man salvages.\n"
    "3. Keep assumptions that were not refuted intact.\n"
    "4. Return ONLY the improved proposal text. Do not add introductory greetings, conversational fluff, "
    "or explanatory notes."
)


class ReformulatedPromptOutput(BaseModel):
    improved_prompt: str = Field(
        description="The complete, polished proposal text incorporating the Steel Man solutions in place of failed claims."
    )


def _extract_words(text: str) -> set[str]:
    """Extracts lowercase alphabetic words of length >= 3 for similarity scoring."""
    return set(re.findall(r"\b[a-zA-Z]{3,}\b", text.lower()))


def deterministic_prompt_replacement(
    original_prompt: str, salvages: Sequence[AppliedSalvage]
) -> str:
    """
    Deterministic rule-based replacer that substitutes original claim statements
    with Steel Man solutions using exact match, case-insensitive match, and sentence overlap.
    """
    if not salvages:
        return original_prompt

    improved = original_prompt

    unmatched_salvages: list[AppliedSalvage] = []

    for salvage in salvages:
        original = salvage.original_statement.strip()
        replacement = salvage.salvaged_claim.strip()
        if not original or not replacement:
            continue

        # 1. Exact match
        if original in improved:
            improved = improved.replace(original, replacement, 1)
            continue

        # 2. Case-insensitive substring match
        pattern = re.compile(re.escape(original), re.IGNORECASE)
        if pattern.search(improved):
            improved = pattern.sub(replacement, improved, count=1)
            continue

        # 3. Sentence-level token overlap
        claim_words = _extract_words(original)
        if not claim_words:
            unmatched_salvages.append(salvage)
            continue

        # Split into sentences
        sentences = re.split(r"(?<=[.!?])\s+", improved)
        best_idx = -1
        best_overlap = 0.0

        for i, sentence in enumerate(sentences):
            sentence_words = _extract_words(sentence)
            if not sentence_words:
                continue
            intersection = claim_words.intersection(sentence_words)
            overlap = len(intersection) / max(len(claim_words), 1)
            if overlap > best_overlap:
                best_overlap = overlap
                best_idx = i

        if best_idx >= 0 and best_overlap >= 0.28:
            sentences[best_idx] = replacement
            improved = " ".join(sentences)
            continue

        unmatched_salvages.append(salvage)

    # If any salvages couldn't be cleanly substituted inline, cleanly integrate them
    if unmatched_salvages:
        modifications = "\n".join(
            f"- {s.salvaged_claim.strip()}" for s in unmatched_salvages
        )
        improved = f"{improved.strip()}\n\n[Steel Man Adjustments]:\n{modifications}"

    return improved.strip()


async def reformulate_prompt_with_steelman(
    case: Case,
    selected_claim_ids: list[str],
    provider: LLMProvider | None = None,
    custom_instructions: str | None = None,
) -> tuple[str, list[AppliedSalvage]]:
    """
    Reformulates the original decision prompt by incorporating the Steel Man solutions
    for the selected failed claims. Uses LLM provider if available, with deterministic fallback.
    """
    selected_set = set(selected_claim_ids)
    applied_salvages: list[AppliedSalvage] = []

    for c in case.claims:
        if c.id in selected_set:
            salvaged = (c.salvaged_claim or "").strip()
            # Also check consequences if salvaged_claim wasn't on the claim directly
            if not salvaged:
                consequence = next(
                    (cq for cq in case.consequences if cq.claim_id == c.id), None
                )
                if consequence and consequence.salvaged_claim:
                    salvaged = consequence.salvaged_claim.strip()

            if salvaged:
                applied_salvages.append(
                    AppliedSalvage(
                        claim_id=c.id,
                        original_statement=c.statement,
                        salvaged_claim=salvaged,
                    )
                )

    if not applied_salvages:
        return case.raw_input, []

    # If provider is available, attempt LLM reformulation for natural prose synthesis
    if provider is not None:
        try:
            fixes_text = "\n".join(
                f"- Original Failed Premise: \"{s.original_statement}\"\n"
                f"  Steel Man Solution: \"{s.salvaged_claim}\""
                for s in applied_salvages
            )
            user_msg = (
                f"Original Proposal:\n{case.raw_input}\n\n"
                f"Steel Man Solutions to Incorporate:\n{fixes_text}\n"
            )
            if custom_instructions and custom_instructions.strip():
                user_msg += f"\nUser Guidance: {custom_instructions.strip()}\n"

            res = await provider.generate(
                system_prompt=PROMPT_REFORMULATION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
                response_schema=ReformulatedPromptOutput,
            )
            improved_text = getattr(res, "improved_prompt", None)
            if improved_text and improved_text.strip():
                return improved_text.strip(), applied_salvages
        except Exception as exc:
            logger.warning(
                "LLM prompt reformulation failed; falling back to deterministic replacement: %s",
                exc,
            )

    # Fallback to deterministic replacement
    improved = deterministic_prompt_replacement(case.raw_input, applied_salvages)
    return improved, applied_salvages
