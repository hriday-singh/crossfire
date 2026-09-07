"""
Owner: Dev A. Extraction, planning, evaluation, reconciliation and synthesis.

Domain-neutral by construction. There are no keyword lists in this file: what a
claim needs tested is decided by the load-bearing ranking and the active agent
panel, never by string-matching words that only appear in the demo prompts. A
claim about a lease, a hiring decision, a clinical protocol or a database
migration all route the same way.
"""
from __future__ import annotations

import asyncio
import logging
from math import ceil
from uuid import uuid4

from pydantic import BaseModel, Field

import events
import store
from config import get_settings
from core.models import (
    Case,
    CaseVerdict,
    Claim,
    ClaimStatus,
    DecisionConsequence,
    Finding,
    NextAction,
    TestPlanItem,
)
from core.textutil import clamp_sentences, one_line
from core.activity import emit_activity
from providers import get_provider
from providers.base import LLMProvider

logger = logging.getLogger(__name__)

try:
    from core.evaluators import dispatch  # Dev C
except ImportError:  # not landed yet — the pipeline runs without findings until it is
    dispatch = None

from core.cross_examination import run_cross_examination_probes


# Re-exported: agent_panel and baseline were split out of this module, and
# `from core.loop import ...` stays the import path for everything downstream.
from core.agent_panel import (  # noqa: F401
    KNOWN_AGENTS,
    AGENT_FAILURE_MODE,
    FAILURE_MODE_TO_AGENT,
    AGENT_OBJECTIVE,
    DEFAULT_RATIONALES,
    SINGLE_PASS_PRIORITY,
    AgentPick,
    ExtractedClaims,
    normalize_agents,
    EXTRACTION_SYSTEM_PROMPT,
    build_test_plan,
)


async def extract_claims(
    raw_input: str,
    provider: LLMProvider,
    context: str | None = None,
    agent_mode: str = "auto",
    selected_agents: list[str] | None = None,
) -> Case:
    user_content = raw_input
    if context:
        prompt_ctx = context
        if len(context) > 8000:
            prompt_ctx = (
                context[:8000]
                + "\n\n[Context excerpted for claim extraction. Full document retained in case.]"
            )
        user_content = f"Proposal under evaluation:\n{raw_input}\n\nSupporting / Context Document:\n{prompt_ctx}"

    result = await provider.generate(
        system_prompt=EXTRACTION_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
        response_schema=ExtractedClaims,
    )

    statements = list(getattr(result, "statements", []) or [])[:5]
    claims_list = [Claim(id=str(uuid4()), statement=s) for s in statements]
    final_mode = (agent_mode or "auto").lower().strip()

    if final_mode == "custom" and selected_agents:
        valid = [a for a in selected_agents if a in KNOWN_AGENTS]
        active_agents = valid or list(KNOWN_AGENTS)
        rationales: dict[str, str] = {}
    else:
        # Auto mode is decided by the model that just read the decision, not by a
        # keyword table: which tests a claim needs depends on what it asserts, and
        # the same words mean different things in different domains.
        final_mode = "auto"
        active_agents, rationales = normalize_agents(getattr(result, "agents", []))

    # Input gate (Stage 5 / direction doc §3): an untestable input is redirected,
    # not silently turned into invented claims.
    if not getattr(result, "testable", True) or not statements:
        return Case(
            id=str(uuid4()),
            raw_input=raw_input,
            context=context,
            claims=[],
            status="needs_input",
            gate_message=one_line(
                getattr(result, "redirect", None)
                or "Name the specific decision you are weighing, and what you would do if it went wrong.",
                240,
            ),
            agent_mode=final_mode,
            selected_agents=active_agents,
            agent_rationales=rationales,
        )

    return Case(
        id=str(uuid4()),
        raw_input=raw_input,
        context=context,
        claims=claims_list,
        status="awaiting_confirmation",
        agent_mode=final_mode,
        selected_agents=active_agents,
        agent_rationales=rationales,
    )


LOAD_BEARING_QUESTION = (
    "If this claim turns out false, would the recommended decision materially change?"
)


