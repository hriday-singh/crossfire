"""
Owner: Dev A. Hour-by-hour build order in docs/02-dev-A-core-loop-providers.md.
RESEARCH FIRST before implementing classify_load_bearing (docs/dev-a/research/01-load-bearing.md)
and reconcile (docs/dev-a/research/02-reconcile.md) — decide there first, then implement here.
"""
from __future__ import annotations

from uuid import uuid4

from pydantic import BaseModel

from core.models import Case, Claim, ClaimStatus, DecisionConsequence, Finding, TestPlanItem
from providers.base import LLMProvider


class ExtractedClaims(BaseModel):
    """Narrow extraction schema — not the frozen Case shape. Asking the model
    to fill Case's full fields directly risks hallucinated/unrequested fields;
    this stays small and gets mapped onto Case here."""

    statements: list[str]


async def extract_claims(raw_input: str, provider: LLMProvider) -> Case:
    system_prompt = (
        "Extract the discrete, checkable claims or assumptions embedded in the "
        "user's input. Each statement must be a single factual or predictive "
        "assertion that could independently turn out true or false."
    )
    result = await provider.generate(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": raw_input}],
        response_schema=ExtractedClaims,
    )
    claims = [Claim(id=str(uuid4()), statement=s) for s in result.statements]
    return Case(id=str(uuid4()), raw_input=raw_input, claims=claims, status="awaiting_confirmation")


class LoadBearingAnswer(BaseModel):
    answer: bool


LOAD_BEARING_QUESTION = (
    "If this claim turns out false, would the recommended decision materially change?"
)


async def classify_load_bearing(claim: Claim, case: Case, provider: LLMProvider) -> bool:
    system_prompt = (
        "You judge whether a single claim is load-bearing for a decision. "
        f"Answer only this question, yes or no: {LOAD_BEARING_QUESTION}"
    )
    messages = [
        {
            "role": "user",
            "content": f"Context: {case.raw_input}\nClaim: {claim.statement}",
        }
    ]
    result = await provider.generate(
        system_prompt=system_prompt,
        messages=messages,
        response_schema=LoadBearingAnswer,
    )
    return result.answer


# Keyword buckets, checked in order — first match wins. Routes claims by what
# they actually need tested, not round-robin across evaluators.
_FAILURE_MODE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("evidence", ("pay", "trust", "adopt", "will use", "demand")),
    ("behavior", ("will scale", "performance", "latency", "load", "concurrent")),
    ("constraint", ("compliance", "certif", "legal", "regulat", "theme", "screen")),
    ("alternative", ("only option", "no competitor", "unique", "first")),
]


def build_test_plan(case: Case) -> list[TestPlanItem]:
    items: list[TestPlanItem] = []
    for claim in case.claims:
        statement_lower = claim.statement.lower()
        failure_mode = "evidence"  # default: most claims need evidence testing
        for mode, keywords in _FAILURE_MODE_KEYWORDS:
            if any(kw in statement_lower for kw in keywords):
                failure_mode = mode
                break
        items.append(
            TestPlanItem(
                id=str(uuid4()),
                target_claim=claim.id,
                failure_mode=failure_mode,
                objective=f"Check whether evidence supports or contradicts: {claim.statement}",
            )
        )
    return items


class ReconcileVerdict(BaseModel):
    status: ClaimStatus
    reasoning: str


async def reconcile(
    claim: Claim, findings: list[Finding], provider: LLMProvider
) -> tuple[ClaimStatus, str]:
    system_prompt = (
        "You reconcile evaluator findings into a single verdict for a claim. "
        "Never vote — judge evidence quality directly. A finding with no evidence "
        "carries no weight regardless of what it claims. If findings assert opposite "
        "conclusions with comparable evidence, or evidence overall is thin/absent, "
        "the status must be 'unresolved' — never a forced winner. Otherwise pick "
        "'survived' (claim holds), 'weakened' (holds but with caveats), or 'broken' "
        "(claim is false). Explain which findings drove the verdict."
    )
    findings_summary = "\n".join(
        f"- evaluator={f.evaluator}, result={f.result!r}, evidence_count={len(f.evidence)}, "
        f"reasoning={f.reasoning!r}, contradiction={f.contradiction!r}"
        for f in findings
    )
    messages = [
        {
            "role": "user",
            "content": f"Claim: {claim.statement}\nFindings:\n{findings_summary}",
        }
    ]
    result = await provider.generate(
        system_prompt=system_prompt,
        messages=messages,
        response_schema=ReconcileVerdict,
    )
    return result.status, result.reasoning


def build_consequences(case: Case) -> list[DecisionConsequence]:
    raise NotImplementedError


async def run_pipeline(case_id: str) -> None:
    raise NotImplementedError
