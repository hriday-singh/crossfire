"""
Owner: Dev A. Judge reconciliation layer for synthesizing evaluator findings into claim verdicts.
"""
from __future__ import annotations

import logging
from pydantic import BaseModel

from core.models import Claim, ClaimStatus, Finding
from core.textutil import clamp_sentences
from providers.base import LLMProvider

logger = logging.getLogger(__name__)


class ReconcileVerdict(BaseModel):
    status: ClaimStatus
    reasoning: str


RECONCILE_SYSTEM_PROMPT = (
    "You are the judge in an adversarial decision review. Several evaluators tested one "
    "claim independently; reconcile their findings into a single verdict. The decision "
    "may be of any kind — never assume a domain.\n\n"
    "Do not count votes. Judge the quality of what each finding rests on. A finding "
    "carrying a real source outweighs one that only reasons. Absence of evidence is not "
    "refutation: a finding that merely failed to find support cannot break a claim, it "
    "can only leave it unproven.\n\n"
    "Pick: 'survived' (holds, and something backs it), 'weakened' (holds with real "
    "friction or caveats), 'broken' (a source or a hard contradiction refutes it), "
    "'unresolved' (findings conflict at comparable strength, or nothing substantive was "
    "found either way).\n\n"
    "Reasoning: at most 3 sentences, naming the specific number, source, rule or "
    "contradiction that decided it. No generic advice."
)


async def reconcile(
    claim: Claim, findings: list[Finding], provider: LLMProvider
) -> tuple[ClaimStatus, str]:
    findings_summary = "\n".join(
        f"- evaluator={f.evaluator}, result={f.result!r}, evidence_count={len(f.evidence)}, "
        f"sources={[e.source_url for e in f.evidence] or 'none'}, "
        f"confidence={f.confidence}, reasoning={f.reasoning!r}, contradiction={f.contradiction!r}"
        for f in findings
    )
    result = await provider.generate(
        system_prompt=RECONCILE_SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"Claim: {claim.statement}\nFindings:\n{findings_summary}"}
        ],
        response_schema=ReconcileVerdict,
    )
    return result.status, clamp_sentences(result.reasoning)


def has_sourced_contradiction(findings: list[Finding]) -> bool:
    """A claim only breaks on a contradiction traceable to an actual source."""
    return any(f.evidence and (f.contradiction or "").strip() for f in findings)


def apply_evidence_gate(
    status: ClaimStatus, reasoning: str, findings: list[Finding]
) -> tuple[ClaimStatus, str]:
    """Stage 1a. `broken` requires one finding carrying both evidence and a
    contradiction. Reasoning-only evaluators can weaken; they cannot break."""
    if status is ClaimStatus.BROKEN and not has_sourced_contradiction(findings):
        note = (
            "Downgraded from broken to weakened: no finding carried a contradiction "
            "traceable to a source, and absence of evidence is not refutation."
        )
        return ClaimStatus.WEAKENED, f"{reasoning} {note}".strip()
    return status, reasoning


def rank_findings(findings: list[Finding]) -> list[Finding]:
    """Lead with the finding that actually moved the verdict, not whichever
    evaluator returned first (Stage 3)."""
    return sorted(
        findings,
        key=lambda f: (
            bool(f.evidence and (f.contradiction or "").strip()),
            bool((f.contradiction or "").strip()),
            len(f.evidence),
            f.confidence,
        ),
        reverse=True,
    )