class LoadBearingRanking(BaseModel):
    """Ranking, not N independent booleans — asked one claim at a time the model
    says yes to everything, and adaptive scrutiny stops existing."""

    ranked_indices: list[int] = Field(
        default_factory=list,
        description="Claim numbers (1-indexed), most load-bearing first. Every claim appears exactly once.",
    )
    load_bearing_count: int | None = Field(
        default=None,
        description="How many claims materially change the decision if false. Clamped to [0, ceil(n/2)]. If omitted, defaults to ceil(n/2).",
    )
    reasons: list[str] = Field(
        default_factory=list,
        description="One explanation per claim in the same order as ranked_indices, explaining why it is or is not load-bearing.",
    )


def load_bearing_cap(n_claims: int) -> int:
    return max(1, ceil(n_claims / 2)) if n_claims else 0


async def rank_load_bearing(case: Case, provider: LLMProvider) -> list[bool]:
    """Returns one flag per claim, in `case.claims` order.

    At most ceil(n/2) claims come back load-bearing. Dynamic classification allows
    between 0 and ceil(n/2) claims to be load-bearing. On any failure the top half
    by original order is used, so the run still differentiates.
    """
    claims = case.claims
    if not claims:
        return []

    cap = load_bearing_cap(len(claims))
    fallback = [i < cap for i in range(len(claims))]

    case_content = case.raw_input
    if case.context:
        case_content = f"Proposal: {case.raw_input}\nContext Document: {case.context}"

    numbered = "\n".join(f"{i + 1}. {c.statement}" for i, c in enumerate(claims))
    system_prompt = (
        "You rank the claims a decision rests on by how much weight they carry. "
        "The decision may be of any kind — never assume a domain.\n"
        f"Order them by this question, most load-bearing first: {LOAD_BEARING_QUESTION}\n"
        "Return every claim number exactly once. Do not add or drop claims.\n"
        f"State how many claims genuinely meet this standard in load_bearing_count (between 0 and at most {cap}).\n"
        "Provide a concise rationale in reasons for each ranked claim explaining its weight."
    )
    try:
        result = await provider.generate(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": f"Decision: {case_content}\nClaims:\n{numbered}"}],
            response_schema=LoadBearingRanking,
        )
        order = [i - 1 for i in (result.ranked_indices or []) if 1 <= i <= len(claims)]
        seen: list[int] = []
        for i in order:
            if i not in seen:
                seen.append(i)
        seen += [i for i in range(len(claims)) if i not in seen]

        count = cap
        if getattr(result, "load_bearing_count", None) is not None:
            count = max(0, min(cap, result.load_bearing_count))

        flags = [False] * len(claims)
        for i in seen[:count]:
            flags[i] = True

        reasons = getattr(result, "reasons", None) or []
        for rank_pos, claim_idx in enumerate(seen):
            claim = claims[claim_idx]
            claim.load_bearing = flags[claim_idx]
            if rank_pos < len(reasons) and reasons[rank_pos]:
                claim.load_bearing_reason = reasons[rank_pos]
            else:
                claim.load_bearing_reason = (
                    "Core load-bearing assumption for this decision."
                    if flags[claim_idx]
                    else "Secondary assumption; failure does not fundamentally alter the decision."
                )
        return flags
    except Exception as exc:
        logger.warning("Load-bearing ranking failed (%s); falling back to claim order.", exc)
        for i, claim in enumerate(claims):
            claim.load_bearing = fallback[i]
            claim.load_bearing_reason = (
                "Core load-bearing assumption (default ranking)."
                if fallback[i]
                else "Secondary assumption (default ranking)."
            )
        return fallback


from core.reconcile import (  # noqa: F401
    STEEL_MAN_PERSONA,
    STEEL_MAN_SYSTEM_PROMPT,
    SteelManVerdict,
    ReconcileVerdict,
    RECONCILE_SYSTEM_PROMPT,
    reconcile,
    has_sourced_contradiction,
    apply_evidence_gate,
    apply_steelman_gate,
    rank_findings,
)

