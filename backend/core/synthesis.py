"""
Owner: Dev A. Synthesis layer for consequences and case-level verdicts.
Extracted from core.loop to maintain modularity and single responsibility.
"""
from __future__ import annotations

import asyncio
import logging
import re
from pydantic import BaseModel, Field

from core.models import (
    Case,
    CaseVerdict,
    Claim,
    ClaimStatus,
    DecidingFactor,
    DecisionConsequence,
    Finding,
    NextAction,
)
from core.reconcile import rank_findings
from core.textutil import clamp_sentences
from providers.base import LLMProvider

logger = logging.getLogger(__name__)

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
    headline: str = Field(
        default="",
        description=(
            "The call in a short, punchy heading of generally 3 to 6 words (at most 8 words). "
            "Never a big line or rambling sentence."
        ),
    )
    summary: str = Field(
        description=(
            "At most 3 sentences: brief executive summary of what was evaluated, "
            "what happened overall, and what key errors or flawed assumptions were identified."
        )
    )
    next_actions: list[NextActionOutput] = Field(
        default_factory=list,
        description="2 to 3 merged actions covering everything that failed. No near-duplicates.",
    )


_DECISION_STATES = ("proceed", "proceed_with_changes", "hold", "drop")

HEADLINE_MAX_CHARS = 70
HEADLINE_MAX_WORDS = 9

# The strings the UI used to pick from `decision_state` alone. Kept as the floor
# when generation fails, never as the first choice: four fixed lines read
# identically across unrelated decisions, which is what made every verdict look
# the same regardless of what the panel actually found.
FALLBACK_HEADLINES = {
    "drop": "Don't proceed as written.",
    "hold": "Not decidable yet.",
    "proceed_with_changes": "Survives, but only with changes.",
    "proceed": "Holds up.",
}

# Openers that mean the model wrote a category label or a hedge, not a call.
_HEADLINE_BANNED_PREFIXES = (
    "consider",
    "overall",
    "in summary",
    "in short",
    "it depends",
    "this decision",
    "the decision",
    "the proposal",
    "the claim",
    "the plan",
    "result",
    "verdict",
)

_HEADLINE_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def sanitize_headline(raw: str, decision_state: str) -> str:
    """One sentence, under the character and word cap, or fall back to the static line.

    Generally 3-6 words (up to 9 words max). Avoids multi-clause rambling lines.
    Every rejection returns the fallback rather than a repaired string: a headline
    truncated mid-clause reads as a bug, and the static line is at least correct."""
    text = " ".join((raw or "").split()).strip(" \"'")
    if not text:
        return FALLBACK_HEADLINES.get(decision_state, "")

    if any(text.lower().startswith(prefix) for prefix in _HEADLINE_BANNED_PREFIXES):
        return FALLBACK_HEADLINES.get(decision_state, "")

    # Two sentences is a summary. Keep the first if it stands on its own.
    sentences = [s.strip() for s in _HEADLINE_SENTENCE_SPLIT.split(text) if s.strip()]
    if len(sentences) > 1:
        text = sentences[0]

    words = text.split()
    if not (8 <= len(text) <= HEADLINE_MAX_CHARS and len(words) <= HEADLINE_MAX_WORDS):
        return FALLBACK_HEADLINES.get(decision_state, "")
    return text


_STATUS_SEVERITY = {
    ClaimStatus.BROKEN: 1,
    ClaimStatus.UNRESOLVED: 2,
    ClaimStatus.WEAKENED: 3,
    ClaimStatus.SURVIVED: 4,
}


def build_deciding_factor(case: Case) -> DecidingFactor | None:
    """The one finding that moved the verdict, resolved here instead of in the UI.

    Ranked over failed claims only — a finding against a claim that survived did
    not decide anything. Load-bearing failures outrank secondary ones, since a
    secondary claim breaking is not what forced the call."""
    failed = [
        c
        for c in case.claims
        if c.status in (ClaimStatus.BROKEN, ClaimStatus.WEAKENED, ClaimStatus.UNRESOLVED)
    ]
    if not failed:
        return None
    failed.sort(key=lambda c: (not c.load_bearing, _STATUS_SEVERITY.get(c.status, 99)))
    target = failed[0]

    claim_findings = [f for f in case.findings if f.claim_id == target.id]
    if not claim_findings:
        return None
    top = rank_findings(claim_findings)[0]

    evidence = top.evidence[0] if top.evidence else None
    consequence = next((c for c in case.consequences if c.claim_id == target.id), None)
    reasoning = (consequence.verdict_reasoning if consequence else "") or ""

    return DecidingFactor(
        claim_id=target.id,
        evaluator=top.evaluator,
        # The contradiction is the sharp end when there is one; `result` is the
        # fallback and is already capped to 140 chars at generation.
        the_fact=(top.contradiction or "").strip() or top.result,
        source_url=evidence.source_url if evidence else None,
        source_title=evidence.title if evidence else None,
        gate_fired="Downgraded from broken to weakened" in reasoning,
    )


def _blocking_weakened(case: Case, claim: Claim) -> bool:
    """A `weakened` only blocks `proceed` if something substantive weakened it.

    Steel Man reaches for `weakened` on ordinary friction, so a claim whose whole
    panel scored in the `no objection`/`minor` bands would otherwise drag the case
    to `proceed_with_changes` on nothing. 0.4 is the OBJECTION_SCALE line where a
    finding starts claiming the decision needs a named fix."""
    findings = [f for f in case.findings if f.claim_id == claim.id]
    if not findings:
        return True
    return max(f.confidence for f in findings) >= 0.4


