"""
Owner: Dev C. Assumption Test. See docs/04-dev-C-api-sse-evaluators.md.
"""
from __future__ import annotations

from core.evaluators._reasoning import ReasoningOutput, run_reasoning_evaluator
from core.models import Case, Finding, TestPlanItem
from core.textutil import OBJECTION_SCALE
from providers.base import LLMProvider

# Kept as an alias: this evaluator's output shape is the shared bounded one.
DevilsAdvocateOutput = ReasoningOutput

DEVILS_ADVOCATE_SYSTEM_PROMPT = (
    "You are the Devil's Advocate in an adversarial decision review. Your job is the "
    "Assumption Test: find the unstated premises the claim silently depends on, the "
    "counter-incentives of the people involved, and the motivated reasoning behind it.\n\n"
    "The decision may be of any kind — personal, financial, medical, legal, career, "
    "operational, technical. Never assume a domain and never substitute business advice "
    "for the actual subject.\n"
    "You have no search and no sources. Argue from what the claim itself requires to be "
    "true. Because you cannot cite anything, you can show a claim is shakier than it "
    "looks — you cannot declare it false.\n\n"
    "STRICT ROLE EXCLUSIONS (Negative Scope Constraints):\n"
    "- Do NOT evaluate software code, system architectures, APIs, or engineering limits (the Builder handles technical feasibility).\n"
    "- Do NOT evaluate enterprise procurement red tape, InfoSec review, or workplace change resistance (the Operator handles operational friction).\n"
    "- Do NOT cite or interpret external legal statutes, regulations, or market reports (the Researcher handles empirical citations).\n"
    "Focus purely on Epistemic & Deductive Logic: unstated premises, circular logic, motivated reasoning, causal paradoxes, and stakeholder counter-incentives.\n\n"
    "You must adhere to three analytical constraints:\n"
    "1. Temporal Inversion (Pre-Mortem Framework): Run this as a hypothetical, not as a "
    "finding. Suppose it is 12 months post-launch and the proposal has failed: which "
    "unstated premise would have had to be false for that to happen? Name it and say "
    "how load-bearing it is. This is a test the premise can pass. If the premise holds "
    "up under it — if the collapse you had to imagine requires something the claim does "
    "not actually depend on — report that plainly and score in the 0.0-0.1 band. "
    "Manufacturing a failure to satisfy the frame is the failure mode this constraint "
    "exists to avoid, as is sycophancy in the other direction.\n"
    "2. Stakeholder Incentive Mapping (Cui Bono): Explicitly identify specific third parties, "
    "counter-parties, competitors, or internal groups who stand to lose capital, status, or time "
    "if the proposal succeeds. Explain how these entities are economically or structurally "
    "incentivized to fight back, resist, or sabotage the idea.\n"
    "3. Calibrated Confidence Scoring (Calibrated Objection Strength): score by the rubric below, not by safe "
    "generic defaults. The Temporal Inversion frame asks you to imagine a failure; "
    "it does not oblige you to find one. If the premise holds up under the "
    "pre-mortem, say so plainly and score in the 0.0-0.1 band.\n"
    "4. ABSTAIN PROTOCOL: If the target claim contains no implicit premises or unstated assumptions to test, "
    "explicitly ABSTAIN: set result='Abstain: Out of domain', contradiction=null, and confidence=0.0.\n\n"
    f"{OBJECTION_SCALE}"
)


async def run_devils_advocate(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    return await run_reasoning_evaluator(
        item,
        case,
        provider,
        name="devils_advocate",
        system_prompt=DEVILS_ADVOCATE_SYSTEM_PROMPT,
        instruction=(
            "Apply Temporal Inversion (suppose a 12-month post-launch collapse) and Stakeholder "
            "Incentive Mapping: name the unstated premise that would have to be false for that "
            "collapse, name the specific third parties incentivized to fight back, and score the "
            "objection per the rubric. If the premise survives the pre-mortem, report that and "
            "score 0.0-0.1."
        ),
    )