from core.synthesis import (  # noqa: F401
    _IMPACT_BY_STATUS,
    _RECOMMENDED_CHANGE_BY_STATUS,
    build_consequences,
    StrategicConsequenceOutput,
    CONSEQUENCE_SYSTEM_PROMPT,
    _synthesize_single_consequence,
    synthesize_consequences,
    NextActionOutput,
    CaseVerdictOutput,
    _DECISION_STATES,
    _fallback_decision_state,
    CASE_VERDICT_SYSTEM_PROMPT,
    synthesize_case_verdict,
)



def _degraded_finding(item: TestPlanItem, exc: BaseException) -> Finding:
    """A failed evaluator becomes a visible degraded finding with None confidence, never silence.

    Not an `error` SSE event: routes.py terminates the stream on `error`, which
    would kill the whole run because one test failed.
    """
    evaluator_name = FAILURE_MODE_TO_AGENT.get(item.failure_mode, item.failure_mode)
    return Finding(
        claim_id=item.target_claim,
        test_id=item.id,
        evaluator=evaluator_name,
        result="System Error / Timeout",
        evidence=[],
        reasoning=f"System error or timeout occurred during evaluator execution ({type(exc).__name__}): {exc}",
        confidence=None,
        contradiction=None,
    )


async def run_evaluators(
    case: Case, plan: list[TestPlanItem], provider: LLMProvider
) -> list[Finding]:
    """Every evaluator sees only its own TestPlanItem + the case — never another
    evaluator's output (docs/00-CONTRACTS.md §4).

    Fan-out is capped and each call is bounded by a timeout: a full panel over
    five claims is ~20 concurrent LLM calls, and one hung provider connection
    should not hold the run open for the httpx default.
    """
    if dispatch is None:
        return []

    settings = get_settings()
    limit = asyncio.Semaphore(getattr(settings, "evaluator_concurrency", 8))
    timeout = getattr(settings, "evaluator_timeout_seconds", 60.0)

    for item in plan:
        evaluator_name = FAILURE_MODE_TO_AGENT.get(item.failure_mode, item.failure_mode)
        await events.publish(
            case.id,
            "test_started",
            {
                "test_id": item.id,
                "target_claim_id": item.target_claim,
                "failure_mode": item.failure_mode,
                "evaluator": evaluator_name,
            },
        )


    isolated_case = case.model_copy(
        update={"findings": [], "consequences": [], "case_verdict": None}
    )

    async def _run_one(item: TestPlanItem) -> Finding:
        async with limit:
            try:
                return await asyncio.wait_for(dispatch(item, isolated_case, provider), timeout=timeout)
            except Exception as exc:
                logger.warning(
                    "Evaluator %s failed for claim %s: %s", item.failure_mode, item.target_claim, exc
                )
                return _degraded_finding(item, exc)

    findings = list(await asyncio.gather(*(_run_one(item) for item in plan)))
    for finding in findings:
        await events.publish(
            case.id,
            "finding_ready",
            {"finding": finding.model_dump(), "target_claim_id": finding.claim_id},
        )
    return findings


