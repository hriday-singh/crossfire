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
        user_content = f"Proposal under evaluation:\n{raw_input}\n\nSupporting / Context Document:\n{context}"

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
        if claim.salvaged_claim:
            if claim.tradeoff_acknowledged:
                recommended_change = (
                    f"Salvaged claim: {claim.salvaged_claim} "
                    f"(Trade-off: {claim.tradeoff_acknowledged})"
                )
            else:
                recommended_change = f"Salvaged claim: {claim.salvaged_claim}"
        else:
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
                fatal_flaw=claim.fatal_flaw,
                salvaged_claim=claim.salvaged_claim,
                tradeoff_acknowledged=claim.tradeoff_acknowledged,
            )
        )
    return consequences


class StrategicConsequenceOutput(BaseModel):
    impact: str = Field(description="Impact level: 'high', 'medium', or 'low'")
    recommended_change: str = Field(
        description="One concrete change to the decision itself, specific to what failed. Never generic."
    )
    next_validation: str | None = Field(
        default=None,
        description="The smallest, cheapest real check that would settle this before committing. Null if survived.",
    )


CONSEQUENCE_SYSTEM_PROMPT = (
    "One claim a decision rests on has been tested and did not fully hold. Say what "
    "changes as a result. The decision may be of any kind — a purchase, a treatment, a "
    "hire, a move, a build — so never assume a domain and never reach for business "
    "jargon that does not fit it.\n"
    "1. 'impact': 'high' if load-bearing and broken/unresolved, 'medium' if weakened, else 'low'.\n"
    "2. 'recommended_change': one concrete change to this decision, in one or two "
    "sentences, referencing what specifically failed. Not 'rework the assumption'.\n"
    "3. 'next_validation': the smallest, cheapest real check that would settle it — "
    "a call to make, a document to read, a small trial to run, a number to look up. "
    "It must be something a person could start this week."
)


async def _synthesize_single_consequence(
    consequence: DecisionConsequence,
    claim: Claim,
    case: Case,
    findings: list[Finding],
    provider: LLMProvider,
) -> DecisionConsequence:
    if claim.status == ClaimStatus.SURVIVED:
        return consequence

    try:
        findings_ctx = "\n".join(
            f"- [{f.evaluator}]: result={f.result} | reasoning={f.reasoning} | contradiction={f.contradiction}"
            for f in findings
        )
        mitigation_info = ""
        if claim.fatal_flaw or claim.salvaged_claim:
            mitigation_info = (
                f"\nSteel Man Mitigation Analysis:\n"
                f"- Fatal Flaw: {claim.fatal_flaw or 'None'}\n"
                f"- Salvaged Claim: {claim.salvaged_claim or 'None'}\n"
                f"- Trade-off Acknowledged: {claim.tradeoff_acknowledged or 'None'}"
            )
        result = await provider.generate(
            system_prompt=CONSEQUENCE_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Decision under review: {case.raw_input}\n"
                        f"Claim: {claim.statement}\n"
                        f"Verdict: {claim.status.value if claim.status else 'untested'} "
                        f"(load-bearing: {claim.load_bearing})\n"
                        f"Findings:\n{findings_ctx or 'No detailed findings.'}"
                        f"{mitigation_info}"
                    ),
                }
            ],
            response_schema=StrategicConsequenceOutput,
        )
        if isinstance(result, StrategicConsequenceOutput):
            if result.impact and result.impact.strip().lower() in {"high", "medium", "low"}:
                consequence.impact = result.impact.strip().lower()
            if result.recommended_change:
                consequence.recommended_change = clamp_sentences(result.recommended_change, 2)
            if result.next_validation is not None:
                consequence.next_validation = clamp_sentences(result.next_validation, 2)
    except Exception as exc:
        logger.debug("LLM consequence synthesis bypassed for claim %s: %s", claim.id, exc)

    consequence.fatal_flaw = claim.fatal_flaw
    consequence.salvaged_claim = claim.salvaged_claim
    consequence.tradeoff_acknowledged = claim.tradeoff_acknowledged
    return consequence


async def synthesize_consequences(
    case: Case,
    provider: LLMProvider,
    reasonings: dict[str, str] | None = None,
) -> list[DecisionConsequence]:
    tasks = []
    for consequence in case.consequences:
        claim = next((c for c in case.claims if c.id == consequence.claim_id), None)
        if claim is None:
            continue
        claim_findings = [f for f in case.findings if f.claim_id == claim.id]
        tasks.append(
            _synthesize_single_consequence(consequence, claim, case, claim_findings, provider)
        )
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    return case.consequences


