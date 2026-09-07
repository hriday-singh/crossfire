"""
Shared runner for the two evidence-free evaluators (Devil's Advocate, Overthinker).

They differ only by prompt, so they share everything else: the one frozen
contract signature `(item, case, provider)` (docs/00-CONTRACTS.md §4), the
bounded output schema, and the Stage 3 output trimming.

Neither ever fetches anything, so `Finding.evidence` is always empty — which is
exactly why neither can break a claim on its own (Stage 1a evidence gate).
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from core.models import Case, Finding, TestPlanItem
from core.textutil import SPECIFICITY_RULE, clamp_sentences, one_line
from providers.base import LLMProvider


class ReasoningOutput(BaseModel):
    result: str = Field(description="One line, under 140 characters: what you found")
    reasoning: str = Field(description="At most 3 sentences of argument")
    confidence: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description=(
            "Objection strength against the claim: 0.0-0.1 (no real objection), 0.2-0.35 (minor), "
            "0.4-0.6 (needs a named fix), 0.7-0.85 (severe), 0.9-1.0 (hard limit)"
        ),
    )
    contradiction: str | None = Field(
        default=None, description="The specific contradiction or failure identified, or null"
    )


async def run_reasoning_evaluator(
    item: TestPlanItem,
    case: Case,
    provider: LLMProvider,
    *,
    name: str,
    system_prompt: str,
    instruction: str,
) -> Finding:
    if provider is None:
        raise ValueError(f"LLMProvider must be provided to run_{name}")

    claim = next((c for c in case.claims if c.id == item.target_claim), None)
    statement = claim.statement if claim else item.objective

    context = case.raw_input
    if case.context:
        ctx_excerpt = case.context[:4000] if len(case.context) > 4000 else case.context
        context += f"\nAdditional context: {ctx_excerpt}"

    case_id = getattr(case, "id", None)
    if case_id:
        try:
            from core.activity import emit_activity
            tag = "Assumption Test" if name == "devils_advocate" else "Edge-Case Test"
            text = (
                "Stress-testing implicit premises and unstated assumptions..."
                if name == "devils_advocate"
                else "Probing boundary conditions and tail risk failure modes..."
            )
            await emit_activity(
                case_id,
                tag=tag,
                text=text,
                claim_id=item.target_claim,
                action=name,
            )
        except Exception:
            pass

    response = await provider.generate(
        system_prompt=f"{system_prompt}\n\n{SPECIFICITY_RULE}",
        messages=[
            {
                "role": "user",
                "content": (
                    f"Decision under review: {context}\n\n"
                    f"Target claim (evaluate ONLY this one): {statement}\n"
                    f"Objective: {item.objective}\n\n{instruction}"
                ),
            }
        ],
        response_schema=ReasoningOutput,
    )

    res_text = getattr(response, "result", "") or "Claim examined"
    conf = float(getattr(response, "confidence", 0.7) or 0.0)
    contra = getattr(response, "contradiction", None)
    if res_text.lower().startswith("abstain") or (contra is None and conf <= 0.05):
        conf = 0.0
        contra = None

    return Finding(
        claim_id=item.target_claim,
        test_id=item.id,
        evaluator=name,
        result=one_line(res_text),
        evidence=[],
        reasoning=clamp_sentences(getattr(response, "reasoning", "") or str(response)),
        confidence=conf,
        contradiction=contra,
    )
