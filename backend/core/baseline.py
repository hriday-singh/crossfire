"""
Baseline single-prompt response generator (Stage 6).
Provides an expert, well-engineered single-prompt comparison answer on the same decision input.
Deliberately not sandbagged: represents the output of a skilled prompt engineer using
customized, structured decision-analysis prompting.
"""
from __future__ import annotations

from providers.base import LLMProvider

BASELINE_SYSTEM_PROMPT = (
    "You are a top-tier principal decision analyst, systems architect, and strategic advisor. "
    "Your objective is to provide an unsparing, highly analytical, and evidence-grounded evaluation of "
    "proposals, strategic plans, and high-stakes decisions.\n\n"
    "Guidelines:\n"
    "- Never default to flattery, superficial agreement, or generic corporate filler.\n"
    "- Treat this as an expert appraisal: actively scrutinize implicit assumptions, execution friction, "
    "mathematical/arithmetic soundness, regulatory/compliance boundaries, and asymmetric downside tail risks.\n"
    "- If reference documentation, scraped web context, or background source text is provided, actively cross-examine "
    "the proposal against the source evidence. Flag any direct contradictions, unstated constraints, or numerical discrepancies.\n"
    "- Structure your appraisal into clear, actionable sections:\n"
    "  1. Executive Assessment & Bottom-Line Call (explicit verdict: Proceed, Proceed with Changes, Hold, or Drop; with key rationale)\n"
    "  2. Critical Failure Modes & Bottlenecks (operational, legal/regulatory, technical, financial, and market dynamics)\n"
    "  3. Load-Bearing Assumptions & Fragility (the exact premises that must hold true for this to succeed, and how likely they are to fail)\n"
    "  4. Evidence & Context Synthesis (cross-reference against provided background facts or known industry benchmarks)\n"
    "  5. Strategic Tradeoffs & Salvage Adjustments (concrete modifications, phased mitigations, or alternative architectures to de-risk)"
)


async def run_baseline(raw_input: str, provider: LLMProvider, context: str | None = None) -> str:
    """A skilled, well-prompted single model call on the same input (Stage 6).

    Deliberately not sandbagged: represents a thoughtful, expert prompt rather than a naive copy-paste.
    Incorporates scraped or uploaded context if provided.
    """
    user_prompt = (
        "Please conduct a comprehensive, expert evaluation of the following proposal/decision:\n\n"
        f"### Proposal\n{raw_input.strip()}\n"
    )
    if context:
        ctx_excerpt = context[:12000] if len(context) > 12000 else context
        user_prompt += (
            f"\n### Background & Reference Context (Scraped / Ingested Material)\n"
            f"{ctx_excerpt.strip()}\n\n"
            "Carefully cross-examine the proposal against the facts, constraints, and metrics in this reference material."
        )

    user_prompt += (
        "\n\nProvide an unsparing, high-caliber evaluation adhering to the 5-part analytical framework: "
        "Executive Assessment, Critical Failure Modes, Load-Bearing Assumptions, Evidence & Context Synthesis, "
        "and Strategic Salvage Adjustments."
    )

    response = await provider.generate(
        system_prompt=BASELINE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return response if isinstance(response, str) else str(response)

