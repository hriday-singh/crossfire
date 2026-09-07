"""
Owner: Dev A. Targeted cross-examination probe for verifying isolated evaluator blockers.
Acts as Phase 1.5 in the pipeline: connects theoretical architectural/premise flaws
surfaced by Builder or Devil's Advocate to empirical web verification before Steel Man adjudication.
"""
from __future__ import annotations

import asyncio
import logging
import re
from uuid import uuid4

from pydantic import BaseModel, Field

from core.activity import emit_activity
from core.models import Case, Claim, EvidenceItem, Finding
from core.textutil import OBJECTION_SCALE, clamp_sentences, one_line
from evidence.curate import curate_snippet
from evidence.search import build_authority_query, build_query, search_evidence
from providers.base import LLMProvider

logger = logging.getLogger(__name__)


class ProbeVerdict(BaseModel):
    """What the retrieved sources actually say about the blocker — not what the
    evaluator that raised it hoped they would say."""

    stance: str = Field(
        description="'contradicts' if a source states something the claim cannot survive, "
        "'supports' if the sources show the claim holds, 'context' if they are merely related."
    )
    contradiction: str | None = Field(
        default=None,
        description="One sentence, drawn from the source text, stating what the source says "
        "that the claim cannot survive. Null unless stance is 'contradicts'.",
    )
    confidence: float = Field(
        description="Objection strength of what the sources say, on the shared scale."
    )
    reasoning: str = Field(
        description="At most 2 sentences naming the source and the specific."
    )


PROBE_SYSTEM_PROMPT = (
    "An evaluator on an adversarial panel raised a theoretical blocker against a claim. "
    "You have retrieved sources. Decide what those sources actually establish. The decision "
    "may be of any kind — never assume a domain.\n\n"
    "The blocker is a hypothesis, not a finding. Your job is to check it, not to confirm it.\n"
    "- 'contradicts': a source states something the claim cannot survive. Quote the substance "
    "from the source, in the source's own terms — never restate the evaluator's blocker text.\n"
    "- 'supports': the sources show the claim holds on this dimension.\n"
    "- 'context': the sources are about the right subject but settle nothing. This is the "
    "honest answer most of the time. Use it.\n"
    "Set 'contradiction' only when stance is 'contradicts'. If the sources do not name the "
    "specific limit, number, rule or cost the blocker asserts, the stance is 'context'.\n\n"
    f"{OBJECTION_SCALE}"
)


# A blocker naming a statute, regulator or ordinance is the one kind whose source
# is reliably retrievable, and it is the kind the panel gets right and the pipeline
# then loses: in b1-phi-google-drive and b2-14-hour-shifts (2026-09-07 corpus) the
# panel named 45 CFR 164.312 and 49 CFR 395.3 correctly, no finding carried both
# evidence and a contradiction, and `apply_evidence_gate` demoted a statutory wall
# to `weakened`. Probing these first is what converts the panel's citation into the
# sourced contradiction the gate requires.
_STATUTORY_BLOCKER = re.compile(
    r"(\b\d+\s*(?:CFR|C\.F\.R\.|U\.?S\.?C\.?)\b|§|\bsection\s+\d|"
    r"\b(?:statut\w+|regulat\w+|ordinance|licen[cs]\w+|unlicensed|unregistered|"
    r"illegal|unlawful|prohibited|non-compliant|noncompliance|felony|misdemeanor)\b|"
    r"\b(?:HIPAA|FMCSA|FMCSR|GDPR|CCPA|OSHA|SEC|FDA|FINRA|FinCEN|DOT|EEOC|FTC|"
    r"PCI[- ]DSS|SOX|COPPA|Howey)\b|\bmunicipal code\b|\bfederal law\b)",
    re.IGNORECASE,
)

# Per-persona objection strength at which a theoretical blocker is worth a search.
# Operator was absent from this map entirely, which is why regulatory blockers —
# the ones it raises under friction_type='regulatory_liability' — were never probed.
_PROBE_FLOOR = {"builder": 0.6, "operator": 0.6, "devils_advocate": 0.7}


