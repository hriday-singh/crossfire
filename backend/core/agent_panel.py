"""
Centralized catalog, routing table, and normalization for Crossfire evaluators.
Keeps agent panel specifications and extraction contracts modular.
"""
from __future__ import annotations

from uuid import uuid4
from pydantic import BaseModel, Field
from core.models import Case, TestPlanItem
from core.textutil import one_line

KNOWN_AGENTS: tuple[str, ...] = ("devils_advocate", "receipts", "builder", "overthinker")

# One agent, one failure mode. The whole routing table — no keywords, because a
# keyword table can only ever encode the scenarios someone thought of.
AGENT_FAILURE_MODE: dict[str, str] = {
    "devils_advocate": "assumption",
    "receipts": "evidence",
    "builder": "feasibility",
    "overthinker": "edge-case",
}

AGENT_OBJECTIVE: dict[str, str] = {
    "devils_advocate": "Stress-test the implicit premises and counter-incentives behind: {statement}",
    "receipts": "Check real-world evidence and sources that support or contradict: {statement}",
    "builder": "Assess what it concretely takes to make this true, and what blocks it: {statement}",
    "overthinker": "Identify boundary conditions and tail failures that would falsify: {statement}",
}

DEFAULT_RATIONALES: dict[str, str] = {
    "devils_advocate": "Stress-tests implicit premises, unstated assumptions, and logical contradictions.",
    "receipts": "Checks the claim against external sources and real-world evidence.",
    "builder": "Evaluates what execution actually requires and what blocks it in practice.",
    "overthinker": "Identifies tail risks, boundary failures, and second-order consequences.",
}

# Receipts is the single-pass default for secondary claims: it is the only
# evaluator that can bring an outside source back, and a sourced contradiction
# is the only thing that can break a claim (Stage 1a).
SINGLE_PASS_PRIORITY: tuple[str, ...] = ("receipts", "devils_advocate", "builder", "overthinker")


class AgentPick(BaseModel):
    agent: str = Field(description="One of: devils_advocate, receipts, builder, overthinker")
    rationale: str = Field(description="One sentence on why this decision needs that test")


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
        if agent in KNOWN_AGENTS and agent not in selected:
            selected.append(agent)
            rationales[agent] = one_line(pick.rationale) or DEFAULT_RATIONALES[agent]

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
    "Then pick which adversarial tests this specific decision needs, with a one-sentence "
    "rationale each:\n"
    "- devils_advocate: unstated premises, counter-incentives, motivated reasoning.\n"
    "- receipts: claims checkable against outside sources, prices, rules, records, precedent.\n"
    "- builder: whether execution is actually achievable with the time, money, skill or access available.\n"
    "- overthinker: rare-but-costly outcomes, boundary conditions, second-order effects.\n"
    "Pick only the ones that earn their place for this decision."
)


def build_test_plan(
    case: Case,
    panel: bool = True,
    active_agents: list[str] | None = None,
) -> list[TestPlanItem]:
    """Load-bearing claims get the full active panel; the rest get one pass.

    That difference is the entire adaptive-scrutiny mechanism, and it is why a
    run costs more than a single prompt. `panel=False` forces the cheap path for
    every claim.
    """
    if active_agents is None:
        active_agents = list(getattr(case, "selected_agents", None) or KNOWN_AGENTS)
    agents = [a for a in KNOWN_AGENTS if a in active_agents] or ["devils_advocate"]
    single = next((a for a in SINGLE_PASS_PRIORITY if a in agents), agents[0])

    items: list[TestPlanItem] = []
    for claim in case.claims:
        # load_bearing is None before the ranking runs — treat unranked as full panel.
        full = panel and claim.load_bearing is not False
        for agent in agents if full else [single]:
            items.append(
                TestPlanItem(
                    id=str(uuid4()),
                    target_claim=claim.id,
                    failure_mode=AGENT_FAILURE_MODE[agent],
                    objective=AGENT_OBJECTIVE[agent].format(statement=claim.statement),
                )
            )
    return items

