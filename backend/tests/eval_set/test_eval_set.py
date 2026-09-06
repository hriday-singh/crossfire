"""
Owner: Dev A (harness), everyone contributes cases for their own area.
See docs/01-TIMELINE.md hour 38-42 and direction doc §15.

This turns the internal validation set into pytest: 5-10 hand-picked
decisions, each chosen for a known property, run through the FULL pipeline
(not mocked) and asserted against that property. This only becomes runnable
once run_pipeline() is real end to end — until then, these are placeholders
naming the cases you already know you want, so nobody has to reconstruct the
list from memory at hour 38 under time pressure.
"""
from __future__ import annotations

import pytest


# One entry per hand-picked case. Fill in `raw_input` and tighten the
# assertion once the full loop runs. Keep the property each case is FOR in
# the test name — that's the whole value of writing this as pytest instead
# of eyeballing it once at the end.

@pytest.mark.asyncio
@pytest.mark.skip(reason="needs the full pipeline end to end — see docs/01-TIMELINE.md hour 38-42")
async def test_obvious_flaw_case_lands_broken():
    """e.g. a decision with a clearly disqualifying, checkable flaw."""
    ...


@pytest.mark.asyncio
@pytest.mark.skip(reason="needs the full pipeline end to end")
async def test_subtle_flaw_case_lands_broken_or_weakened():
    """A flaw that isn't obvious from the raw input alone — tests whether
    claim extraction + testing actually surfaces it rather than requiring
    the flaw to already be stated."""
    ...


@pytest.mark.asyncio
@pytest.mark.skip(reason="needs the full pipeline end to end")
async def test_misleading_assumption_case_gets_caught():
    """A case built around an assumption that sounds true but isn't."""
    ...


@pytest.mark.asyncio
@pytest.mark.skip(reason="needs the full pipeline end to end")
async def test_calculator_app_style_case_mostly_survives():
    """The false-positive-negativity check from direction doc §15: 'I want
    to build a calculator app' should mostly survive. If Crossfire manufactures
    a load-bearing objection here, that's Devil's Advocate turning into hater
    mode — as real a failure as missing an actual flaw."""
    ...


@pytest.mark.asyncio
@pytest.mark.skip(reason="needs the full pipeline end to end")
async def test_mixed_evidence_case_lands_unresolved_not_forced():
    """A case where the evidence genuinely conflicts — the point isn't a
    confident verdict, it's landing honestly on unresolved."""
    ...


# Soft metrics to eyeball across the whole set once these pass (not asserted
# in CI, just worth printing / logging per direction doc §15):
#   - how many cases produced a finding a reasonable user would act on
#   - how many negative findings had no real evidence behind them
