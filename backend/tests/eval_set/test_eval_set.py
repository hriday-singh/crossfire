"""
Owner: Dev A (harness), everyone contributes cases for their own area.
See docs/01-TIMELINE.md hour 38-42 and direction doc §15.

The internal validation set as pytest: one test per hand-picked decision, run
through the FULL pipeline against a real provider — not mocked. Mocking here
would only assert the canned responses, which measures nothing.

    CROSSFIRE_EVAL_LIVE=1 pytest tests/eval_set -s

Cases live in cases.py. Skipped by default (see conftest.py).
"""
from __future__ import annotations

import pytest

import store
from core.loop import extract_claims, run_pipeline
from core.models import Case, ClaimStatus
from providers import get_provider
from tests.eval_set.cases import EVAL_CASES, EvalCase


async def _run_full_pipeline(raw_input: str) -> Case:
    """Everything `POST /cases` + `POST /cases/{id}/confirm` would do, minus the
    HTTP hop and minus the human confirmation step (every extracted claim is
    treated as confirmed)."""
    provider = get_provider()
    case = await extract_claims(raw_input, provider)
    store.set(case)
    await run_pipeline(case.id, provider)  # awaited directly — no SSE consumer here
    result = store.get(case.id)
    assert result is not None, "pipeline dropped the case out of the store"
    return result


def _record(metrics: list[dict], eval_case: EvalCase, case: Case) -> None:
    actionable = any(
        c.load_bearing
        and c.status is not ClaimStatus.SURVIVED
        and any(x.claim_id == c.id and x.next_validation for x in case.consequences)
        for c in case.claims
    )
    unsourced = sum(1 for f in case.findings if f.contradiction and not f.evidence)
    metrics.append(
        {
            "case": eval_case.id,
            "claims": len(case.claims),
            "actionable": actionable,
            "unsourced_objections": unsourced,
        }
    )


@pytest.mark.parametrize("eval_case", EVAL_CASES, ids=lambda c: c.id)
async def test_eval_case(eval_case: EvalCase, live_eval_enabled, eval_metrics):
    case = await _run_full_pipeline(eval_case.raw_input)
    _record(eval_metrics, eval_case, case)
    eval_case.check(case)  # asserts only the property this case was picked for


def test_every_case_declares_the_property_it_is_for():
    """Cheap guard that runs offline: the set is only useful if each entry says
    what it's checking and the ids stay unique."""
    ids = [c.id for c in EVAL_CASES]
    assert len(ids) == len(set(ids)), f"duplicate eval case ids: {ids}"
    assert 5 <= len(EVAL_CASES) <= 10, "keep the set hand-picked — 5-10 cases"
    for case in EVAL_CASES:
        assert case.prop and case.raw_input, f"{case.id} is missing prop/raw_input"
