"""
Owner: Dev A. FROZEN at hour 2 per docs/00-CONTRACTS.md #1.
Everyone imports from here. Don't change field names/types after freeze
without a live sync — Dev B and Dev C both import these directly.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class ClaimStatus(str, Enum):
    SURVIVED = "survived"
    WEAKENED = "weakened"
    BROKEN = "broken"
    UNRESOLVED = "unresolved"


class Claim(BaseModel):
    id: str
    statement: str
    load_bearing: bool | None = None       # set after the load-bearing question runs
    load_bearing_reason: str | None = None # why this claim is load-bearing or secondary
    status: ClaimStatus | None = None
    confidence: float | None = None        # synthetic claim confidence: 0.0 (broken) to 1.0 (validated)
    fatal_flaw: str | None = None          # isolated flaw if weakened/broken
    salvaged_claim: str | None = None      # minimal viable re-architecture (Break to Rebuild)
    tradeoff_acknowledged: str | None = None  # operational trade-off of the salvaged claim
    missing_input: str | None = None       # unresolved only: the exact number/document/measurement
                                           # that would settle it. Null for every other status.
    salvage_scope: str | None = None       # "parameter" (same decision, different setting) or
                                           # "redesign" (a different decision replaces it).
                                           # Decides drop vs proceed_with_changes on a broken claim.



class TestPlanItem(BaseModel):
    id: str
    target_claim: str                       # Claim.id
    failure_mode: str                       # what kind of failure this test is built to catch
    objective: str


class EvidenceItem(BaseModel):
    source_url: str
    title: str | None = None
    snippet: str                            # curated, not the full page
    retrieved_at: str
    stance: str = "context"                 # supports | contradicts | context — how it bears on the claim
    source_class: str = "unranked"          # primary | institutional | press | community | blog | unranked
    provider: str = "duckduckgo"            # serpapi | duckduckgo | fixture


class Finding(BaseModel):
    claim_id: str
    test_id: str
    evaluator: str                          # "devils_advocate" | "receipts" | "builder" | "operator"
    result: str
    evidence: list[EvidenceItem] = []
    reasoning: str
    confidence: float | None = None         # objection strength: how hard this finding argues
                                            # AGAINST the claim. 0.0 = no objection. One scale for
                                            # all four evaluators — see textutil.OBJECTION_SCALE.
                                            # Not "how sure the evaluator is": that is unrankable
                                            # across personas (rank_findings sorts on this).
    contradiction: str | None = None


class NextAction(BaseModel):
    """An action anchored to the claims that forced it. Empty anchors are valid."""

    action: str
    claim_ids: list[str] = []               # Claim.id values this action answers


class DecidingFactor(BaseModel):
    """The one finding that actually moved the case verdict.

    Derived, not generated: `rank_findings` already knows which finding carried
    evidence and a contradiction. Resolving it server-side keeps the verdict page
    from having to re-derive "what mattered" out of the full findings list.
    """

    claim_id: str
    evaluator: str
    the_fact: str                           # the number, rule, cost or contradiction. verbatim.
    source_url: str | None = None
    source_title: str | None = None
    gate_fired: bool = False                # the evidence gate downgraded broken -> weakened here,
                                            # i.e. the panel attacked but nobody could cite it


class CaseVerdict(BaseModel):
    """One case-level judgement replacing N near-identical per-claim ones."""

    decision_state: str                     # proceed | proceed_with_changes | hold | drop
    headline: str = ""                      # the call in one line, <= 70 chars, generated per case.
                                            # Empty falls back to a static string keyed on
                                            # decision_state — four fixed strings read identically
                                            # across unrelated decisions, which is the point of
                                            # generating this.
    summary: str
    deciding_factor: DecidingFactor | None = None
    survived: list[str] = []                # claim ids
    broken: list[str] = []
    weakened: list[str] = []                # weakened claim ids
    unproven: list[str] = []                # weakened + unresolved
    next_actions: list[NextAction] = []     # 2-3 merged, deduped, claim-anchored


class DecisionConsequence(BaseModel):
    claim_id: str
    impact: str                             # high | medium | low, or a short phrase
    recommended_change: str
    next_validation: str | None = None      # required when status is broken/unresolved and load-bearing
    verdict_reasoning: str = ""             # why Steelman reconciled to this status — persisted here,
                                             # not just riding along on the SSE event
    fatal_flaw: str | None = None           # isolated flaw from Steel Man
    salvaged_claim: str | None = None       # minimal viable fix from Steel Man
    tradeoff_acknowledged: str | None = None  # operational trade-off from Steel Man


class AgentTokenUsage(BaseModel):
    agent: str                              # extractor, load_bearing, devils_advocate, builder, receipts, operator, cross_examination, steelman, synthesis
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class CaseTelemetry(BaseModel):
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_tokens: int = 0
    total_estimated_cost_usd: float = 0.0
    agent_breakdown: list[AgentTokenUsage] = []
    duration_ms: float = 0.0


class Case(BaseModel):
    id: str
    raw_input: str
    context: str | None = None              # from an ingested doc/URL, once that path exists
    claims: list[Claim] = []
    test_plan: list[TestPlanItem] = []
    findings: list[Finding] = []
    consequences: list[DecisionConsequence] = []
    case_verdict: CaseVerdict | None = None  # set at the end of the run
    status: str = "extracting"              # extracting | needs_input | awaiting_confirmation | testing | done | error
    gate_message: str | None = None         # set when the input was too open-ended to test
    agent_mode: str = "auto"                # "auto" | "custom"
    selected_agents: list[str] = [          # active evaluator IDs: devils_advocate, receipts, builder, operator
        "devils_advocate",
        "receipts",
        "builder",
        "operator",
    ]
    agent_rationales: dict[str, str] = {}   # rationales explaining why agents were auto-selected
    telemetry: CaseTelemetry | None = None  # token usage & cost telemetry
