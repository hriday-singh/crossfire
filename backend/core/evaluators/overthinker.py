"""
Owner: Dev C. Stretch only. See docs/04-dev-C-api-sse-evaluators.md.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from core.models import Case, Claim, Finding, TestPlanItem
from providers.base import LLMProvider


class OverthinkerOutput(BaseModel):
    """Structured output schema for Overthinker edge-case challenge."""

    result: str = Field(..., description="Summary of edge-case test result")
    reasoning: str = Field(..., description="Analytical reasoning identifying edge cases and boundary failures")
    confidence: float = Field(0.7, ge=0.0, le=1.0, description="Confidence in the evaluation")
    contradiction: str | None = Field(None, description="Logical contradiction or edge vulnerability identified")


OVERTHINKER_SYSTEM_PROMPT = (
    "You are the Overthinker evaluator in the Crossfire decision validation pipeline. "
    "Your objective is the Edge-Case Test: identify rare but catastrophic edge cases, "
    "boundary condition breakdowns, unexpected systemic feedback loops, edge-case user behaviors, "
    "and tail risks of a single target claim. "
    "Do not perform external web searches or rely on live evidence scraping; produce a pure, "
    "rigorous analytical critique of the claim under extreme, degenerate, or edge scenarios. "
    "Evaluate ONLY the single target claim provided — do not speculate on other unrelated matters."
)


async def run_overthinker(
    target: Claim | TestPlanItem,
    context_or_item: Case | TestPlanItem,
    provider_or_case: LLMProvider | Case | None = None,
    provider: LLMProvider | None = None,
) -> Finding:
    """
    Run Overthinker evaluator on a claim/test item.
    Supports signatures:
      - run_overthinker(item: TestPlanItem, case: Case, provider: LLMProvider)
      - run_overthinker(claim: Claim, item: TestPlanItem, provider: LLMProvider)
      - run_overthinker(claim: Claim, item: TestPlanItem, case: Case, provider: LLMProvider)
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
        raise ValueError("LLMProvider must be provided to run_overthinker")

    claim_id = claim.id if claim else (item.target_claim if item else "")
    claim_statement = claim.statement if claim else (item.objective if item else "")
    test_id = item.id if item else f"test-{claim_id}"
    objective = item.objective if item else f"Find edge-case risks: {claim_statement}"

    context_str = case.raw_input if case else ""
    if case and case.context:
        context_str += f"\nAdditional Context: {case.context}"

    user_prompt = (
        f"Context: {context_str}\n\n"
        f"Target Claim to Test: {claim_statement}\n"
        f"Objective: {objective}\n\n"
        "Analyze this claim for extreme boundary conditions, catastrophic edge cases, and unexpected "
        "failure scenarios."
    )

    response = await actual_provider.generate(
        system_prompt=OVERTHINKER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
        response_schema=OverthinkerOutput,
    )

    if isinstance(response, OverthinkerOutput):
        return Finding(
            claim_id=claim_id,
            test_id=test_id,
            evaluator="overthinker",
            result=response.result,
            evidence=[],
            reasoning=response.reasoning,
            confidence=response.confidence,
            contradiction=response.contradiction,
        )

    reasoning_text = getattr(response, "reasoning", str(response))
    result_text = getattr(response, "result", "Edge-case vulnerability identified")
    confidence_val = getattr(response, "confidence", 0.7)
    contradiction_val = getattr(response, "contradiction", None)

    return Finding(
        claim_id=claim_id,
        test_id=test_id,
        evaluator="overthinker",
        result=result_text,
        evidence=[],
        reasoning=reasoning_text,
        confidence=confidence_val,
        contradiction=contradiction_val,
    )