def is_statutory_blocker(text: str | None) -> bool:
    """Whether a blocker asserts a rule an authority actually publishes."""
    return bool(_STATUTORY_BLOCKER.search(text or ""))


def extract_critical_blocker(findings: list[Finding]) -> str | None:
    """The one unverified blocker on this claim most worth spending a search on.

    Statutory blockers outrank everything else regardless of persona; within each
    group the hardest objection wins. Only reasoning-only findings qualify — a
    finding that already carries its own sources needs no cross-examination."""
    eligible = [
        f
        for f in findings
        if (f.contradiction or "").strip()
        and not f.evidence
        and f.confidence is not None
        and f.confidence >= _PROBE_FLOOR.get(f.evaluator, 1.1)
    ]
    if not eligible:
        return None
    eligible.sort(key=lambda f: (not is_statutory_blocker(f.contradiction), -(f.confidence if f.confidence is not None else 0.0)))
    return eligible[0].contradiction.strip()


async def probe_blocker(
    claim: Claim,
    blocker_text: str,
    case: Case,
    provider: LLMProvider,
) -> Finding | None:
    """Executes a focused empirical search probe targeting a specific theoretical blocker."""
    case_id = getattr(case, "id", None)
    # A statutory blocker is answered by the body that publishes the rule, not by
    # the ordinary web results `build_query` returns — in b1 those were Google Drive
    # setup guides, which is how a HIPAA violation reached the gate unsourced.
    build = build_authority_query if is_statutory_blocker(blocker_text) else build_query
    probe_query = build(f"{claim.statement} {blocker_text}")

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
                        stance="context",
                    )
                )

        if not curated_items:
            return None

        # Adjudicate against the sources. Stamping stance="contradicts" and
        # contradiction=blocker_text without reading them manufactured the exact
        # (evidence + contradiction) pair `has_sourced_contradiction` gates `broken`
        # on, so the gate could never fire and the evaluator's own theory came back
        # as its own proof. It also echoed the blocker verbatim into a fourth
        # finding, which is most of why the distinct-objection ratio sat at 35.6%
        # across the 2026-09-07 calibration corpus.
        sources_block = "\n".join(
            f"- {ev.title or ev.source_url} ({ev.source_class}): {ev.snippet}"
            for ev in curated_items
        )
        verdict = await provider.generate(
            system_prompt=PROBE_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Claim: {claim.statement}\n\n"
                        f"Blocker raised by the panel: {blocker_text}\n\n"
                        f"Retrieved sources:\n{sources_block}"
                    ),
                }
            ],
            response_schema=ProbeVerdict,
        )
        if not isinstance(verdict, ProbeVerdict):
            return None

        stance = (verdict.stance or "").strip().lower()
        if stance not in ("contradicts", "supports", "context"):
            stance = "context"
        contradiction = (verdict.contradiction or "").strip() or None
        confidence = min(max(float(verdict.confidence), 0.0), 1.0)

        if stance != "contradicts":
            # Nothing was verified. Cap it in the no-evidence band so an unverified
            # probe cannot outrank a finding that actually damages the claim.
            contradiction = None
            confidence = min(confidence, 0.35)
        elif not contradiction:
            # Claiming a contradiction without naming one is the same failure in a
            # smaller shape.
            stance = "context"
            confidence = min(confidence, 0.35)

        for ev in curated_items:
            ev.stance = stance

        result = (
            f"Cross-examination confirmed: {contradiction}"
            if contradiction
            else f"Cross-examination did not confirm blocker: {blocker_text}"
        )
        return Finding(
            claim_id=claim.id,
            test_id=str(uuid4()),
            evaluator="researcher",
            result=one_line(result),
            evidence=curated_items,
            reasoning=clamp_sentences(verdict.reasoning or curated_items[0].snippet, 2),
            confidence=confidence,
            contradiction=contradiction,
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
