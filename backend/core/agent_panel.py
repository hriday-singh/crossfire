"""
Centralized catalog, routing table, and normalization for Crossfire evaluators.
Keeps agent panel specifications and extraction contracts modular.
"""
from __future__ import annotations

from uuid import uuid4
from pydantic import BaseModel, Field
from core.models import Case, TestPlanItem
from core.textutil import format_concise_rationale, is_empirical_claim, one_line

KNOWN_AGENTS: tuple[str, ...] = ("devils_advocate", "receipts", "builder", "operator")

# One agent, one failure mode. The whole routing table — no keywords, because a
# keyword table can only ever encode the scenarios someone thought of.
AGENT_FAILURE_MODE: dict[str, str] = {
    "devils_advocate": "assumption",
    "receipts": "evidence",
    "builder": "feasibility",
    "operator": "operational_friction",
}

FAILURE_MODE_TO_AGENT: dict[str, str] = {
    v: k for k, v in AGENT_FAILURE_MODE.items()
}
FAILURE_MODE_TO_AGENT["edge-case"] = "operator"


AGENT_OBJECTIVE: dict[str, str] = {
    "devils_advocate": "Deductively probe unstated premises, circular dependencies, and counter-incentives behind: {statement}",
    "receipts": "Empirically verify external evidence, benchmarks, prices, or statutory sources for: {statement}",
    "builder": "Assess technical architecture, API dependencies, execution limits, and Day-1 blockers for: {statement}",
    "operator": "Stress-test human adoption inertia, workflow disruption, procurement red tape, and process drag for: {statement}",
}

DEFAULT_RATIONALES: dict[str, str] = {
    "devils_advocate": "Tests unstated premises and deductive logical flaws.",
    "receipts": "Verifies facts and regulations against empirical evidence.",
    "builder": "Evaluates technical architecture and execution blockers.",
    "operator": "Stress-tests human adoption and organizational friction.",
}

# Receipts is the single-pass default for secondary claims: it is the only
# evaluator that can bring an outside source back, and a sourced contradiction
# is the only thing that can break a claim (Stage 1a).
SINGLE_PASS_PRIORITY: tuple[str, ...] = ("receipts", "devils_advocate", "builder", "operator")


class AgentPick(BaseModel):
    agent: str = Field(description="One of: devils_advocate, receipts, builder, operator")
    rationale: str = Field(
        description="One clear, concise sentence (under 100 characters) explaining why this test is needed."
    )


class ExtractedClaims(BaseModel):
    """Narrow extraction schema — not the frozen Case shape. Asking the model
    to fill Case's full fields directly risks hallucinated/unrequested fields;
    this stays small and gets mapped onto Case here."""

    testable: bool = Field(
        default=True,
        description="False when the input names no concrete decision to test (pure ideation, open-ended life advice).",
    )
    redirect: str | None = Field(
        default=None,
        description="When testable is False: one sentence asking for the specific decision, naming what is missing.",
    )
    statements: list[str] = Field(default_factory=list)
    agents: list[AgentPick] = Field(default_factory=list)


def normalize_agents(picks: list[AgentPick]) -> tuple[list[str], dict[str, str]]:
    """Validates the model's agent picks against the known panel.

    Devil's Advocate is always present: it needs no evidence and always returns
    a finding, so a claim can never fall out of the run entirely.
    """
    selected: list[str] = []
    rationales: dict[str, str] = {}
    for pick in picks or []:
        agent = (pick.agent or "").strip().lower()
        if agent == "overthinker":
            agent = "operator"
        if agent == "researcher":
            agent = "receipts"
        if agent in KNOWN_AGENTS and agent not in selected:
            selected.append(agent)
            rationales[agent] = format_concise_rationale(pick.rationale) or DEFAULT_RATIONALES[agent]

    if "devils_advocate" not in selected:
        selected.insert(0, "devils_advocate")
        rationales.setdefault("devils_advocate", DEFAULT_RATIONALES["devils_advocate"])
    if not rationales:
        rationales = dict(DEFAULT_RATIONALES)

    # Ordered by KNOWN_AGENTS so the panel reads the same way every run.
    ordered = [a for a in KNOWN_AGENTS if a in selected]
    return ordered, {a: rationales.get(a, DEFAULT_RATIONALES[a]) for a in ordered}


EXTRACTION_SYSTEM_PROMPT = (
    "You map a decision onto the discrete claims it rests on. The decision can be of "
    "any kind — personal, financial, medical, legal, career, operational, technical, "
    "creative. Never assume a domain.\n\n"
    "First judge whether the input names a concrete decision or proposal that could "
    "turn out to be a mistake. Open-ended ideation ('give me a cool idea'), vague "
    "aspiration, or a request for general life advice is NOT testable: set testable=false "
    "and put one sentence in 'redirect' asking for the specific decision, naming exactly "
    "what is missing. Do not invent claims in that case.\n\n"
    "If it is testable, return 2 to 5 crisp, falsifiable claims. Each must be a single "
    "assertion that could independently turn out true or false. Include both what the "
    "user asserted outright AND the unstated assumptions the proposal silently depends "
    "on. Write each claim so it stands on its own without the original wording.\n\n"
    "Then pick which adversarial tests this specific decision needs. For each chosen agent, "
    "provide exactly ONE concise sentence (under 100 characters) clearly explaining why this "
    "test is needed for this decision. Keep it crisp, direct, and under three lines. No filler:\n"
    "- devils_advocate: unstated premises, counter-incentives, motivated reasoning.\n"
    "- receipts: claims checkable against outside sources, prices, rules, records, precedent.\n"
    "- builder: whether execution is actually achievable with the time, money, skill or access available.\n"
    "- operator: organizational friction, human inertia, enterprise procurement red tape, regulatory liability, process drag.\n"
    "Pick only the ones that earn their place for this decision."
)


def build_test_plan(
    case: Case,
    panel: bool = True,
    active_agents: list[str] | None = None,
) -> list[TestPlanItem]:
    """Routes claims to adversarial evaluators.

    All claims (load-bearing and secondary) receive multi-persona scrutiny:
    - Empirical claims: route to Researcher (receipts), Builder (builder), Operator (operator),
      and Devil's Advocate (devils_advocate).
    - Non-empirical claims: omit Researcher (receipts), routing to Builder (builder),
      Operator (operator), and Devil's Advocate (devils_advocate).

    Single-pass single-evaluator routing has been eliminated to prevent routing blindspots.
    Claims are never routed to a single persona unless explicitly restricted by a single-element
    `active_agents` configuration.
    """
    if active_agents is None:
        active_agents = list(getattr(case, "selected_agents", None) or KNOWN_AGENTS)
    agents = [a for a in KNOWN_AGENTS if a in active_agents] or ["devils_advocate"]

    items: list[TestPlanItem] = []
    for claim in case.claims:
        # Selective Evaluator Dispatch: omit receipts if claim is not empirical
        claim_agents = [a for a in agents if a != "receipts" or is_empirical_claim(claim.statement)]
        if not claim_agents:
            claim_agents = list(agents)

        target_agents = claim_agents

        for agent in target_agents:
            items.append(
                TestPlanItem(
                    id=str(uuid4()),
                    target_claim=claim.id,
                    failure_mode=AGENT_FAILURE_MODE[agent],
                    objective=AGENT_OBJECTIVE[agent].format(statement=claim.statement),
                )
            )
    return items
