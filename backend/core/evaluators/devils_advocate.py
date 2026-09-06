"""
Owner: Dev C. See docs/04-dev-C-api-sse-evaluators.md.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from core.models import Case, Claim, Finding, TestPlanItem
from providers.base import LLMProvider


class DevilsAdvocateOutput(BaseModel):
    """Structured output schema for Devil's Advocate assumption challenge."""

    result: str = Field(..., description="Summary of assumption test result")
    reasoning: str = Field(..., description="Analytical reasoning exposing premises, flaws, or risks")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence in the evaluation")
    contradiction: str | None = Field(None, description="Logical contradiction or contrary dynamic identified")


DEVILS_ADVOCATE_SYSTEM_PROMPT = (
    "You are the Devil's Advocate evaluator in the Crossfire decision validation pipeline. "
    "Your objective is the Assumption Test: rigorously stress-test the implicit assumptions, "
    "unstated premises, counter-incentives, and failure modes of a single target claim. "
    "Do not perform external web searches or rely on live evidence scraping; produce a pure, "
    "sharp, analytical critique of the claim based on reason and domain logic. "
    "Evaluate ONLY the single target claim provided — do not speculate on other unrelated matters."
)


async def run_devils_advocate(
    target: Claim | TestPlanItem,
    context_or_item: Case | TestPlanItem,
    provider_or_case: LLMProvider | Case | None = None,
    provider: LLMProvider | None = None,
) -> Finding:
    """
    Run Devil's Advocate evaluator on a claim/test item.
    Supports signatures:
      - run_devils_advocate(item: TestPlanItem, case: Case, provider: LLMProvider)
      - run_devils_advocate(claim: Claim, item: TestPlanItem, provider: LLMProvider)
      - run_devils_advocate(claim: Claim, item: TestPlanItem, case: Case, provider: LLMProvider)
    """
    if isinstance(target, Claim):
        claim = target
        item = context_or_item if isinstance(context_or_item, TestPlanItem) else None
        if isinstance(provider_or_case, Case):
            case = provider_or_case
            actual_provider = provider
        else:
            case = None
            actual_provider = provider_or_case
    else:
        item = target
        case = context_or_item if isinstance(context_or_item, Case) else None
        actual_provider = provider_or_case if hasattr(provider_or_case, "generate") else provider
        claim = next((c for c in case.claims if c.id == item.target_claim), None) if case else None

    if actual_provider is None:
        raise ValueError("LLMProvider must be provided to run_devils_advocate")

    claim_id = claim.id if claim else (item.target_claim if item else "")
    claim_statement = claim.statement if claim else (item.objective if item else "")
    test_id = item.id if item else f"test-{claim_id}"
    objective = item.objective if item else f"Stress-test assumption: {claim_statement}"

    # Only include the specific claim and general case context, never other claims
    context_str = case.raw_input if case else ""
    if case and case.context:
        context_str += f"\nAdditional Context: {case.context}"

    user_prompt = (
        f"Context: {context_str}\n\n"
        f"Target Claim to Test: {claim_statement}\n"
        f"Objective: {objective}\n\n"
        "Critique the core assumptions behind this claim. Expose hidden failure points or reasons "
        "why this assumption may fail."
    )

    response = await actual_provider.generate(
        system_prompt=DEVILS_ADVOCATE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
        response_schema=DevilsAdvocateOutput,
    )

    if isinstance(response, DevilsAdvocateOutput):
        return Finding(
            claim_id=claim_id,
            test_id=test_id,
            evaluator="devils_advocate",
            result=response.result,
            evidence=[],
            reasoning=response.reasoning,
            confidence=response.confidence,
            contradiction=response.contradiction,
        )

    # Fallback if response is string or other model
    reasoning_text = getattr(response, "reasoning", str(response))
    result_text = getattr(response, "result", "Assumption challenged")
    confidence_val = getattr(response, "confidence", 0.7)
    contradiction_val = getattr(response, "contradiction", None)

    return Finding(
        claim_id=claim_id,
        test_id=test_id,
        evaluator="devils_advocate",
        result=result_text,
        evidence=[],
        reasoning=reasoning_text,
        confidence=confidence_val,
        contradiction=contradiction_val,
    )

