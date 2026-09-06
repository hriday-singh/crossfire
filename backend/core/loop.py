"""
Owner: Dev A. Hour-by-hour build order in docs/02-dev-A-core-loop-providers.md.
RESEARCH FIRST before implementing classify_load_bearing (docs/dev-a/research/01-load-bearing.md)
and reconcile (docs/dev-a/research/02-reconcile.md) — decide there first, then implement here.
"""
from __future__ import annotations

import asyncio
from uuid import uuid4

from pydantic import BaseModel

import events
import store
from core.models import Case, Claim, ClaimStatus, DecisionConsequence, Finding, TestPlanItem
from providers import get_provider
from providers.base import LLMProvider

try:
    from core.evaluators import dispatch  # Dev C
except ImportError:  # not landed yet — the pipeline runs without findings until it is
    dispatch = None


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
    ("assumption", ("assume", "premise", "expect", "suppose", "believe", "willing", "natural", "obvious", "users prefer", "people want")),
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


_IMPACT_BY_STATUS = {
    ClaimStatus.BROKEN: "high",
    ClaimStatus.UNRESOLVED: "high",
    ClaimStatus.WEAKENED: "medium",
    ClaimStatus.SURVIVED: "low",
}

_RECOMMENDED_CHANGE_BY_STATUS = {
    ClaimStatus.BROKEN: "Drop or rework the assumption behind: {statement}",
    ClaimStatus.UNRESOLVED: "Treat as an open risk until validated: {statement}",
    ClaimStatus.WEAKENED: "Add a safeguard/caveat for: {statement}",
    ClaimStatus.SURVIVED: "No change needed.",
}


def build_consequences(case: Case) -> list[DecisionConsequence]:
    consequences = []
    for claim in case.claims:
        if claim.status is None:
            continue  # not yet tested, nothing to report

        impact = _IMPACT_BY_STATUS[claim.status] if claim.load_bearing else "low"
        recommended_change = _RECOMMENDED_CHANGE_BY_STATUS[claim.status].format(
            statement=claim.statement
        )

        next_validation = None
        if claim.load_bearing and claim.status in (ClaimStatus.BROKEN, ClaimStatus.UNRESOLVED):
            next_validation = f"Directly test: {claim.statement}"

        consequences.append(
            DecisionConsequence(
                claim_id=claim.id,
                impact=impact,
                recommended_change=recommended_change,
                next_validation=next_validation,
                verdict_reasoning=f"Reconciled as {claim.status.value} "
                f"({'load-bearing' if claim.load_bearing else 'not load-bearing'}).",
            )
        )
    return consequences


async def run_evaluators(
    case: Case, plan: list[TestPlanItem], provider: LLMProvider
) -> list[Finding]:
    """Every evaluator sees only its own TestPlanItem + the case — never another
    evaluator's output (docs/00-CONTRACTS.md §4). One failing evaluator must not
    take the run down, so exceptions come back as values and get dropped; the
    claim then reconciles on whatever findings survived.
    """
    if dispatch is None:
        return []
    for item in plan:
        await events.publish(
            case.id,
            "test_started",
            {
                "test_id": item.id,
                "target_claim_id": item.target_claim,
                "evaluator": item.failure_mode,
            },
        )
    results = await asyncio.gather(
        *(dispatch(item, case, provider) for item in plan), return_exceptions=True
    )
    findings = [r for r in results if isinstance(r, Finding)]
    for finding in findings:
        await events.publish(
            case.id,
            "finding_ready",
            {"finding": finding.model_dump(), "target_claim_id": finding.claim_id},
        )
    return findings


async def run_pipeline(case_id: str, provider: LLMProvider | None = None) -> None:
    """Background task started by `handle_confirm` — never awaited by a request
    handler. Emits the stage events in docs/00-CONTRACTS.md §3 as they happen
    and always closes the queue on the way out.
    """
    provider = provider or get_provider()
    case = store.get(case_id)
    if case is None:
        await events.publish(case_id, "error", {"stage": "start", "message": "unknown case"})
        await events.close(case_id)
        return

    try:
        case.status = "testing"

        flags = await asyncio.gather(
            *(classify_load_bearing(claim, case, provider) for claim in case.claims),
            return_exceptions=True,
        )
        if case.claims and all(isinstance(f, Exception) for f in flags):
            raise flags[0]

        for claim, load_bearing in zip(case.claims, flags):
            claim.load_bearing = load_bearing if isinstance(load_bearing, bool) else True


        case.test_plan = build_test_plan(case)
        case.findings = await run_evaluators(case, case.test_plan, provider)

        # Judge: parallel reconcile across claims, seeing all findings for each claim.
        async def _reconcile_single(clm: Claim) -> tuple[Claim, ClaimStatus, str]:
            claim_findings = [f for f in case.findings if f.claim_id == clm.id]
            if not claim_findings:
                return clm, ClaimStatus.UNRESOLVED, "No evaluator produced a finding for this claim."
            try:
                st, rsn = await reconcile(clm, claim_findings, provider)
                return clm, st, rsn
            except Exception as exc:
                return (
                    clm,
                    ClaimStatus.UNRESOLVED,
                    f"Reconciliation error ({exc}); marked unresolved.",
                )

        reconcile_results = await asyncio.gather(
            *(_reconcile_single(clm) for clm in case.claims)
        )

        reasonings: dict[str, str] = {}
        for clm, st, reasoning in reconcile_results:
            clm.status = st
            reasonings[clm.id] = reasoning
            await events.publish(
                case.id,
                "verdict_ready",
                {
                    "claim_id": clm.id,
                    "status": clm.status.value,
                    "verdict_reasoning": reasoning,
                },
            )

        case.consequences = build_consequences(case)
        for consequence in case.consequences:
            # build_consequences() can only synthesize this from status; the real
            # Judge reasoning only exists here, so it gets threaded in.
            consequence.verdict_reasoning = reasonings[consequence.claim_id]
            await events.publish(
                case.id, "consequence_ready", {"consequence": consequence.model_dump()}
            )

        case.status = "done"
        await events.publish(case.id, "run_complete", {"case_id": case.id})

    except Exception as exc:  # a dead provider shouldn't hang the stream open
        case.status = "error"
        await events.publish(case.id, "error", {"stage": "run_pipeline", "message": str(exc)})
    finally:
        store.set(case)
        await events.close(case.id)


# create_task returns a task the event loop only weakly references; without a
# strong ref it can be garbage-collected mid-run.
_background_tasks: set[asyncio.Task] = set()


async def handle_confirm(case_id: str, run_pipeline=run_pipeline) -> None:
    """What Dev C's `POST /cases/{id}/confirm` calls before returning 202.
    Schedules the run and returns immediately — awaiting it here would mean
    every SSE event fires before the frontend's stream connection exists.
    """
    task = asyncio.create_task(run_pipeline(case_id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
