"""
Routing layer for the evaluators. `core.loop.run_evaluators` imports `dispatch`
from here and calls it once per `TestPlanItem`; this module is the only place
that decides which evaluator answers which failure mode.

Contract (docs/00-CONTRACTS.md §4, frozen by Dev A):

    async def dispatch(item, case, provider) -> Finding

Every evaluator takes that same triple and returns exactly one `Finding`. No
evaluator ever sees another evaluator's output.
"""
from __future__ import annotations

from core.evaluators.builder import run_builder
from core.evaluators.devils_advocate import run_devils_advocate
from core.evaluators.operator import run_operator
from core.evaluators.researcher import run_researcher, run_researcher
from core.models import Case, Finding, TestPlanItem
from providers.base import LLMProvider

# Backward compatibility aliases
run_overthinker = run_operator


# failure_mode (assigned by core.loop.build_test_plan) -> evaluator:
#
#   evidence             the claim rests on something checkable against the world (Researcher)
#   feasibility          whether it can actually be done as stated (Builder)
#   assumption           unstated premises and counter-incentives (Devil's Advocate)
#   operational_friction human inertia, red tape, liability, process drag (Operator)
#   adoption             adoption inertia and workflow resistance (Operator)
#   bureaucracy          enterprise gatekeeping and procurement (Operator)
#   edge-case            legacy alias for boundary conditions and tail risks (Operator)
#
# behavior/constraint/alternative are older aliases; kept so a stored plan from
# a previous run still routes.
_ROUTES = {
    "evidence": run_researcher,
    "feasibility": run_builder,
    "behavior": run_builder,
    "constraint": run_builder,
    "assumption": run_devils_advocate,
    "operational_friction": run_operator,
    "adoption": run_operator,
    "bureaucracy": run_operator,
    "edge-case": run_operator,
    "edge_case": run_operator,
    "alternative": run_operator,
}

# The Researcher is the fallback. Every one of its return paths produces a Finding,
# and its zero-evidence paths abstain (confidence=0.0, "Abstain: No external empirical
# evidence found"), so an unrecognised failure_mode degrades to a search attempt that
# may abstain rather than to the harshest evidence-free evaluator in the panel. Devil's
# Advocate held this slot through Round 2 and its median objection was 0.75, which every
# misrouted claim inherited.
_FALLBACK = run_researcher


async def dispatch(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    """One signature, one triple. Every evaluator resolves its own claim from the
    case, so there is no argument-order sniffing anywhere below this line."""
    evaluator = _ROUTES.get((item.failure_mode or "").lower().strip(), _FALLBACK)
    finding = await evaluator(item, case, provider)

    if not finding.claim_id:
        finding.claim_id = item.target_claim
    if not finding.test_id:
        finding.test_id = item.id

    return finding


__all__ = [
    "dispatch",
    "run_builder",
    "run_devils_advocate",
    "run_operator",
    "run_overthinker",
    "run_researcher",
    "run_researcher",
]

