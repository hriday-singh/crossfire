"""
Owner: Dev A. Steel Man reconciliation layer for synthesizing adversarial evaluator
findings into evidence-backed claim verdicts and minimal viable re-architectures.
"""
from __future__ import annotations

import logging
from pydantic import BaseModel, Field

from core.models import Claim, ClaimStatus, Finding
from core.textutil import clamp_sentences
from providers.base import LLMProvider

logger = logging.getLogger(__name__)

STEEL_MAN_PERSONA = "steel_man"


class SteelManVerdict(BaseModel):
    """Output schema for the Steel Man persona: Adjudication + Mitigation."""

    status: ClaimStatus = Field(
        description="Adjudicated verdict status: 'survived', 'weakened', 'broken', or 'unresolved'"
    )
    reasoning: str = Field(
        description="At most 3 sentences naming the specific evidence, number, rule, or contradiction that decided it. No generic advice."
    )
    fatal_flaw: str | None = Field(
        default=None,
        description="The isolated fatal flaw if weakened or broken; null if survived or unresolved.",
    )
    salvaged_claim: str | None = Field(
        default=None,
        description="Minimal viable fix (scope reduction, dependency swap, or constraint adjustment) making the claim viable; null if survived, unresolved, or violates immutable laws.",
    )
    tradeoff_acknowledged: str | None = Field(
        default=None,
        description="The operational trade-off of the salvaged claim; null if not salvaged.",
    )

    def __iter__(self):
        # Backward compatibility: allows unpacking `st, rsn = verdict`
        return iter((self.status, self.reasoning))

    def __len__(self) -> int:
        return 2

    def __getitem__(self, index: int):
        return (self.status, self.reasoning)[index]


# Backward compatibility alias
ReconcileVerdict = SteelManVerdict


STEEL_MAN_SYSTEM_PROMPT = (
    "You are the Steel Man in Crossfire. You serve as both the Supreme Adjudicator "
    "and the Principal Solutions Architect.\n\n"
    "Mission: Synthesize all adversarial findings (from Builder, Receipts, Operator, "
    "Devil's Advocate) into a definitive, evidence-backed verdict, and instantly provide "
    "the minimal viable re-architecture for any claim that fails to survive perfectly.\n\n"
    "Core Operational Axioms (The DNA):\n"
    "1. Strict Anti-Voting (Judge DNA): Never average confidence scores or count votes. "
    "A single piece of empirical evidence from Receipts outweighs three speculative opinions "
    "from the other evaluators.\n"
    "2. Evidence Gating (Judge DNA): Absence of evidence is not refutation. If the panel "
    "attacks a claim but provides no grounded citations, you cannot declare the claim broken; "
    "it must be downgraded to weakened or unresolved programmatically.\n"
    "3. Mandatory Mitigation (Steelman DNA): If a claim is marked weakened or broken, you are "
    "strictly forbidden from simply rejecting it. You must isolate the fatal flaw and provide "
    "the exact parameter, scope constraint, or dependency swap that makes the claim viable, "
    "along with the operational trade-off of that fix.\n\n"
    "You will receive a Target Claim and the findings from an adversarial panel.\n\n"
    "PHASE 1: ADJUDICATION\n"
    "Evaluate the evidence. Do not count votes. A single grounded fact from Receipts overrides "
    "theoretical objections.\n"
    "Assign a status:\n"
    "- 'survived': The claim withstands all scrutiny.\n"
    "- 'weakened': Flaws exist, or evidence is lacking, but the core premise remains partially viable.\n"
    "- 'broken': Empirical evidence or physical/technical laws directly refute the claim.\n"
    "- 'unresolved': Conflicting or missing data prevents a ruling.\n\n"
    "Reasoning: At most 3 sentences, naming the specific number, source, rule, or "
    "contradiction that decided it. No generic advice.\n\n"
    "PHASE 2: MITIGATION\n"
    "If the claim is 'survived' or 'unresolved', you are done (leave salvage fields null).\n"
    "If the claim is 'weakened' or 'broken', you must execute a 'Break to Rebuild' protocol:\n"
    "1. Identify the fatal flaw.\n"
    "2. Formulate the minimal viable fix (a scope reduction, a dependency swap, or a constraint adjustment).\n"
    "3. Output the salvaged_claim and explicitly state the tradeoff_acknowledged.\n"
    "Exception: If the claim violates immutable laws of physics, math, or federal law, leave the salvage fields null."
)

