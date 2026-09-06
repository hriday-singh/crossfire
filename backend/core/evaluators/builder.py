"""
Owner: Dev A. Feasibility Test — "could this actually be built as described?"

No search, no evidence: that's `receipts` (Dev B). This one reasons about
buildability from the case text alone, so `Finding.evidence` is always empty
and `reconcile()` correctly gives it less weight than an evidence-backed
finding (see docs/dev-a/research/02-reconcile.md).
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from core.models import Case, Finding, TestPlanItem
from providers.base import LLMProvider

_SYSTEM_PROMPT = (
    "You are a senior builder judging whether a claim is actually implementable "
    "as stated — not whether it's a good idea. Consider the concrete build: the "
    "required data, integrations, permissions, latency, cost and operational "
    "burden. Name the single hardest blocker if there is one. If the claim is "
    "buildable with ordinary effort, say so plainly and set no blocker. "
    "Confidence is how sure you are of your own feasibility judgement, 0.0-1.0."
)


class BuilderVerdict(BaseModel):
    result: str = Field(description="One-sentence feasibility verdict")
    reasoning: str = Field(description="Why — the concrete build considerations")
    confidence: float = Field(ge=0.0, le=1.0)
    blocker: str | None = Field(
        default=None, description="The single hardest thing blocking the build, or null"
    )


async def run_builder(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    claim = next((c for c in case.claims if c.id == item.target_claim), None)
    statement = claim.statement if claim else item.objective

    messages = [
        {
            "role": "user",
            "content": (
                f"Decision under test: {case.raw_input}\n"
                f"Claim: {statement}\n"
                f"Failure mode to probe: {item.failure_mode}\n"
                f"Objective: {item.objective}"
            ),
        }
    ]
    verdict = await provider.generate(
        system_prompt=_SYSTEM_PROMPT,
        messages=messages,
        response_schema=BuilderVerdict,
    )
    return Finding(
        claim_id=item.target_claim,
        test_id=item.id,
        evaluator="builder",
        result=verdict.result,
        evidence=[],
        reasoning=verdict.reasoning,
        confidence=verdict.confidence,
        contradiction=verdict.blocker,
    )
