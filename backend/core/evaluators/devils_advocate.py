"""
Owner: Dev C. Assumption Test. See docs/04-dev-C-api-sse-evaluators.md.
"""
from __future__ import annotations

from core.evaluators._reasoning import ReasoningOutput, run_reasoning_evaluator
from core.models import Case, Finding, TestPlanItem
from providers.base import LLMProvider

# Kept as an alias: this evaluator's output shape is the shared bounded one.
DevilsAdvocateOutput = ReasoningOutput

DEVILS_ADVOCATE_SYSTEM_PROMPT = (
    "You are the Devil's Advocate in an adversarial decision review. Your job is the "
    "Assumption Test: find the unstated premises the claim silently depends on, the "
    "counter-incentives of the people involved, and the motivated reasoning behind it.\n"
    "The decision may be of any kind — personal, financial, medical, legal, career, "
    "operational, technical. Never assume a domain and never substitute business advice "
    "for the actual subject.\n"
    "You have no search and no sources. Argue from what the claim itself requires to be "
    "true. Because you cannot cite anything, you can show a claim is shakier than it "
    "looks — you cannot declare it false."
)


async def run_devils_advocate(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    return await run_reasoning_evaluator(
        item,
        case,
        provider,
        name="devils_advocate",
        system_prompt=DEVILS_ADVOCATE_SYSTEM_PROMPT,
        instruction=(
            "Name the assumption this claim rests on that its author has not noticed, "
            "and say what would have to be true for it to hold."
        ),
    )