# Backward compatibility alias
RECONCILE_SYSTEM_PROMPT = STEEL_MAN_SYSTEM_PROMPT


async def reconcile(
    claim: Claim, findings: list[Finding], provider: LLMProvider
) -> SteelManVerdict:
    findings_summary = "\n".join(
        f"- evaluator={f.evaluator}, result={f.result!r}, evidence_count={len(f.evidence)}, "
        f"sources={[e.source_url for e in f.evidence] or 'none'}, "
        f"confidence={f.confidence}, reasoning={f.reasoning!r}, contradiction={f.contradiction!r}"
        for f in findings
    )
    result = await provider.generate(
        system_prompt=STEEL_MAN_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Target Claim: {claim.statement}\n\nAdversarial Panel Findings:\n{findings_summary}",
            }
        ],
        response_schema=SteelManVerdict,
    )

    if isinstance(result, SteelManVerdict):
        status = result.status
        reasoning = clamp_sentences(result.reasoning)
        fatal_flaw = result.fatal_flaw
        salvaged_claim = result.salvaged_claim
        tradeoff_acknowledged = result.tradeoff_acknowledged
    else:
        # Fallback if raw text returned
        status = ClaimStatus.UNRESOLVED
        reasoning = clamp_sentences(str(result)) if result else "Reconciliation incomplete."
        fatal_flaw = None
        salvaged_claim = None
        tradeoff_acknowledged = None

    # Programmatic Phase 2 Enforcement:
    # If the claim is SURVIVED or UNRESOLVED, leave salvage fields null.
    if status in (ClaimStatus.SURVIVED, ClaimStatus.UNRESOLVED):
        fatal_flaw = None
        salvaged_claim = None
        tradeoff_acknowledged = None
    else:
        if fatal_flaw:
            fatal_flaw = clamp_sentences(fatal_flaw, 2)
        if salvaged_claim:
            salvaged_claim = clamp_sentences(salvaged_claim, 2)
        if tradeoff_acknowledged:
            tradeoff_acknowledged = clamp_sentences(tradeoff_acknowledged, 2)

    return SteelManVerdict(
        status=status,
        reasoning=reasoning,
        fatal_flaw=fatal_flaw,
        salvaged_claim=salvaged_claim,
        tradeoff_acknowledged=tradeoff_acknowledged,
    )


def has_sourced_contradiction(findings: list[Finding]) -> bool:
    """A claim only breaks on a contradiction traceable to an actual source."""
    return any(f.evidence and (f.contradiction or "").strip() for f in findings)


def apply_evidence_gate(
    status: ClaimStatus, reasoning: str, findings: list[Finding]
) -> tuple[ClaimStatus, str]:
    """Stage 1a / Evidence Gating DNA.
    Absence of evidence is not refutation. `broken` requires one finding carrying both
    evidence and a contradiction. Reasoning-only evaluators can weaken; they cannot break."""
    if status is ClaimStatus.BROKEN and not has_sourced_contradiction(findings):
        note = (
            "Downgraded from broken to weakened: no finding carried a contradiction "
            "traceable to a source, and absence of evidence is not refutation."
        )
        return ClaimStatus.WEAKENED, f"{reasoning} {note}".strip()
    return status, reasoning


def apply_steelman_gate(
    verdict: SteelManVerdict, findings: list[Finding]
) -> SteelManVerdict:
    """Applies Evidence Gating and maintains Phase 2 mitigation invariants on a SteelManVerdict."""
    gated_status, gated_reasoning = apply_evidence_gate(verdict.status, verdict.reasoning, findings)
    fatal_flaw = verdict.fatal_flaw
    salvaged_claim = verdict.salvaged_claim
    tradeoff_acknowledged = verdict.tradeoff_acknowledged

    # If downgraded or naturally survived/unresolved, enforce null salvage fields
    if gated_status in (ClaimStatus.SURVIVED, ClaimStatus.UNRESOLVED):
        fatal_flaw = None
        salvaged_claim = None
        tradeoff_acknowledged = None

    return SteelManVerdict(
        status=gated_status,
        reasoning=gated_reasoning,
        fatal_flaw=fatal_flaw,
        salvaged_claim=salvaged_claim,
        tradeoff_acknowledged=tradeoff_acknowledged,
    )


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

