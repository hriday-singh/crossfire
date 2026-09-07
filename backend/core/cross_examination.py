"""
Owner: Dev A. Targeted cross-examination probe for verifying isolated evaluator blockers.
Acts as Phase 1.5 in the pipeline: connects theoretical architectural/premise flaws
surfaced by Builder or Devil's Advocate to empirical web verification before Steel Man adjudication.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import uuid4

from core.activity import emit_activity
from core.models import Case, Claim, EvidenceItem, Finding
from core.textutil import clamp_sentences, one_line
from evidence.curate import curate_snippet
from evidence.search import build_query, search_evidence
from providers.base import LLMProvider

logger = logging.getLogger(__name__)


def extract_critical_blocker(findings: list[Finding]) -> str | None:
    """Scans findings for high-impact blockers or unstated premises that lack empirical evidence.

    Prioritizes:
    1. Builder's explicit contradiction or blocker with confidence >= 0.6
    2. Devil's Advocate's logical contradiction with confidence >= 0.7
    """
    for f in findings:
        if f.evaluator == "builder" and (f.contradiction or "").strip() and f.confidence >= 0.6:
            return f.contradiction.strip()
    for f in findings:
        if f.evaluator == "devils_advocate" and (f.contradiction or "").strip() and f.confidence >= 0.7:
            return f.contradiction.strip()
    return None


async def probe_blocker(
    claim: Claim,
    blocker_text: str,
    case: Case,
    provider: LLMProvider,
) -> Finding | None:
    """Executes a focused empirical search probe targeting a specific theoretical blocker."""
    case_id = getattr(case, "id", None)
    probe_query = build_query(f"{claim.statement} {blocker_text}")

    if case_id:
        try:
            await emit_activity(
                case_id,
                tag="Cross-Examination",
                text=f'Cross-Examining blocker: "{one_line(blocker_text, 60)}"',
                claim_id=claim.id,
                action="probe",
            )
        except Exception:
            pass

    try:
        try:
            raw_items = await search_evidence(claim, query_override=probe_query)
        except TypeError:
            raw_items = await search_evidence(claim)
        if not raw_items:
            return None

        curated_items: list[EvidenceItem] = []
        for ev in raw_items[:2]:
            curated = curate_snippet(ev.snippet, blocker_text)
            if curated:
                curated_items.append(
                    EvidenceItem(
                        source_url=ev.source_url,
                        title=ev.title,
                        snippet=curated,
                        retrieved_at=ev.retrieved_at,
                        source_class=getattr(ev, "source_class", "web"),
                        stance="contradicts",
                    )
                )

        if not curated_items:
            return None

        # Formulate the cross-examination finding (labeled as researcher so it binds to Steel Man evidence gate)
        return Finding(
            claim_id=claim.id,
            test_id=str(uuid4()),
            evaluator="researcher",
            result=one_line(f"Cross-examination verified blocker: {blocker_text}"),
            evidence=curated_items,
            reasoning=clamp_sentences(
                f"Empirical cross-examination of evaluator blocker ({blocker_text}): "
                f"{curated_items[0].snippet}"
            ),
            confidence=0.85,
            contradiction=blocker_text,
        )
    except Exception as exc:
        logger.warning(f"Cross-examination probe failed for claim {claim.id}: {exc}")
        return None


async def run_cross_examination_probes(
    case: Case,
    findings: list[Finding],
    provider: LLMProvider,
) -> list[Finding]:
    """Runs targeted empirical probes for load-bearing claims with unverified blockers."""
    probed_findings: list[Finding] = []

    for claim in case.claims:
        if not claim.load_bearing:
            continue

        claim_findings = [f for f in findings if f.claim_id == claim.id]
        # If researcher already has strong empirical evidence with a contradiction, no probe needed
        has_evidence_contradiction = any(
            f.evaluator == "researcher" and f.evidence and (f.contradiction or "").strip()
            for f in claim_findings
        )
        if has_evidence_contradiction:
            continue

        blocker = extract_critical_blocker(claim_findings)
        if not blocker:
            continue

        probe_finding = await probe_blocker(claim, blocker, case, provider)
        if probe_finding:
            probed_findings.append(probe_finding)

    return probed_findings
