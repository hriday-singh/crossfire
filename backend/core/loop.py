"""
Owner: Dev A. Hour-by-hour build order in docs/02-dev-A-core-loop-providers.md.
RESEARCH FIRST before implementing classify_load_bearing (docs/dev-a/research/01-load-bearing.md)
and reconcile (docs/dev-a/research/02-reconcile.md) — decide there first, then implement here.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import uuid4

from pydantic import BaseModel, Field

import events
import store
from core.models import Case, Claim, ClaimStatus, DecisionConsequence, Finding, TestPlanItem
from providers import get_provider
from providers.base import LLMProvider

logger = logging.getLogger(__name__)

try:
    from core.evaluators import dispatch  # Dev C
except ImportError:  # not landed yet — the pipeline runs without findings until it is
    dispatch = None


class ExtractedClaims(BaseModel):
    """Narrow extraction schema — not the frozen Case shape. Asking the model
    to fill Case's full fields directly risks hallucinated/unrequested fields;
    this stays small and gets mapped onto Case here."""

    statements: list[str]


FEASIBILITY_KEYWORDS: list[str] = [
    "scale", "performance", "cost", "build", "api", "latency", "compliance",
    "legal", "gdpr", "soc2", "replace", "system", "infrastructure",
    "architecture", "migration", "database", "backend", "deploy", "server",
    "code", "engineer", "throughput", "integration", "software", "tech",
    "platform", "load", "bandwidth", "memory", "cpu",
]

EDGE_RISK_KEYWORDS: list[str] = [
    "unique", "risk", "failure", "attack", "edge", "novel", "competitor",
    "alternative", "zero", "all", "100%", "never", "guarantee", "security",
    "exploit", "worst", "unprecedented", "bypass", "fraud", "hack",
    "loophole", "vulnerability", "catastrophic",
]

EVIDENCE_KEYWORDS: list[str] = [
    "pay", "$", "dollar", "price", "pricing", "cost", "revenue", "demand",
    "adopt", "trust", "will use", "churn", "conversion", "sales", "market",
    "users", "customers", "growth", "cac", "ltv", "retention",
]


def determine_auto_agents(claims: list[Claim]) -> tuple[list[str], dict[str, str]]:
    """Analyzes extracted claims and determines the recommended active agent panel
    with human-readable rationales."""
    combined_text = " ".join(c.statement.lower() for c in claims)
    selected: list[str] = ["devils_advocate"]
    rationales: dict[str, str] = {
        "devils_advocate": "Stress-tests implicit premises, unstated assumptions, and logical contradictions across all claims."
    }

    # Evidence test (Receipts)
    has_evidence = any(kw in combined_text for kw in EVIDENCE_KEYWORDS)
    selected.append("receipts")
    if has_evidence:
        rationales["receipts"] = "Searches empirical web evidence, market benchmarks, pricing, and adoption data."
    else:
        rationales["receipts"] = "Verifies factual assertions and external market reality via live search citations."

    # Feasibility test (Builder)
    has_feasibility = any(kw in combined_text for kw in FEASIBILITY_KEYWORDS)
    if has_feasibility or len(claims) >= 3:
        selected.append("builder")
        rationales["builder"] = "Evaluates engineering feasibility, API limits, performance bottlenecks, and operational constraints."

    # Edge-Case test (Overthinker)
    has_edge = any(kw in combined_text for kw in EDGE_RISK_KEYWORDS)
    if has_edge or len(claims) >= 4:
        selected.append("overthinker")
        rationales["overthinker"] = "Identifies catastrophic tail risks, boundary failures, and second-order vulnerabilities."

    return selected, rationales


async def extract_claims(
    raw_input: str,
    provider: LLMProvider,
    context: str | None = None,
    agent_mode: str = "auto",
    selected_agents: list[str] | None = None,
) -> Case:
    system_prompt = (
        "Extract the discrete, checkable claims or assumptions embedded in the "
        "user's input. Each statement must be a single factual or predictive "
        "assertion that could independently turn out true or false.\n"
        "Include both the direct assertions stated by the user AND any critical "
        "implicit or unstated assumptions required for the proposal to succeed "
        "(e.g., market demand, cost limits, user behavior, technical feasibility, "
        "security, or operational containment). "
        "Return 2 to 5 crisp, falsifiable claims."
    )
    user_content = raw_input
    if context:
        user_content = f"Proposal under evaluation:\n{raw_input}\n\nSupporting / Context Document:\n{context}"

    result = await provider.generate(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": user_content}],
        response_schema=ExtractedClaims,
    )
    claims = [Claim(id=str(uuid4()), statement=s) for s in result.statements]

    final_mode = (agent_mode or "auto").lower().strip()
    if final_mode == "custom" and selected_agents:
        valid_agents = [
            a for a in selected_agents
            if a in ("devils_advocate", "receipts", "builder", "overthinker")
        ]
        active_agents = valid_agents if valid_agents else ["devils_advocate", "receipts", "builder", "overthinker"]
        rationales = {}
    else:
        final_mode = "auto"
        active_agents, rationales = determine_auto_agents(claims)

    return Case(
        id=str(uuid4()),
        raw_input=raw_input,
        context=context,
        claims=claims,
        status="awaiting_confirmation",
        agent_mode=final_mode,
        selected_agents=active_agents,
        agent_rationales=rationales,
    )


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
    case_content = case.raw_input
    if case.context:
        case_content = f"Proposal: {case.raw_input}\nContext Document: {case.context}"

    messages = [
        {
            "role": "user",
            "content": f"Context: {case_content}\nClaim: {claim.statement}",
        }
    ]
    result = await provider.generate(
        system_prompt=system_prompt,
        messages=messages,
        response_schema=LoadBearingAnswer,
    )
    return result.answer


# Keyword buckets with weights. Routes claims by what they actually need tested
# using weighted scoring so specific empirical/evidence, behavioral, or constraint
# signals take precedence over generic assumption markers (e.g. 'assume', 'expect').
_FAILURE_MODE_WEIGHTS: list[tuple[str, list[tuple[str, float]]]] = [
    (
        "evidence",
        [
            ("pay", 2.5),
            ("$", 2.5),
            ("dollar", 2.5),
            ("price", 2.5),
            ("pricing", 2.5),
            ("cost", 2.5),
            ("revenue", 2.5),
            ("demand", 2.5),
            ("adopt", 2.5),
            ("trust", 2.5),
            ("will use", 2.0),
            ("churn", 2.5),
            ("conversion", 2.5),
            ("sales", 2.5),
            ("market", 2.0),
        ],
    ),
    (
        "behavior",
        [
            ("will scale", 2.5),
            ("scale", 2.0),
            ("performance", 2.0),
            ("latency", 2.0),
            ("load", 2.0),
            ("concurrent", 2.0),
            ("throughput", 2.0),
            ("qps", 2.0),
            ("uptime", 2.0),
        ],
    ),
    (
        "constraint",
        [
            ("compliance", 2.5),
            ("certif", 2.0),
            ("legal", 2.0),
            ("regulat", 2.0),
            ("hipaa", 2.5),
            ("gdpr", 2.5),
            ("soc2", 2.5),
            ("theme", 2.0),
            ("screen", 2.0),
        ],
    ),
    (
        "alternative",
        [
            ("only option", 2.5),
            ("no competitor", 2.5),
            ("unique", 2.0),
            ("first to market", 2.5),
            ("first", 1.5),
            ("unprecedented", 2.0),
            ("novel", 1.5),
        ],
    ),
    (
        "assumption",
        [
            ("assume", 1.0),
            ("premise", 1.0),
            ("expect", 1.0),
            ("suppose", 1.0),
            ("believe", 1.0),
            ("willing", 1.0),
            ("natural", 1.0),
            ("obvious", 1.0),
            ("users prefer", 1.5),
            ("people want", 1.5),
        ],
    ),
]


def build_test_plan(
    case: Case,
    panel: bool = True,
    active_agents: list[str] | None = None,
) -> list[TestPlanItem]:
    if active_agents is None:
        active_agents = getattr(case, "selected_agents", None) or [
            "devils_advocate", "receipts", "builder", "overthinker"
        ]

    items: list[TestPlanItem] = []
    for claim in case.claims:
        statement_lower = claim.statement.lower()
        mode_scores: dict[str, float] = {}

        for mode, weighted_keywords in _FAILURE_MODE_WEIGHTS:
            score = sum(
                weight
                for kw, weight in weighted_keywords
                if kw in statement_lower
            )
            if score > 0:
                mode_scores[mode] = score

        if mode_scores:
            # Pick highest score; tie-breaker preserves order in _FAILURE_MODE_WEIGHTS
            primary_failure_mode = max(
                mode_scores.keys(),
                key=lambda m: (
                    mode_scores[m],
                    -[fm[0] for fm in _FAILURE_MODE_WEIGHTS].index(m),
                ),
            )
        else:
            primary_failure_mode = "evidence"  # default: most claims need evidence testing

        if not panel:
            # Check if evaluator for primary_failure_mode is in active_agents
            mode_to_agent = {
                "assumption": "devils_advocate",
                "evidence": "receipts",
                "behavior": "builder",
                "constraint": "builder",
                "feasibility": "builder",
                "edge-case": "overthinker",
                "alternative": "overthinker",
            }
            assigned_agent = mode_to_agent.get(primary_failure_mode, "devils_advocate")
            if assigned_agent in active_agents:
                items.append(
                    TestPlanItem(
                        id=str(uuid4()),
                        target_claim=claim.id,
                        failure_mode=primary_failure_mode,
                        objective=f"Check whether evidence supports or contradicts: {claim.statement}",
                    )
                )
        else:
            # Full Adversarial Panel mode (filtered strictly by active_agents):
            # 1. Devil's Advocate (stress-tests implicit assumptions & premises)
            if "devils_advocate" in active_agents:
                items.append(
                    TestPlanItem(
                        id=str(uuid4()),
                        target_claim=claim.id,
                        failure_mode="assumption",
                        objective=f"Stress-test implicit premises and counter-incentives behind: {claim.statement}",
                    )
                )

            # 2. Receipts (searches external empirical evidence & benchmarks)
            if "receipts" in active_agents:
                items.append(
                    TestPlanItem(
                        id=str(uuid4()),
                        target_claim=claim.id,
                        failure_mode="evidence",
                        objective=f"Check empirical evidence, benchmarks, and real-world data for: {claim.statement}",
                    )
                )

            # 3. Builder: concrete feasibility, dependencies, latency, operational blockers
            if "builder" in active_agents:
                is_lb = claim.load_bearing is not False
                feasibility_keywords = [
                    "scale", "performance", "cost", "build", "api", "latency",
                    "compliance", "legal", "gdpr", "soc2", "replace", "system",
                    "infrastructure", "architecture", "migration", "database",
                    "backend", "deploy", "server", "code", "engineer", "throughput",
                    "integration", "software", "tech", "platform"
                ]
                has_feasibility = any(kw in statement_lower for kw in feasibility_keywords)
                if is_lb or has_feasibility:
                    items.append(
                        TestPlanItem(
                            id=str(uuid4()),
                            target_claim=claim.id,
                            failure_mode="feasibility",
                            objective=f"Assess concrete operational/technical feasibility and implementation blockers for: {claim.statement}",
                        )
                    )

            # 4. Overthinker: tail risks, boundary failures, edge vulnerabilities
            if "overthinker" in active_agents:
                is_lb = claim.load_bearing is not False
                edge_keywords = [
                    "unique", "risk", "failure", "attack", "edge", "novel",
                    "competitor", "alternative", "zero", "all", "100%", "never",
                    "guarantee", "security", "exploit", "worst", "unprecedented",
                    "loophole", "vulnerability"
                ]
                has_edge = any(kw in statement_lower for kw in edge_keywords)
                if is_lb or has_edge:
                    items.append(
                        TestPlanItem(
                            id=str(uuid4()),
                            target_claim=claim.id,
                            failure_mode="edge-case",
                            objective=f"Identify catastrophic tail risks, boundary failures, and degenerate loops for: {claim.statement}",
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
        "You are the senior judicial reconciler in the Crossfire adversarial decision engine. "
        "You reconcile findings from multiple adversarial evaluators (Devil's Advocate, Receipts evidence, "
        "Builder feasibility, and Overthinker edge-cases) into a single rigorous verdict for a claim. "
        "Never vote — judge evidence quality and analytical rigor directly. A finding with verified empirical "
        "citations carries high weight. Logical contradictions or unaddressed tail risks weaken or break "
        "a claim even if optimistic evidence exists. If findings assert opposite conclusions with comparable "
        "evidence, or evidence overall is thin/absent, the status must be 'unresolved' — never a forced winner. "
        "Otherwise pick 'survived' (claim holds with high confidence), 'weakened' (holds with significant caveats or friction), "
        "or 'broken' (claim is refuted or foundationally flawed). "
        "In your reasoning, synthesize across the evaluators, citing specific evidence numbers, benchmarks, "
        "or logical contradictions."
    )
    findings_summary = "\n".join(
        f"- evaluator={f.evaluator}, result={f.result!r}, evidence_count={len(f.evidence)}, "
        f"confidence={f.confidence}, reasoning={f.reasoning!r}, contradiction={f.contradiction!r}"
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


class StrategicConsequenceOutput(BaseModel):
    impact: str = Field(description="Impact level: 'high', 'medium', or 'low'")
    recommended_change: str = Field(
        description="A commercially or technically actionable, concrete strategic pivot or mitigation tailored to what failed or weakened. Never generic."
    )
    next_validation: str | None = Field(
        default=None,
        description="The smallest, lowest-cost next real-world validation experiment (e.g. a 30-day shadow test, a canary deploy) to de-risk this assumption. Null if survived.",
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
            f"- [{f.evaluator.upper()}]: result={f.result} | reasoning={f.reasoning} | contradiction={f.contradiction}"
            for f in findings
        )
        system_prompt = (
            "You are a strategic executive advisor in the Crossfire decision validation engine. "
            "A foundational claim within a proposal has been stress-tested and found to be broken, weakened, "
            "or unresolved. Your task is to formulate:\n"
            "1. 'impact': 'high' if load-bearing and broken/unresolved, 'medium' if weakened, 'low' otherwise.\n"
            "2. 'recommended_change': An actionable, concrete strategic pivot or mitigation tailored to what failed. "
            "Do NOT speak in generic platitudes like 'Drop or rework the assumption'. Propose a realistic, specific pivot "
            "(e.g., 'Adopt a hybrid AI-first containment model with automated sentiment escalation', 'Deploy a shadow test pipeline before replacing legacy servers').\n"
            "3. 'next_validation': The smallest, cheapest real-world experiment to test this risk before committing capital "
            "(e.g., 'Run a 30-day shadow containment test on tier-1 refund requests', 'Deploy a canary test on 5% of traffic measuring latency and memory')."
        )
        user_content = (
            f"Overall Proposal: {case.raw_input}\n"
            f"Claim Statement: {claim.statement}\n"
            f"Verdict: {claim.status.value if claim.status else 'untested'} (Load-bearing: {claim.load_bearing})\n"
            f"Evaluator Findings:\n{findings_ctx or 'No detailed findings.'}"
        )
        result = await provider.generate(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_content}],
            response_schema=StrategicConsequenceOutput,
        )
        if result and isinstance(result, StrategicConsequenceOutput):
            if result.impact:
                consequence.impact = result.impact.lower()
            if result.recommended_change:
                consequence.recommended_change = result.recommended_change
            if result.next_validation is not None:
                consequence.next_validation = result.next_validation
    except Exception as exc:
        logger.debug(f"LLM consequence synthesis bypassed for claim {claim.id}: {exc}")
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

        case.test_plan = build_test_plan(case, panel=True, active_agents=case.selected_agents)
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
            if consequence.claim_id in reasonings:
                consequence.verdict_reasoning = reasonings[consequence.claim_id]

        # Synthesize bespoke LLM pivots and smallest experiments if provider is available
        if provider is not None:
            try:
                case.consequences = await synthesize_consequences(case, provider, reasonings=reasonings)
            except Exception as exc:
                logger.debug(f"Synthesizing consequences fallback: {exc}")

        for consequence in case.consequences:
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
