"""Routing behaviour of `core.evaluators.dispatch` — which evaluator answers
which failure_mode, and what happens to a mode nobody claimed."""
from __future__ import annotations

import pytest

import core.evaluators as evaluators
from core.evaluators import dispatch
from core.models import Case, Finding, TestPlanItem


def _item(failure_mode: str, claim_id: str = "c1") -> TestPlanItem:
    return TestPlanItem(
        id="t1",
        target_claim=claim_id,
        failure_mode=failure_mode,
        objective="probe it",
    )


def _spy(name: str):
    """Stands in for an evaluator, recording that it was the one dispatched to."""

    async def _evaluator(item: TestPlanItem, case: Case, provider) -> Finding:
        return Finding(
            claim_id=item.target_claim,
            test_id=item.id,
            evaluator=name,
            result="",
            reasoning="",
            confidence=0.0,
        )

    return _evaluator


@pytest.fixture
def routed(monkeypatch):
    """Swap the real evaluators out — this is a test of the routing table, not
    of what the evaluators behind it decide."""
    monkeypatch.setattr(
        evaluators,
        "_ROUTES",
        {
            "evidence": _spy("receipts"),
            "behavior": _spy("builder"),
            "constraint": _spy("builder"),
            "alternative": _spy("devils_advocate"),
        },
    )
    monkeypatch.setattr(evaluators, "_FALLBACK", _spy("devils_advocate"))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "failure_mode,expected",
    [
        ("evidence", "receipts"),
        ("behavior", "builder"),
        ("constraint", "builder"),
        ("alternative", "devils_advocate"),
    ],
)
async def test_dispatch_routes_each_failure_mode_to_its_evaluator(
    routed, sample_case, failure_mode, expected
):
    finding = await dispatch(_item(failure_mode), sample_case, None)
    assert finding.evaluator == expected


@pytest.mark.asyncio
async def test_dispatch_falls_back_instead_of_dropping_an_unknown_failure_mode(
    routed, sample_case
):
    """An unrecognised mode must still produce a Finding. Raising here would be
    swallowed by run_evaluators' return_exceptions=True and the claim would go
    to the Judge with nothing, silently reconciling to unresolved."""
    finding = await dispatch(_item("mode_nobody_wrote_yet"), sample_case, None)
    assert finding.evaluator == "devils_advocate"


def test_every_failure_mode_build_test_plan_emits_has_a_route():
    """Guards the seam between the two halves: core.loop picks failure_mode
    strings, this module maps them. Adding a keyword bucket without a route
    would silently demote those claims to the fallback evaluator."""
    from core.loop import _FAILURE_MODE_KEYWORDS

    modes = {mode for mode, _ in _FAILURE_MODE_KEYWORDS} | {"evidence"}  # "evidence" is the default
    assert modes <= set(evaluators._ROUTES)