def calculate_claim_confidence(status: ClaimStatus, max_objection: float) -> float:
    """Calculates overall claim confidence (0.0 to 1.0) for UI display.

    This inverts and calibrates the adversarial panel's objection scores:
    - SURVIVED: 90% - 98% (sound, with minor objections causing slight drops)
    - WEAKENED: 40% - 60% (substantive friction identified)
    - BROKEN: 5% - 15% (fatal refutation)
    - UNRESOLVED: 50% (neutral indeterminate)
    """
    if status == ClaimStatus.SURVIVED:
        return round(max(0.90, min(0.98, 0.98 - (max_objection * 0.40))), 2)
    elif status == ClaimStatus.WEAKENED:
        scaled = ((max(0.20, min(0.80, max_objection)) - 0.20) / 0.60) * 0.20
        return round(max(0.40, min(0.60, 0.60 - scaled)), 2)
    elif status == ClaimStatus.BROKEN:
        scaled = ((max(0.70, min(1.0, max_objection)) - 0.70) / 0.30) * 0.10
        return round(max(0.05, min(0.15, 0.15 - scaled)), 2)
    return 0.50


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
        await emit_activity(case.id, "Pipeline", "Classifying load-bearing assumptions...", action="load_bearing")

        flags = await rank_load_bearing(case, provider)
        for claim, load_bearing in zip(case.claims, flags):
            claim.load_bearing = load_bearing
            await events.publish(
                case.id,
                "load_bearing_ready",
                {
                    "claim_id": claim.id,
                    "load_bearing": claim.load_bearing,
                    "reason": claim.load_bearing_reason or "",
                },
            )

        case.test_plan = build_test_plan(case, panel=True, active_agents=case.selected_agents)
        lb_count = sum(1 for c in case.claims if c.load_bearing)
        await emit_activity(
            case.id,
            "Pipeline",
            f"Identified {lb_count} core assumption(s). Launching adversarial tests in parallel...",
            action="test_plan",
        )
        case.findings = await run_evaluators(case, case.test_plan, provider)
        if case.test_plan and case.findings and all(f.result == "System Error / Timeout" for f in case.findings):
            raise RuntimeError("All evaluators failed to return findings; provider is unavailable.")

        # Phase 1.5: Targeted Cross-Examination Probes
        try:
            probe_findings = await run_cross_examination_probes(case, case.findings, provider)
            if probe_findings:
                case.findings.extend(probe_findings)
                for pf in probe_findings:
                    await events.publish(
                        case.id,
                        "finding_ready",
                        {"finding": pf.model_dump(), "target_claim_id": pf.claim_id},
                    )
        except Exception as exc:
            logger.warning("Cross-examination stage failed (%s); proceeding with original findings.", exc)

        # Steelman: parallel reconcile across claims, seeing all findings for each claim.
        # Bounded by configurable semaphore to prevent upstream proxy queuing.
        settings = get_settings()
        steelman_limit = asyncio.Semaphore(getattr(settings, "steelman_concurrency", 3))
        steelman_errors: list[BaseException] = []
        reasonings: dict[str, str] = {}

        async def _reconcile_single(clm: Claim) -> tuple[Claim, ClaimStatus, str]:
            claim_findings = [f for f in case.findings if f.claim_id == clm.id]
            if not claim_findings:
                clm.status = ClaimStatus.UNRESOLVED
                clm.confidence = calculate_claim_confidence(ClaimStatus.UNRESOLVED, 0.0)
                clm.fatal_flaw = None
                clm.salvaged_claim = None
                clm.tradeoff_acknowledged = None
                reasoning = "No evaluator produced a finding for this claim."
            else:
                await emit_activity(
                    case.id,
                    "Steelman",
                    f"Reconciling evidence for: {clm.statement[:55]}...",
                    claim_id=clm.id,
                    action="reconciling",
                )
                try:
                    async with steelman_limit:
                        verdict = await reconcile(clm, claim_findings, provider)
                    if isinstance(verdict, SteelManVerdict):
                        gated = apply_steelman_gate(verdict, claim_findings)
                        clm.status = gated.status
                        clm.fatal_flaw = gated.fatal_flaw
                        clm.salvaged_claim = gated.salvaged_claim
                        clm.tradeoff_acknowledged = gated.tradeoff_acknowledged
                        max_obj = max((f.confidence for f in claim_findings if f.confidence is not None), default=0.0)
                        clm.confidence = calculate_claim_confidence(clm.status, max_obj)
                        reasoning = gated.reasoning
                    else:
                        st, rsn = verdict
                        gated_st, gated_rsn = apply_evidence_gate(st, rsn, claim_findings)
                        clm.status = gated_st
                        max_obj = max((f.confidence for f in claim_findings if f.confidence is not None), default=0.0)
                        clm.confidence = calculate_claim_confidence(clm.status, max_obj)
                        reasoning = gated_rsn
                except Exception as exc:
                    steelman_errors.append(exc)
                    clm.status = ClaimStatus.UNRESOLVED
                    clm.confidence = calculate_claim_confidence(ClaimStatus.UNRESOLVED, 0.0)
                    clm.fatal_flaw = None
                    clm.salvaged_claim = None
                    clm.tradeoff_acknowledged = None
                    reasoning = f"Reconciliation error ({exc}); marked unresolved."

            reasonings[clm.id] = reasoning
            await events.publish(
                case.id,
                "verdict_ready",
                {
                    "claim_id": clm.id,
                    "status": clm.status.value,
                    "confidence": clm.confidence,
                    "verdict_reasoning": reasoning,
                    "fatal_flaw": clm.fatal_flaw,
                    "salvaged_claim": clm.salvaged_claim,
                    "tradeoff_acknowledged": clm.tradeoff_acknowledged,
                },
            )
            return clm, clm.status, reasoning

        await asyncio.gather(*(_reconcile_single(clm) for clm in case.claims))
        if case.claims and len(steelman_errors) == len(case.claims):
            raise steelman_errors[0]

        # The drawer reads case.findings in order; lead with what moved the verdict.
        case.findings = [
            f
            for clm in case.claims
            for f in rank_findings([x for x in case.findings if x.claim_id == clm.id])
        ] + [f for f in case.findings if f.claim_id not in {c.id for c in case.claims}]

        case.consequences = build_consequences(case)
        for consequence in case.consequences:
            # build_consequences() can only synthesize this from status; the real
            # Steelman reasoning only exists here, so it gets threaded in.
            if consequence.claim_id in reasonings:
                consequence.verdict_reasoning = reasonings[consequence.claim_id]
            matching_claim = next((c for c in case.claims if c.id == consequence.claim_id), None)
            if matching_claim:
                consequence.fatal_flaw = matching_claim.fatal_flaw
                consequence.salvaged_claim = matching_claim.salvaged_claim
                consequence.tradeoff_acknowledged = matching_claim.tradeoff_acknowledged

        # Overlap consequence LLM refinement and case verdict synthesis concurrently
        async def _synthesize_consequences_task() -> list[DecisionConsequence]:
            try:
                await emit_activity(
                    case.id,
                    "Synthesis",
                    "Formulating strategic adaptations and next validation steps...",
                    action="consequences",
                )
                return await synthesize_consequences(case, provider, reasonings=reasonings)
            except Exception as exc:
                logger.debug("Synthesizing consequences fallback: %s", exc)
                return case.consequences

        async def _synthesize_case_verdict_task() -> CaseVerdict:
            return await synthesize_case_verdict(case, provider)

        synthesized_consequences, synthesized_verdict = await asyncio.gather(
            _synthesize_consequences_task(),
            _synthesize_case_verdict_task(),
        )
        case.consequences = synthesized_consequences
        case.case_verdict = synthesized_verdict

        for consequence in case.consequences:
            matching_claim = next((c for c in case.claims if c.id == consequence.claim_id), None)
            if matching_claim:
                if matching_claim.fatal_flaw and not consequence.fatal_flaw:
                    consequence.fatal_flaw = matching_claim.fatal_flaw
                if matching_claim.salvaged_claim and not consequence.salvaged_claim:
                    consequence.salvaged_claim = matching_claim.salvaged_claim
                if matching_claim.tradeoff_acknowledged and not consequence.tradeoff_acknowledged:
                    consequence.tradeoff_acknowledged = matching_claim.tradeoff_acknowledged
            await events.publish(
                case.id, "consequence_ready", {"consequence": consequence.model_dump()}
            )

        await events.publish(
            case.id, "case_verdict", {"case_verdict": case.case_verdict.model_dump()}
        )

        await emit_activity(
            case.id,
            "Pipeline",
            "Verification complete: Decision memo assembled.",
            action="complete",
        )
        case.status = "done"
        await events.publish(case.id, "run_complete", {"case_id": case.id})

    except Exception as exc:  # a dead provider shouldn't hang the stream open
        case.status = "error"
        await events.publish(case.id, "error", {"stage": "run_pipeline", "message": str(exc)})
    finally:
        store.set(case)
        await events.close(case.id)


from core.baseline import BASELINE_SYSTEM_PROMPT, run_baseline  # noqa: F401


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
