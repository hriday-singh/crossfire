"""
Owner: Dev A. Steel Man reconciliation layer for synthesizing adversarial evaluator
findings into evidence-backed claim verdicts and minimal viable re-architectures.
"""
from __future__ import annotations

import logging
import re

from pydantic import BaseModel, Field

from core.models import Claim, ClaimStatus, Finding, WeakenedKind
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
    missing_input: str | None = Field(
        default=None,
        description="Required when status is 'unresolved': the exact number, document, or measurement that would settle the claim. Null for every other status.",
    )
    salvage_scope: str | None = Field(
        default=None,
        description="Required when a salvaged_claim exists: 'parameter' (the same decision with a different setting, threshold, scope or budget) or 'redesign' (the original decision is replaced by a different one). Null if there is no salvage.",
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
    "Mission: Synthesize all adversarial findings (from Builder, Researcher, Operator, "
    "Devil's Advocate) into a definitive, evidence-backed verdict, and instantly provide "
    "the minimal viable re-architecture for any claim that fails to survive perfectly.\n\n"
    "Core Operational Axioms (The DNA):\n"
    "1. Strict Anti-Voting (Judge DNA): Never average confidence scores or count votes. "
    "A single piece of empirical evidence from Researcher outweighs three speculative opinions "
    "from the other evaluators.\n"
    "2. Evidence Gating (Judge DNA): Absence of evidence is not refutation. If the panel "
    "attacks a claim but provides no grounded citations, you cannot declare the claim broken; "
    "it must be downgraded to weakened or unresolved programmatically.\n"
    "3. Mandatory Mitigation (Steelman DNA): If a claim is marked weakened or broken, you are "
    "strictly forbidden from simply rejecting it. You must isolate the fatal flaw and provide "
    "the exact parameter, scope constraint, or dependency swap that makes the claim viable, "
    "along with the operational trade-off of that fix. A salvage is not a verdict that the "
    "decision survives: a refuted claim whose only salvage is a different decision is still "
    "refuted, and you say so by labelling the salvage 'redesign'.\n\n"
    "You will receive a Target Claim and the findings from an adversarial panel.\n\n"
    "PHASE 1: ADJUDICATION\n"
    "Evaluate the evidence. Do not count votes. A single grounded fact from Researcher overrides "
    "theoretical objections.\n"
    "Each finding carries an 'objection' band: abstained (neutral) | no objection | minor | substantive | "
    "severe | fatal. Findings marked 'abstained (neutral)' are neutral non-objections outside the evaluator's "
    "domain or lacking empirical sources; ignore them entirely. A panel that returns only 'abstained (neutral)', "
    "'no objection', or 'minor' across the board is telling you the claim is sound — record that as 'survived'. "
    "Do not manufacture a downgrade to look rigorous; a review that never lets anything through is not a "
    "review.\n\n"
    "Assign a status:\n"
    "- 'survived': The claim withstands all scrutiny.\n"
    "- 'weakened': Flaws exist, or evidence is lacking, but the core premise remains partially viable.\n"
    "- 'broken': Empirical evidence or physical/technical laws directly refute the claim.\n"
    "- 'unresolved': Conflicting or missing data prevents a ruling.\n\n"
    "CHOOSING BETWEEN 'weakened' AND 'unresolved'. These are not degrees of the same "
    "thing and 'weakened' is not the safe middle. Apply this test before you pick:\n"
    "- 'weakened' means the claim was damaged by something the panel can NAME. Write "
    "the fact, rule, number, cost or source that damaged it. If you cannot write one, "
    "the status is not 'weakened'.\n"
    "- 'unresolved' means one specific, obtainable input decides the claim and the user "
    "did not supply it. You must be able to name that input — the exact number, "
    "document, measurement or record — in the 'missing_input' field. If you cannot "
    "name one, the status is not 'unresolved'.\n"
    "A claim is NOT unresolved merely because it looks forward, or because it is about "
    "how a market, customer base or person will behave. Public benchmarks, filings, "
    "published rates and comparable cases settle many such claims, and checking them is "
    "the Researcher's entire job. If the panel produced evidence bearing on it, rule on "
    "the evidence.\n"
    "Never use 'weakened' to mean 'we cannot tell', and never use 'unresolved' to avoid "
    "ruling on evidence you were given. Saying plainly that the decision turns on one "
    "number nobody has, and naming that number, is the most useful answer there is.\n\n"
    "Reasoning: At most 3 sentences, naming the specific number, source, rule, or "
    "contradiction that decided it. No generic advice.\n\n"
    "PHASE 2: MITIGATION\n"
    "If the claim is 'survived' or 'unresolved', you are done (leave salvage fields null). "
    "For 'unresolved', set 'missing_input' to the one input that would settle it.\n"
    "If the claim is 'weakened' or 'broken', you must execute a 'Break to Rebuild' protocol:\n"
    "1. Identify the fatal flaw.\n"
    "2. Formulate the minimal viable fix (a scope reduction, a dependency swap, or a constraint adjustment).\n"
    "3. Output the salvaged_claim and explicitly state the tradeoff_acknowledged.\n"
    "4. Set 'salvage_scope' honestly:\n"
    "   - 'parameter': the same decision with a different setting, threshold, scope or "
    "budget (e.g. hold a 0.5-1 month cash buffer instead of 3 months).\n"
    "   - 'redesign': the original decision is replaced by a different one (e.g. "
    "'Google Workspace under a signed BAA' is not consumer Drive with a tweak).\n"
    "   Do not label a redesign a parameter change to keep the decision alive. The case "
    "reads 'do not do this as written; here is what to do instead', and the salvage is "
    "shown either way.\n"
    "Exception: If the claim violates immutable laws of physics, math, or federal law, leave the salvage fields null."
)