class NextActionOutput(BaseModel):
    action: str = Field(description="One concrete action, at most 2 sentences.")
    claim_ids: list[str] = Field(
        default_factory=list,
        description="Ids of the claims this action answers, copied verbatim from the list given.",
    )


class CaseVerdictOutput(BaseModel):
    decision_state: str = Field(
        description="One of: proceed, proceed_with_changes, hold, drop"
    )
    summary: str = Field(description="At most 3 sentences: where the decision stands and why.")
    next_actions: list[NextActionOutput] = Field(
        default_factory=list,
        description="2 to 3 merged actions covering everything that failed. No near-duplicates.",
    )


_DECISION_STATES = ("proceed", "proceed_with_changes", "hold", "drop")


def _fallback_decision_state(case: Case) -> str:
    """Used when the synthesis call fails — derived from the verdicts alone."""
    lb = [c for c in case.claims if c.load_bearing] or case.claims
    if any(c.status is ClaimStatus.BROKEN for c in lb):
        return "drop"
    if any(c.status is ClaimStatus.UNRESOLVED for c in lb):
        return "hold"
    if any(c.status is ClaimStatus.WEAKENED for c in lb):
        return "proceed_with_changes"
    return "proceed"


CASE_VERDICT_SYSTEM_PROMPT = (
    "You close out an adversarial review of one decision. Every claim it rests on has "
    "already been judged individually. Produce the case-level answer, not a restatement "
    "of the claims. The decision may be of any kind — never assume a domain.\n"
    "- 'decision_state': 'proceed' (nothing load-bearing failed), 'proceed_with_changes' "
    "(it survives with named modifications), 'hold' (a load-bearing claim is unproven and "
    "must be settled first), 'drop' (a load-bearing claim was refuted by a source).\n"
    "- 'summary': at most 3 sentences, and it is an adjudication, not a recap. "
    "Sentence 1 names the SINGLE specific thing that decided it — a number, a source, "
    "a rule, a cost, a contradiction — in the vocabulary of the decision itself. Not a "
    "count of claims, not a restatement of a claim. Sentence 2 says what the decision "
    "looks like if it survives at all, or what must be settled first. Never list claims, "
    "never enumerate, never write 'in summary', 'overall' or 'key takeaways'.\n"
    "- 'next_actions': 2 to 3 actions total, merged across claims. If several claims "
    "failed for the same underlying reason, that is ONE action. Each must be concrete "
    "enough to start this week. No near-duplicates. Set 'claim_ids' to the ids of the "
    "claims that action answers, copied verbatim from the claim list; leave it empty if "
    "the action answers none of them specifically."
)


async def synthesize_case_verdict(case: Case, provider: LLMProvider) -> CaseVerdict:
    """One call producing the case-level state and deduped actions (Stage 4)."""
    survived = [c.id for c in case.claims if c.status is ClaimStatus.SURVIVED]
    broken = [c.id for c in case.claims if c.status is ClaimStatus.BROKEN]
    unproven = [
        c.id
        for c in case.claims
        if c.status in (ClaimStatus.WEAKENED, ClaimStatus.UNRESOLVED)
    ]

    verdict = CaseVerdict(
        decision_state=_fallback_decision_state(case),
        summary="",
        survived=survived,
        broken=broken,
        unproven=unproven,
        next_actions=[],
    )

    claim_lines = "\n".join(
        f"- {c.id} [{c.status.value if c.status else 'untested'}]"
        f"{' (load-bearing)' if c.load_bearing else ''} {c.statement}"
        for c in case.claims
    )
    consequence_lines = "\n".join(
        f"- {cons.recommended_change}"
        + (f" | check: {cons.next_validation}" if cons.next_validation else "")
        for cons in case.consequences
    )

    try:
        result = await provider.generate(
            system_prompt=CASE_VERDICT_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Decision: {case.raw_input}\n\n"
                        f"Claim verdicts:\n{claim_lines}\n\n"
                        f"Per-claim changes already proposed:\n{consequence_lines or 'none'}"
                    ),
                }
            ],
            response_schema=CaseVerdictOutput,
        )
        state = (getattr(result, "decision_state", "") or "").strip().lower()
        if state in _DECISION_STATES:
            verdict.decision_state = state
        verdict.summary = clamp_sentences(getattr(result, "summary", "") or "")
        # Dedupe defensively — the merge is the entire point of this call.
        known_ids = {c.id for c in case.claims}
        seen: set[str] = set()
        for raw in getattr(result, "next_actions", []) or []:
            action = clamp_sentences(getattr(raw, "action", "") or "", 2)
            key = action.lower()
            if not action or key in seen:
                continue
            seen.add(key)
            # Models hallucinate ids; an unanchored action beats a dead link.
            anchors = [
                cid for cid in (getattr(raw, "claim_ids", []) or []) if cid in known_ids
            ]
            verdict.next_actions.append(NextAction(action=action, claim_ids=anchors))
        verdict.next_actions = verdict.next_actions[:3]
    except Exception as exc:
        logger.warning("Case verdict synthesis failed (%s); using derived state.", exc)

    if not verdict.summary:
        verdict.summary = (
            f"{len(survived)} claim(s) held, {len(broken)} refuted, {len(unproven)} unproven."
        )
    if not verdict.next_actions:
        verdict.next_actions = [
            NextAction(action=cons.next_validation, claim_ids=[cons.claim_id])
            for cons in case.consequences
            if cons.next_validation
        ][:3]
    return verdict


