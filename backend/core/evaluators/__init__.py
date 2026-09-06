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
from core.evaluators.receipts import run_receipts
from core.models import Case, Finding, TestPlanItem
from providers.base import LLMProvider

# failure_mode (assigned by core.loop.build_test_plan) -> evaluator.
#
#   evidence    the claim rests on something checkable against the world
#   behavior    the claim is about how the thing performs once built
#   constraint  the claim assumes a legal/compliance/platform limit is clearable
#   alternative the claim assumes no one else has done this
_ROUTES = {
    "evidence": run_receipts,
    "behavior": run_builder,
    "constraint": run_builder,
    "alternative": run_devils_advocate,
}

# Devil's Advocate is the fallback because it needs no evidence and always
# produces a Finding: an unrecognised failure_mode degrades to a weaker test
# instead of dropping the claim out of the run entirely.
_FALLBACK = run_devils_advocate

# ponytail: run_overthinker is implemented but deliberately unrouted — no
# failure_mode bucket maps to second-order effects yet. To wire it, add a bucket
# to core.loop._FAILURE_MODE_KEYWORDS and a matching entry above.


async def dispatch(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    evaluator = _ROUTES.get(item.failure_mode, _FALLBACK)
    return await evaluator(item, case, provider)


__all__ = [
    "dispatch",
    "run_builder",
    "run_devils_advocate",
    "run_receipts",
]