def _fallback_decision_state(case: Case) -> str:
    """Used when the synthesis call fails — derived from the verdicts alone.

    Not a pure severity ladder. `drop` means "there is nothing left to do here",
    which is only true when a refuted load-bearing claim has no salvage. Break to
    Rebuild exists to produce that salvage; discarding it and reporting `drop`
    anyway threw away the answer (d2-pro-se-custody, e2-pwa-instead-of-native)."""
    lb = [c for c in case.claims if c.load_bearing] or case.claims
    broken = [c for c in lb if c.status is ClaimStatus.BROKEN]
    if broken:
        if all((c.salvaged_claim or "").strip() for c in broken):
            return "proceed_with_changes"
        return "drop"
    if any(c.status is ClaimStatus.UNRESOLVED for c in lb):
        return "hold"
    if any(
        c.status is ClaimStatus.WEAKENED and _blocking_weakened(case, c) for c in lb
    ):
        return "proceed_with_changes"
    return "proceed"


CASE_VERDICT_SYSTEM_PROMPT = (
    "You close out an adversarial review of one decision. Every claim it rests on has "
    "already been judged individually. Produce the case-level answer, not a restatement "
    "of the claims. The decision may be of any kind — never assume a domain.\n"
    "- 'decision_state': 'proceed' (nothing load-bearing failed), 'proceed_with_changes' "
    "(it survives with named modifications), 'hold' (a load-bearing claim is unproven and "
    "must be settled first), 'drop' (a load-bearing claim was refuted by a source).\n"
    "- 'headline': the call itself, as a short, punchy heading of generally 3 to 6 words "
    "(it can be slightly more, up to 7-8 words max, but never a big line). Deliver the core call "
    "or decisive factor in one brief phrase (e.g., 'Don't proceed as written', 'Requires human legal review', "
    "'Severe compliance bottleneck', 'Holds up as planned', 'Key cost premise refuted'). "
    "No rambling, no opening with 'Consider', 'Overall', 'The proposal' or 'This decision'.\n"
    "- 'summary': at most 2 to 3 sentences. Do NOT rewrite, restate, or quote the original "
    "decision, proposal, or question. Do NOT open with 'We evaluated the proposal to...' or "
    "'We examined whether...'. Open directly with 'After evaluation, we found that...' or "
    "'After evaluation, we got...' (or similar direct phrasing) stating the outcome across claims. "
    "Sentence 1 states the overall outcome across claims (how many held, how many failed). "
    "Sentences 2-3 briefly identify the key errors, empirical contradictions, or fatal flaws "
    "that caused claims to break or weaken. Keep it brief, punchy, and grounded in the concrete "
    "vocabulary of the decision itself so the reader immediately grasps what happened and what errors "
    "were uncovered without reading the entire report.\n"
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
    weakened = [c.id for c in case.claims if c.status is ClaimStatus.WEAKENED]
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
        weakened=weakened,
        unproven=unproven,
        next_actions=[],
    )

    claim_details = []
    for c in case.claims:
        status_str = c.status.value if c.status else "untested"
        lb_str = " (load-bearing)" if c.load_bearing else ""
        detail = f"- {c.id} [{status_str}]{lb_str} {c.statement}"
        flaws = []
        if c.fatal_flaw:
            flaws.append(f"fatal flaw: {c.fatal_flaw}")
        claim_findings = [f for f in case.findings if f.claim_id == c.id]
        if claim_findings:
            top_f = rank_findings(claim_findings)[0]
            if top_f.contradiction:
                flaws.append(f"contradiction: {top_f.contradiction}")
            elif top_f.result and top_f.result.lower() not in ("survived", "held up"):
                flaws.append(f"finding: {top_f.result}")
        if flaws:
            detail += f" | Errors/Issues: {'; '.join(flaws)}"
        claim_details.append(detail)
    claim_lines = "\n".join(claim_details)
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
        verdict.headline = sanitize_headline(
            getattr(result, "headline", "") or "", verdict.decision_state
        )
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

    if not verdict.headline:
        verdict.headline = FALLBACK_HEADLINES.get(verdict.decision_state, "")
    verdict.deciding_factor = build_deciding_factor(case)
    if not verdict.summary:
        total = len(case.claims)
        key_flaws = []
        for c in case.claims:
            if c.status in (ClaimStatus.BROKEN, ClaimStatus.WEAKENED, ClaimStatus.UNRESOLVED):
                if c.fatal_flaw:
                    key_flaws.append(c.fatal_flaw)
                else:
                    claim_findings = [f for f in case.findings if f.claim_id == c.id]
                    if claim_findings:
                        top_f = rank_findings(claim_findings)[0]
                        if top_f.contradiction:
                            key_flaws.append(top_f.contradiction)
                        elif top_f.result and top_f.result.lower() not in ("survived", "held up"):
                            key_flaws.append(top_f.result)
        flaws_str = f" Key errors identified: {'; '.join(key_flaws[:2])}." if key_flaws else ""
        if len(survived) == total and total > 0:
            verdict.summary = (
                f"After evaluation, all {total} core assumption{'s' if total > 1 else ''} held up "
                f"with verified outside evidence. No critical errors were identified."
            )
        else:
            verdict.summary = (
                f"After evaluation, we found that {len(survived)} assumption{'s' if len(survived) != 1 else ''} held up, "
                f"{len(broken)} refuted, and {len(unproven)} unproven.{flaws_str}"
            )
    if not verdict.next_actions:
        verdict.next_actions = [
            NextAction(action=cons.next_validation, claim_ids=[cons.claim_id])
            for cons in case.consequences
            if cons.next_validation
        ][:3]
    return verdict

