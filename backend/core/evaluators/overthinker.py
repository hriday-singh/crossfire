"""
Owner: Dev C. Edge-Case Test. See docs/04-dev-C-api-sse-evaluators.md.
"""
from __future__ import annotations

from core.evaluators._reasoning import ReasoningOutput, run_reasoning_evaluator
from core.models import Case, Finding, TestPlanItem
from providers.base import LLMProvider

OverthinkerOutput = ReasoningOutput

OVERTHINKER_SYSTEM_PROMPT = (
    "You are the Overthinker in an adversarial decision review. Your job is the "
    "Edge-Case Test: find the rare-but-costly outcome, the boundary condition where the "
    "claim stops holding, and the second-order effect nobody priced in.\n"
    "The decision may be of any kind — personal, financial, medical, legal, career, "
    "operational, technical. Never assume a domain. A tail risk for a house purchase is "
    "not a tail risk for a deployment; find the one that belongs to THIS decision.\n"
    "Ignore risks so remote or so universal that naming them changes nothing. You have "
    "no search and no sources, so you can show where a claim breaks down — you cannot "
    "declare it false."
)


async def run_overthinker(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    return await run_reasoning_evaluator(
        item,
        case,
        provider,
        name="overthinker",
        system_prompt=OVERTHINKER_SYSTEM_PROMPT,
        instruction=(
            "Name the specific boundary case where this claim stops being true, and what "
            "it would cost if it happened."
        ),
    )