# Backward compatibility alias
RECONCILE_SYSTEM_PROMPT = STEEL_MAN_SYSTEM_PROMPT


def objection_band(confidence: float | None) -> str:
    """Axiom 1 forbids averaging confidences, so the judge never sees the raw floats.

    Handing it `confidence=0.8` invites exactly the arithmetic the prompt bans —
    the model anchors on numbers whatever it is told. A word carries the same
    ordering without being addable."""
    if confidence is None:
        return "system error / timeout"
    if confidence <= 0.0:
        return "abstained (neutral)"
    if confidence >= 0.9:
        return "fatal"
    if confidence >= 0.7:
        return "severe"
    if confidence >= 0.4:
        return "substantive"
    if confidence >= 0.2:
        return "minor"
    return "no objection"


SALVAGE_SCOPES = ("parameter", "redesign")


def normalize_salvage_scope(raw: str | None) -> str | None:
    """Anything the judge invents outside the two scopes is dropped, not guessed at.

    A null scope reads as `parameter` in the ladder (the permissive side), so a
    hallucinated third label must not sneak through as a `drop`."""
    value = (raw or "").strip().lower()
    return value if value in SALVAGE_SCOPES else None


def has_evaluator_error(findings: list[Finding]) -> bool:
    """Returns True if any finding suffered an execution timeout or system error."""
    return any(f.confidence is None or f.result == "System Error / Timeout" for f in findings)


