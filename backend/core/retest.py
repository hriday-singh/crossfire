"""
Owner: Dev A. Interactive claim re-testing and counter-evidence appeal loop.
Allows users to re-test salvaged claims or submit targeted counter-evidence
post-adjudication, updating the claim's status and re-synthesizing the case verdict.
"""
from __future__ import annotations

from datetime import datetime, timezone
import logging
from uuid import uuid4

import events
import store
from core.activity import emit_activity
from core.agent_panel import build_test_plan
from core.cross_examination import run_cross_examination_probes
from core.evaluators import dispatch
from core.models import Case, Claim, ClaimStatus, EvidenceItem, Finding
from core.reconcile import SteelManVerdict, apply_evidence_gate, apply_steelman_gate, reconcile
from core.synthesis import synthesize_case_verdict, synthesize_consequences
from providers.base import LLMProvider

logger = logging.getLogger(__name__)


async def run_evaluators_for_items(case: Case, plan_items: list, provider: LLMProvider) -> list[Finding]:
    """Runs evaluators for a specific subset of test plan items."""
    findings: list[Finding] = []
    for item in plan_items:
        try:
            if dispatch is not None:
                finding = await dispatch.run_evaluator(item, case, provider)
                findings.append(finding)
        except Exception as exc:
            logger.warning("Retest evaluator failed for %s (%s): %s", item.id, item.failure_mode, exc)
    return findings


async def retest_single_claim(
    case_id: str,
    claim_id: str,
    action: str = "test_salvaged",
    counter_evidence: str | None = None,
    provider: LLMProvider | None = None,
) -> Case:
    case = store.get(case_id)
    if not case:
        raise ValueError(f"Case '{case_id}' not found.")

    clm = next((c for c in case.claims if c.id == claim_id), None)
    if not clm:
        raise ValueError(f"Claim '{claim_id}' not found in case '{case_id}'.")

    await emit_activity(
        case.id,
        "Retest",
        f"Retesting claim ({action}): {clm.statement[:50]}...",
        claim_id=clm.id,
        action="retest",
    )

    if action == "test_salvaged" and clm.salvaged_claim:
        # User adopted the salvaged claim: re-evaluate the improved premise
        clm.statement = clm.salvaged_claim
        clm.status = None
        clm.fatal_flaw = None
        clm.salvaged_claim = None
        clm.tradeoff_acknowledged = None
        # A stale scope on a re-tested claim carries the old salvage's verdict into
        # the ladder and can force a `drop` the new findings never justified.
        clm.salvage_scope = None
        clm.missing_input = None
        # Drop old findings for this claim
        case.findings = [f for f in case.findings if f.claim_id != clm.id]
    elif action == "counter_evidence" and counter_evidence:
        # Add user-supplied counter-evidence finding
        user_finding = Finding(
            claim_id=clm.id,
            test_id=f"user-{uuid4()}",
            evaluator="user_receipt",
            result="User submitted counter-evidence",
            evidence=[
                EvidenceItem(
                    source_url="user://counter-evidence",
                    title="User Provided Proof",
                    snippet=counter_evidence.strip(),
                    retrieved_at=datetime.now(timezone.utc).isoformat(),
                    stance="supports",
                    source_class="primary",
                    provider="user",
                )
            ],
            reasoning=f"User verified context: {counter_evidence.strip()}",
            confidence=0.1,  # low objection strength = strongly supports
            contradiction=None,
        )
        case.findings.append(user_finding)
        await events.publish(
            case.id,
            "finding_ready",
            {"finding": user_finding.model_dump(), "target_claim_id": clm.id},
        )

    # If test_salvaged, generate fresh evaluator findings for this revised claim
    if action == "test_salvaged" and provider:
        plan = build_test_plan(case, panel=True, active_agents=case.selected_agents)
        claim_plan = [item for item in plan if item.target_claim == clm.id]
        new_findings = await run_evaluators_for_items(case, claim_plan, provider)
        case.findings.extend(new_findings)
        for nf in new_findings:
            await events.publish(
                case.id,
                "finding_ready",
                {"finding": nf.model_dump(), "target_claim_id": clm.id},
            )

        # Also probe if needed
        try:
            probes = await run_cross_examination_probes(case, case.findings, provider)
            for p in probes:
                if p.claim_id == clm.id:
                    case.findings.append(p)
                    await events.publish(
                        case.id,
                        "finding_ready",
                        {"finding": p.model_dump(), "target_claim_id": clm.id},
                    )
        except Exception:
            pass

    # Reconcile this single claim
    claim_findings = [f for f in case.findings if f.claim_id == clm.id]
    if claim_findings and provider:
        verdict = await reconcile(clm, claim_findings, provider)
        if isinstance(verdict, SteelManVerdict):
            gated = apply_steelman_gate(verdict, claim_findings)
            clm.status = gated.status
            clm.fatal_flaw = gated.fatal_flaw
            clm.salvaged_claim = gated.salvaged_claim
            clm.tradeoff_acknowledged = gated.tradeoff_acknowledged
            clm.missing_input = gated.missing_input
            clm.salvage_scope = gated.salvage_scope
            reasoning = gated.reasoning
        else:
            st, rsn = verdict
            gated_st, gated_rsn = apply_evidence_gate(st, rsn, claim_findings)
            clm.status = gated_st
            reasoning = gated_rsn
    else:
        clm.status = clm.status or ClaimStatus.SURVIVED
        reasoning = "Retest completed."

    await events.publish(
        case.id,
        "verdict_ready",
        {
            "claim_id": clm.id,
            "status": clm.status.value if clm.status else "survived",
            "verdict_reasoning": reasoning,
            "fatal_flaw": clm.fatal_flaw,
            "salvaged_claim": clm.salvaged_claim,
            "tradeoff_acknowledged": clm.tradeoff_acknowledged,
            "missing_input": clm.missing_input,
            "salvage_scope": clm.salvage_scope,
        },
    )

    # Re-synthesize consequences & case verdict
    if provider:
        reasonings = {c.id: (c.load_bearing_reason or "") for c in case.claims}
        reasonings[clm.id] = reasoning
        case.consequences = await synthesize_consequences(case, provider, reasonings=reasonings)
        case.case_verdict = await synthesize_case_verdict(case, provider)
        await events.publish(
            case.id, "case_verdict", {"case_verdict": case.case_verdict.model_dump()}
        )

    store.set(case)
    return case
