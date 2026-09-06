"""
Owner: Dev C / Antigravity. Operational Friction Test.
Evaluates claims against the 4 institutional friction pillars:
1. Incentive Alignment & Human Inertia
2. Enterprise Gatekeeping & Procurement Cycles
3. Legal Liability & Regulatory Ownership
4. Process Drag & Cold-Start Overhead
"""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

from core.models import Case, Finding, TestPlanItem
from core.textutil import SPECIFICITY_RULE, clamp_sentences, one_line
from providers.base import LLMProvider

OPERATOR_SYSTEM_PROMPT = (
    "You are the Operator evaluator in Crossfire, an adversarial system testing executive pitches and technical claims.\n"
    "Your role is the Operational Friction Test. You evaluate whether a claim is practically survivable when deployed into real organizations with real humans, corporate bureaucracy, and legal liability.\n\n"
    "Do NOT evaluate pure code/syntax feasibility (the Builder handles technical mechanics).\n"
    "Do NOT evaluate abstract logical syllogisms (Devil's Advocate handles deductive validity).\n"
    "Do NOT search the live web (Researcher handles external factual citations).\n\n"
    "Evaluate the claim against these 4 institutional realities:\n"
    "1. INCENTIVE ALIGNMENT: Why would frontline workers or end users bypass, sabotage, or refuse this workflow? Does it demand manual data entry, tagging, or behavior shifts without immediate, tangible benefits? Does it add unpaid cognitive load? Will frontline users find workarounds, ignore mandatory fields, or reject the tool outright under time pressure?\n"
    "2. ENTERPRISE GATEKEEPING: What InfoSec policies, procurement committees, vendor risk assessments, or data residency mandates will block adoption? Does the proposal assume rapid rollout while ignoring 6-18 month enterprise sales cycles, SOC 2 / ISO 27001 requirements, or central IT bans on browser extensions, desktop agents, or unvetted webhooks?\n"
    "3. REGULATORY LIABILITY: When an autonomous or assisted system errs, who takes the regulatory, financial, or legal blame? Does the proposal brush up against regulated boundaries (e.g., unauthorized practice of law, medical triage compliance, financial advisory restrictions, student visa auto-filing prohibitions)?\n"
    "4. PROCESS DRAG: Does the operational burden of verifying, managing, and configuring this system eliminate the claimed ROI? Does the system assume instantaneous two-sided participation or perfect historical documentation?\n\n"
    "Produce a rigorous, grounded assessment. If the claim is operationally sound and respects existing workflows, assign friction_type=\"none\" and operational_blocker=None.\n"
    "If it relies on naive assumptions about human compliance, frictionless enterprise approval, or unassigned liability, highlight the exact bottleneck."
)


class OperatorVerdict(BaseModel):
    result: str = Field(description="One line, under 140 characters: operational friction verdict")
    reasoning: str = Field(
        description="At most 3 sentences: analysis across the 4 friction pillars (incentives, red tape, liability, process drag)"
    )
    confidence: float = Field(default=0.7, ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    friction_type: Literal[
        "incentive_misalignment",
        "enterprise_gatekeeping",
        "regulatory_liability",
        "process_drag",
        "none",
    ] = Field(
        default="none",
        description="The primary friction pillar identified: incentive_misalignment, enterprise_gatekeeping, regulatory_liability, process_drag, or none",
    )
    operational_blocker: str | None = Field(
        default=None,
        description="The single critical operational bottleneck or blocker identified, or null if friction_type is 'none'",
    )
    contradiction: str | None = Field(
        default=None,
        description="Backward-compatible alias for operational_blocker",
    )



# Alias for backward compatibility
OperatorOutput = OperatorVerdict


async def run_operator(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    if provider is None:
        raise ValueError("LLMProvider must be provided to run_operator")

    claim = next((c for c in case.claims if c.id == item.target_claim), None)
    statement = claim.statement if claim else item.objective

    context = case.raw_input
    if case.context:
        context += f"\nAdditional context: {case.context}"

    case_id = getattr(case, "id", None)
    if case_id:
        try:
            from core.activity import emit_activity
            await emit_activity(
                case_id,
                tag="Operational Friction Test",
                text="Stress-testing organizational friction, adoption inertia, and regulatory liability...",
                claim_id=item.target_claim,
                action="operator",
            )
        except Exception:
            pass

    response = await provider.generate(
        system_prompt=f"{OPERATOR_SYSTEM_PROMPT}\n\n{SPECIFICITY_RULE}",
        messages=[
            {
                "role": "user",
                "content": (
                    f"Decision under review: {context}\n\n"
                    f"Target claim (evaluate ONLY this one): {statement}\n"
                    f"Failure mode to probe: {item.failure_mode}\n"
                    f"Objective: {item.objective}\n\n"
                    "Name the specific operational friction, adoption barrier, procurement gate, or liability issue that stalls this claim, "
                    "or confirm if it is operationally frictionless."
                ),
            }
        ],
        response_schema=OperatorVerdict,
    )

    result_text = getattr(response, "result", "") or "Operational friction examined"
    reasoning_text = getattr(response, "reasoning", "") or str(response)
    confidence_val = float(getattr(response, "confidence", 0.7) or 0.0)
    blocker = getattr(response, "operational_blocker", None) or getattr(response, "contradiction", None)

    return Finding(
        claim_id=item.target_claim,
        test_id=item.id,
        evaluator="operator",
        result=one_line(result_text),
        evidence=[],
        reasoning=clamp_sentences(reasoning_text),
        confidence=confidence_val,
        contradiction=blocker,
    )