async def reconcile(
    claim: Claim, findings: list[Finding], provider: LLMProvider
) -> SteelManVerdict:
    if has_evaluator_error(findings):
        return SteelManVerdict(
            status=ClaimStatus.UNRESOLVED,
            reasoning="Evaluator execution failure (system error or timeout) occurred during evaluation. Claim status downgraded to unresolved due to incomplete adversarial scrutiny.",
            fatal_flaw=None,
            salvaged_claim=None,
            tradeoff_acknowledged=None,
        )

    findings_summary = "\n".join(
        f"- evaluator={f.evaluator}, result={f.result!r}, evidence_count={len(f.evidence)}, "
        f"sources={[e.source_url for e in f.evidence] or 'none'}, "
        f"objection={objection_band(f.confidence)}, reasoning={f.reasoning!r}, "
        f"contradiction={f.contradiction!r}"
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
        missing_input = result.missing_input
        salvage_scope = normalize_salvage_scope(result.salvage_scope)
    else:
        # Fallback if raw text returned
        status = ClaimStatus.UNRESOLVED
        reasoning = clamp_sentences(str(result)) if result else "Reconciliation incomplete."
        fatal_flaw = None
        salvaged_claim = None
        tradeoff_acknowledged = None
        missing_input = None
        salvage_scope = None

    # Programmatic Phase 2 Enforcement:
    # If the claim is SURVIVED or UNRESOLVED, leave salvage fields null.
    if status in (ClaimStatus.SURVIVED, ClaimStatus.UNRESOLVED):
        fatal_flaw = None
        salvaged_claim = None
        tradeoff_acknowledged = None
        salvage_scope = None
    else:
        if fatal_flaw:
            fatal_flaw = clamp_sentences(fatal_flaw, 2)
        if salvaged_claim:
            salvaged_claim = clamp_sentences(salvaged_claim, 2)
        if tradeoff_acknowledged:
            tradeoff_acknowledged = clamp_sentences(tradeoff_acknowledged, 2)
        if not salvaged_claim:
            salvage_scope = None

    # `missing_input` only means anything on an unresolved verdict; anywhere else it
    # is the judge naming a nice-to-have, which downstream would render as the one
    # thing blocking the decision.
    if status is not ClaimStatus.UNRESOLVED:
        missing_input = None
    elif missing_input:
        missing_input = clamp_sentences(missing_input, 2)

    return SteelManVerdict(
        status=status,
        reasoning=reasoning,
        fatal_flaw=fatal_flaw,
        salvaged_claim=salvaged_claim,
        tradeoff_acknowledged=tradeoff_acknowledged,
        missing_input=missing_input,
        salvage_scope=salvage_scope,
    )


def resolve_decision_state(claims: list[Claim]) -> str:
    """Derives the case decision from claim outcomes, in code.

    `drop` is the strongest thing this tool can say and it was being reached for
    while survivable mechanisms were still standing. It now requires that nothing
    load-bearing came through: one weakened-but-salvageable load-bearing claim
    means the honest answer is "change it", not "abandon it".
    """
    load_bearing = [c for c in claims if c.load_bearing]
    scope = load_bearing or claims
    if not scope:
        return "hold"

    if any(c.status is ClaimStatus.UNRESOLVED for c in scope):
        return "hold"
    if all(c.status is ClaimStatus.SURVIVED for c in scope):
        return "proceed"
    if any(
        c.status is ClaimStatus.WEAKENED and (c.salvaged_claim or "").strip() for c in scope
    ):
        return "proceed_with_changes"
    if any(c.status is ClaimStatus.BROKEN for c in scope):
        return "drop"
    return "proceed_with_changes"


def has_sourced_contradiction(findings: list[Finding]) -> bool:
    """A claim only breaks on a contradiction traceable to a source we could read.

    Presence of an EvidenceItem is not proof of one. A fabricated citation is a
    well-formed object; only `snippet_matched` means we fetched the page and found
    the quoted words on it. `unreachable` sources still inform the memo — they just
    cannot carry a kill.
    """
    return any(
        (f.contradiction or "").strip()
        and any(e.verification == "snippet_matched" for e in f.evidence)
        for f in findings
    )


# Below this objection strength every finding on a claim sits in the
# `no objection` band of OBJECTION_SCALE. A panel that raised nothing above it
# has not weakened anything, whatever word the judge reached for.
TRIVIAL_OBJECTION_CEILING = 0.2


# The same line `_blocking_weakened` uses; they must stay equal.
CONTESTED_OBJECTION_FLOOR = 0.4


def classify_weakened(findings: list[Finding], salvage_scope: str | None) -> WeakenedKind:
    """Derive whether a weakened claim is qualified or contested."""
    if has_sourced_contradiction(findings):
        return WeakenedKind.CONTESTED
    if salvage_scope == "redesign":
        return WeakenedKind.CONTESTED
    if not findings:
        return WeakenedKind.CONTESTED
    active_findings = [f for f in findings if f.confidence is not None and f.confidence > 0.0]
    max_obj = max((f.confidence for f in active_findings), default=0.0)
    if max_obj >= CONTESTED_OBJECTION_FLOOR:
        return WeakenedKind.CONTESTED
    
    return WeakenedKind.QUALIFIED


def apply_evidence_gate(
    status: ClaimStatus,
    reasoning: str,
    findings: list[Finding],
    missing_input: str | None = None,
) -> tuple[ClaimStatus, str]:
    """Stage 1a / Evidence Gating DNA, in both directions.

    Downward: absence of evidence is not refutation. `broken` requires one finding
    carrying both evidence and a contradiction. Reasoning-only evaluators can weaken;
    they cannot break.

    Error: any evaluator execution failure (timeout/error) forces ClaimStatus.UNRESOLVED.

    Upward: a `weakened` where every finding scored in the `no objection` band is the
    judge manufacturing a downgrade to look rigorous. OBJECTION_SCALE gave the panel a
    way to say "nothing here"; without this branch nothing downstream ever reads it, and
    `survived` stays unreachable (0/15 in the 2026-09-07 calibration corpus).

    Unresolved: `unresolved` means one nameable input is missing. A verdict that reaches
    it without naming that input (`missing_input`) is a hedge, and every load-bearing
    hedge forces the case to `hold` — 40.4% of Round 2 claims landed here. Re-graded on
    the evidence the panel actually produced."""
    if has_evaluator_error(findings):
        note = "Downgraded to unresolved: evaluator execution failure (system error or timeout) occurred during evaluation."
        return ClaimStatus.UNRESOLVED, f"{reasoning} {note}".strip()

    if status is ClaimStatus.BROKEN and not has_sourced_contradiction(findings):
        note = (
            "Downgraded from broken to weakened: no finding carried a contradiction "
            "traceable to a source, and absence of evidence is not refutation."
        )
        return ClaimStatus.WEAKENED, f"{reasoning} {note}".strip()
    active_findings = [f for f in findings if f.confidence is not None and f.confidence > 0.0]
    max_obj = max((f.confidence for f in active_findings), default=0.0)
    if (
        status is ClaimStatus.WEAKENED
        and findings
        and max_obj < TRIVIAL_OBJECTION_CEILING
        and not has_sourced_contradiction(findings)
    ):
        note = (
            "Upgraded from weakened to survived: every evaluator scored its finding in "
            "the 'no objection' band (or abstained) and none carried a sourced contradiction."
        )
        return ClaimStatus.SURVIVED, f"{reasoning} {note}".strip()

    if status is ClaimStatus.UNRESOLVED and findings and not (missing_input or "").strip():
        if has_sourced_contradiction(findings):
            note = (
                "Re-graded from unresolved to weakened: no missing input was named, and a "
                "finding carried a contradiction traceable to a source."
            )
            return ClaimStatus.WEAKENED, f"{reasoning} {note}".strip()
        if max_obj < TRIVIAL_OBJECTION_CEILING:
            note = (
                "Re-graded from unresolved to survived: no missing input was named and every "
                "evaluator scored its finding in the 'no objection' band (or abstained)."
            )
            return ClaimStatus.SURVIVED, f"{reasoning} {note}".strip()
        note = (
            "Re-graded from unresolved to weakened: no missing input was named, so the panel's "
            "objections decide it."
        )
        return ClaimStatus.WEAKENED, f"{reasoning} {note}".strip()

    return status, reasoning


def apply_steelman_gate(
    verdict: SteelManVerdict, findings: list[Finding]
) -> SteelManVerdict:
    """Applies Evidence Gating and maintains Phase 2 mitigation invariants on a SteelManVerdict."""
    gated_status, gated_reasoning = apply_evidence_gate(
        verdict.status, verdict.reasoning, findings, verdict.missing_input
    )
    fatal_flaw = verdict.fatal_flaw
    salvaged_claim = verdict.salvaged_claim
    tradeoff_acknowledged = verdict.tradeoff_acknowledged
    missing_input = verdict.missing_input
    salvage_scope = normalize_salvage_scope(verdict.salvage_scope)

    # If downgraded or naturally survived/unresolved, enforce null salvage fields
    if gated_status in (ClaimStatus.SURVIVED, ClaimStatus.UNRESOLVED):
        fatal_flaw = None
        salvaged_claim = None
        tradeoff_acknowledged = None
        salvage_scope = None
    elif not salvaged_claim:
        salvage_scope = None

    if gated_status is not ClaimStatus.UNRESOLVED:
        missing_input = None

    return SteelManVerdict(
        status=gated_status,
        reasoning=gated_reasoning,
        fatal_flaw=fatal_flaw,
        salvaged_claim=salvaged_claim,
        tradeoff_acknowledged=tradeoff_acknowledged,
        missing_input=missing_input,
        salvage_scope=salvage_scope,
    )


def _objection_tokens(finding: Finding) -> set[str]:
    text = (finding.contradiction or "") + " " + (finding.reasoning or "")
    return {t for t in re.findall(r"\w+", text.lower()) if len(t) > 3}


def dedupe_across_claims(findings: list[Finding], threshold: float = 0.75) -> list[Finding]:
    """Collapses the same objection restated against several claims.

    Deliberately scoped across claims only. Two evaluators independently landing on
    the same objection for ONE claim is corroboration and stays; the same objection
    pasted under every claim is padding and goes.
    """
    if not findings:
        return []

    ordered = sorted(
        findings,
        key=lambda f: f.confidence if f.confidence is not None else -1.0,
        reverse=True,
    )
    kept: list[Finding] = []
    for finding in ordered:
        tokens = _objection_tokens(finding)
        if not tokens:
            kept.append(finding)
            continue
        duplicate = False
        for existing in kept:
            if existing.claim_id == finding.claim_id:
                continue
            other = _objection_tokens(existing)
            if not other:
                continue
            overlap = len(tokens & other) / min(len(tokens), len(other))
            if overlap >= threshold:
                duplicate = True
                break
        if not duplicate:
            kept.append(finding)
    # Identity, not equality: two Findings with the same field values are equal
    # under pydantic, and dropping both would be a silent data loss.
    kept_ids = {id(f) for f in kept}
    return [f for f in findings if id(f) in kept_ids]


def rank_findings(findings: list[Finding]) -> list[Finding]:
    """Lead with the finding that actually moved the verdict, not whichever
    evaluator returned first (Stage 3)."""
    return sorted(
        findings,
        key=lambda f: (
            bool(f.evidence and (f.contradiction or "").strip()),
            bool((f.contradiction or "").strip()),
            len(f.evidence),
            f.confidence is not None,
            f.confidence if f.confidence is not None else -1.0,
        ),
        reverse=True,
    )

