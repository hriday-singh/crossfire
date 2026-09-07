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
from core.textutil import OBJECTION_SCALE, SPECIFICITY_RULE, clamp_sentences, one_line
from providers.base import LLMProvider

BUILDER_SYSTEM_PROMPT = (
    "You judge whether a claim is actually achievable as stated — not whether it is a "
    "good idea. The decision may be of any kind: a purchase, a move, a treatment, a "
    "hire, a lawsuit, a build. Never assume a domain, and never answer with engineering "
    "concerns for a decision that has none.\n\n"
    "Work through what doing this actually takes: the time, the money, the skill, the "
    "permission or access required, who else has to agree, and what must happen first. "
    "If it is achievable with ordinary effort, say so plainly and set blocker to null.\n\n"
    "You must adhere to three technical constraints:\n"
    "1. MVP vs. Scale Bifurcation (CRITICAL PRIORITY):\n"
    "   Do not conflate long-term scaling challenges with immediate launch blockers. "
    "   If a blocker exists, you must explicitly categorize and prefix it as either:\n"
    "   - '[Day-1 Blocker]': A fundamental technical impossibility, dependency absence, or compliance wall preventing the initial MVP launch.\n"
    "   - '[Day-1000 Blocker]': An architectural bottleneck, state synchronization limit, or data volume constraint that only breaks under massive scale.\n"
    "   If the MVP can realistically launch today, it is NOT a Day-1 blocker.\n\n"
    "2. Lightweight Threat Modeling:\n"
    "   Conduct a baseline security vulnerability assessment before code is written. "
    "   Explicitly identify the most likely data exposure vector, privilege escalation, "
    "   or spoofing risk inherent in the proposed architecture or implementation.\n\n"
    "3. Calibrated Confidence Scoring (Calibrated Objection Strength):\n"
    "   Score by the rubric below. Standard overhead is not an objection: if the thing "
    "is achievable with ordinary effort, set blocker to null and score in the 0.0-0.1 "
    "band (or 0.1 to 0.3 for minor friction). Do not utilize quantitative token or latency estimations.\n\n"
    f"{OBJECTION_SCALE}"
)
_SYSTEM_PROMPT = BUILDER_SYSTEM_PROMPT


class BuilderVerdict(BaseModel):
    result: str = Field(description="One line, under 140 characters: the feasibility verdict")
    reasoning: str = Field(
        description=(
            "At most 3 sentences: what doing this concretely requires, noting baseline threat model risks "
            "(data exposure, privilege escalation, spoofing) or operational friction"
        )
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Objection strength against the claim: 0.0-0.1 (buildable as stated, no real objection), "
            "0.2-0.35 (minor friction), 0.4-0.6 (needs a named fix or more budget), "
            "0.7-0.85 (severe, needs restructuring), 0.9-1.0 (hard limit / statutory wall)"
        ),
    )
    blocker: str | None = Field(
        default=None,
        description=(
            "The single hardest blocker prefixed with '[Day-1 Blocker]' or '[Day-1000 Blocker]', "
            "or null if achievable with ordinary effort"
        ),
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
                f"Objective: {item.objective}\n\n"
                "Constraints for this evaluation:\n"
                "1. MVP vs. Scale Bifurcation: If a blocker exists, prefix it with '[Day-1 Blocker]' (launch blocker) "
                "or '[Day-1000 Blocker]' (scale limit). Do not call scaling issues Day-1 blockers.\n"
                "2. Lightweight Threat Modeling: Explicitly account for data exposure, privilege escalation, or spoofing risks.\n"
                "3. Calibrated Confidence Scoring (Calibrated Objection Strength): follow the rubric, and use the 0.0-0.1 band when the claim "
                "is simply buildable. Do not use speculative quantitative token or latency estimations."
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