def _degraded_finding(item: TestPlanItem, exc: BaseException) -> Finding:
    """A failed evaluator becomes a visible zero-confidence finding, never silence.

    Not an `error` SSE event: routes.py terminates the stream on `error`, which
    would kill the whole run because one test failed.
    """
    evaluator_name = FAILURE_MODE_TO_AGENT.get(item.failure_mode, item.failure_mode)
    return Finding(
        claim_id=item.target_claim,
        test_id=item.id,
        evaluator=evaluator_name,
        result=f"Test did not complete ({type(exc).__name__}).",
        evidence=[],
        reasoning=f"This evaluator failed to return a finding: {exc}",
        confidence=0.0,
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

        # Steelman: parallel reconcile across claims, seeing all findings for each claim.
        # One claim failing degrades that claim; every claim failing means the
        # provider is down, and a run of nothing but UNRESOLVED is worse to serve
        # than an `error` the frontend can actually show.
        steelman_errors: list[BaseException] = []

        async def _reconcile_single(clm: Claim) -> tuple[Claim, ClaimStatus, str]:
            claim_findings = [f for f in case.findings if f.claim_id == clm.id]
            if not claim_findings:
                clm.status = ClaimStatus.UNRESOLVED
                clm.fatal_flaw = None
                clm.salvaged_claim = None
                clm.tradeoff_acknowledged = None
                return clm, ClaimStatus.UNRESOLVED, "No evaluator produced a finding for this claim."
            await emit_activity(
                case.id,
                "Steelman",
                f"Reconciling evidence for: {clm.statement[:55]}...",
                claim_id=clm.id,
                action="reconciling",
            )
            try:
                verdict = await reconcile(clm, claim_findings, provider)
            except Exception as exc:
                steelman_errors.append(exc)
                clm.status = ClaimStatus.UNRESOLVED
                clm.fatal_flaw = None
                clm.salvaged_claim = None
                clm.tradeoff_acknowledged = None
                return (
                    clm,
                    ClaimStatus.UNRESOLVED,
                    f"Reconciliation error ({exc}); marked unresolved.",
                )

            if isinstance(verdict, SteelManVerdict):
                gated = apply_steelman_gate(verdict, claim_findings)
                clm.status = gated.status
                clm.fatal_flaw = gated.fatal_flaw
                clm.salvaged_claim = gated.salvaged_claim
                clm.tradeoff_acknowledged = gated.tradeoff_acknowledged
                return clm, gated.status, gated.reasoning
            else:
                st, rsn = verdict
                gated_st, gated_rsn = apply_evidence_gate(st, rsn, claim_findings)
                clm.status = gated_st
                return clm, gated_st, gated_rsn

        reconcile_results = await asyncio.gather(
            *(_reconcile_single(clm) for clm in case.claims)
        )
        if case.claims and len(steelman_errors) == len(case.claims):
            raise steelman_errors[0]

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
                    "fatal_flaw": clm.fatal_flaw,
                    "salvaged_claim": clm.salvaged_claim,
                    "tradeoff_acknowledged": clm.tradeoff_acknowledged,
                },
            )

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

        try:
            await emit_activity(
                case.id,
                "Synthesis",
                "Formulating strategic adaptations and next validation steps...",
                action="consequences",
            )
            case.consequences = await synthesize_consequences(case, provider, reasonings=reasonings)
        except Exception as exc:
            logger.debug("Synthesizing consequences fallback: %s", exc)

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

        case.case_verdict = await synthesize_case_verdict(case, provider)
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
