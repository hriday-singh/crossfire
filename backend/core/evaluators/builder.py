"""
Owner: Dev A. Feasibility Test — "could this actually be done as described?"

No search, no evidence: that's `receipts` (Dev B). This one reasons about
buildability from the case text alone, so `Finding.evidence` is always empty
and `reconcile()` correctly gives it less weight than an evidence-backed
finding (see docs/dev-a/research/02-reconcile.md).
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from core.models import Case, Finding, TestPlanItem
from core.textutil import SPECIFICITY_RULE, clamp_sentences, one_line
from providers.base import LLMProvider

_SYSTEM_PROMPT = (
    "You judge whether a claim is actually achievable as stated — not whether it is a "
    "good idea. The decision may be of any kind: a purchase, a move, a treatment, a "
    "hire, a lawsuit, a build. Never assume a domain, and never answer with engineering "
    "concerns for a decision that has none.\n"
    "Work through what doing this actually takes: the time, the money, the skill, the "
    "permission or access required, who else has to agree, and what must happen first. "
    "Name the single hardest blocker if there is one. If it is achievable with ordinary "
    "effort, say so plainly and set no blocker.\n"
    "Confidence is how sure you are of your own judgement, 0.0-1.0."
)


class BuilderVerdict(BaseModel):
    result: str = Field(description="One line, under 140 characters: the feasibility verdict")
    reasoning: str = Field(description="At most 3 sentences: what doing this concretely requires")
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
    case_id = getattr(case, "id", None)
    if case_id:
        try:
            from core.activity import emit_activity
            await emit_activity(
                case_id,
                tag="Feasibility Test",
                text="Evaluating execution feasibility and operational blockers...",
                claim_id=item.target_claim,
                action="feasibility",
            )
        except Exception:
            pass

    verdict = await provider.generate(
        system_prompt=f"{_SYSTEM_PROMPT}\n\n{SPECIFICITY_RULE}",
        messages=messages,
        response_schema=BuilderVerdict,
    )
    return Finding(
        claim_id=item.target_claim,
        test_id=item.id,
        evaluator="builder",
        result=one_line(verdict.result),
        evidence=[],
        reasoning=clamp_sentences(verdict.reasoning),
        confidence=verdict.confidence,
        contradiction=verdict.blocker,
    )
