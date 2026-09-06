"""
Routing layer for the evaluators. `core.loop.run_evaluators` imports `dispatch`
from here and calls it once per `TestPlanItem`; this module is the only place
that decides which evaluator answers which failure mode.

Contract (docs/00-CONTRACTS.md §4, frozen by Dev A):

    async def dispatch(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding

Every evaluator takes that same triple and returns exactly one `Finding`. No
evaluator ever sees another evaluator's output.
"""
from __future__ import annotations

from core.evaluators.builder import run_builder
from core.evaluators.devils_advocate import run_devils_advocate
from core.evaluators.overthinker import run_overthinker
from core.evaluators.receipts import run_receipts
from core.models import Case, Claim, Finding, TestPlanItem
from providers.base import LLMProvider

# failure_mode (assigned by core.loop.build_test_plan or contract §4) -> evaluator:
#
#   evidence    the claim rests on something checkable against the world (Receipts)
#   behavior    how the thing performs once built (Builder)
#   constraint  legal/compliance/platform limit clearable (Builder)
#   feasibility buildability/effort evaluation (Builder)
#   assumption  unstated premises and counter-incentives (Devil's Advocate)
#   edge-case   tail risks, boundary failures (Overthinker)
#   alternative competitor/uniqueness assumptions (Overthinker)
_ROUTES = {
    "evidence": run_receipts,
    "behavior": run_builder,
    "constraint": run_builder,
    "feasibility": run_builder,
    "assumption": run_devils_advocate,
    "edge-case": run_overthinker,
    "edge_case": run_overthinker,
    "alternative": run_overthinker,
}

# Devil's Advocate is the fallback because it needs no evidence and always
# produces a Finding: an unrecognised failure_mode degrades to a weaker test
# instead of dropping the claim out of the run entirely.
_FALLBACK = run_devils_advocate


async def dispatch(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    evaluator = _ROUTES.get((item.failure_mode or "").lower().strip(), _FALLBACK)

    # Ensure claim exists so prompt-only evaluators don't raise ValueError
    claim = next((c for c in case.claims if c.id == item.target_claim), None)
    if claim is None:
        target_claim = Claim(id=item.target_claim, statement=item.objective)
        if evaluator in (run_devils_advocate, run_overthinker):
            finding = await evaluator(target_claim, item, case, provider)
        else:
            finding = await evaluator(item, case, provider)
    else:
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
    "run_overthinker",
    "run_receipts",
]

