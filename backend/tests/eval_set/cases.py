"""
Owner: Dev A (harness), everyone contributes cases for their own area.

The internal validation set from direction doc §15, as data. Each entry names
the property it was hand-picked for and carries the assertion for exactly that
property — nothing else. A case that asserts "the verdict is correct" in general
is useless; a case that asserts "this specific failure mode gets caught" tells
you which part of the loop regressed.

Adding a case: append an `EvalCase`. Say what it is FOR in `prop`, and keep the
assertion to that one property.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from core.models import Case, ClaimStatus

CONFIDENT = {ClaimStatus.BROKEN, ClaimStatus.WEAKENED}


@dataclass(frozen=True)
class EvalCase:
    id: str
    raw_input: str
    prop: str                      # the property this case exists to check
    check: Callable[[Case], None]  # asserts that property, nothing more


# --- assertion helpers -------------------------------------------------------


def _statuses(case: Case) -> list[ClaimStatus]:
    return [c.status for c in case.claims if c.status is not None]


def _load_bearing(case: Case):
    return [c for c in case.claims if c.load_bearing]


def _summary(case: Case) -> str:
    """Every failure message needs the actual verdicts, or you're re-running the
    case by hand just to see what it decided."""
    return "\n".join(
        f"  [{c.status.value if c.status else 'none'}]"
        f"{' load-bearing' if c.load_bearing else ''} {c.statement}"
        for c in case.claims
    ) or "  (no claims extracted)"


def _catches_a_flaw(case: Case) -> None:
    assert any(s in CONFIDENT for s in _statuses(case)), (
        f"expected at least one claim broken/weakened, got none:\n{_summary(case)}"
    )


def _mostly_survives(case: Case) -> None:
    statuses = _statuses(case)
    assert statuses, f"no claim was given a status:\n{_summary(case)}"
    survived = sum(s is ClaimStatus.SURVIVED for s in statuses)
    assert survived > len(statuses) / 2, (
        f"a sound idea should mostly survive - {survived}/{len(statuses)} did:\n{_summary(case)}"
    )
    # Hater-mode check: manufacturing a load-bearing objection here is as real a
    # failure as missing a genuine flaw (direction doc §15).
    broken = [c for c in _load_bearing(case) if c.status is ClaimStatus.BROKEN]
    assert not broken, (
        f"manufactured a load-bearing objection against a sound idea:\n{_summary(case)}"
    )


def _lands_unresolved(case: Case) -> None:
    assert ClaimStatus.UNRESOLVED in _statuses(case), (
        f"conflicting evidence must land unresolved, not a forced winner:\n{_summary(case)}"
    )


def _does_not_crash(case: Case) -> None:
    assert case.status == "done", f"pipeline ended in {case.status!r}:\n{_summary(case)}"
    for consequence in case.consequences:
        assert consequence.verdict_reasoning, (
            f"consequence for {consequence.claim_id} has empty verdict_reasoning"
        )


def _dead_source_degrades(case: Case) -> None:
    _does_not_crash(case)
    # Architectural invariant: empty evidence must never produce a high-confidence refutation
    for f in case.findings:
        if not f.evidence and f.confidence > 0.35:
            raise AssertionError(
                f"Finding for {f.claim_id} has confidence {f.confidence} > 0.35 despite zero evidence:\n{_summary(case)}"
            )


# --- the set -----------------------------------------------------------------

EVAL_CASES: list[EvalCase] = [
    EvalCase(
        id="obvious_flaw",
        raw_input=(
            "We're building a browser extension that auto-fills and submits student "
            "visa applications on government portals, so students never have to touch "
            "the official site."
        ),
        prop="a clearly disqualifying, checkable flaw lands broken/weakened",
        check=_catches_a_flaw,
    ),
    EvalCase(
        id="subtle_flaw",
        raw_input=(
            "We'll charge a flat $9/month for unlimited AI document review. Our costs "
            "are basically fixed, so every extra user is close to pure margin."
        ),
        prop="a flaw not stated in the input still gets surfaced by extraction + testing",
        check=_catches_a_flaw,
    ),
    EvalCase(
        id="misleading_assumption",
        raw_input=(
            "Teachers already spend hours grading, so they'll happily switch to our tool "
            "— it saves them time, and time saved is the only thing that drives adoption "
            "in schools."
        ),
        prop="an assumption that sounds true but isn't gets caught",
        check=_catches_a_flaw,
    ),
    EvalCase(
        id="calculator_app",
        raw_input="I want to build a calculator app for iOS.",
        prop="a sound, boring idea mostly survives — no manufactured objections",
        check=_mostly_survives,
    ),
    EvalCase(
        id="mixed_evidence",
        raw_input=(
            "We should go remote-first. Remote teams ship faster than co-located ones."
        ),
        prop="genuinely conflicting evidence lands unresolved rather than a forced verdict",
        check=_lands_unresolved,
    ),
    EvalCase(
        id="vague_input",
        raw_input="idk maybe an app for students?",
        prop="degenerate input completes the run instead of erroring mid-demo",
        check=_does_not_crash,
    ),
    EvalCase(
        id="dead_link_evidence",
        raw_input=(
            "We are launching an exclusive AI patent search tool that scrapes internal non-public "
            "filings from the proprietary portal at https://defunct-patents-internal-xyz-987654321.org/api."
        ),
        prop="unreachable or dead external sources degrade gracefully rather than crashing or asserting unsourced rejections",
        check=_dead_source_degrades,
    ),
    EvalCase(
        id="thin_evidence_scrutiny",
        raw_input=(
            "Our consumer countertop coffee roaster utilizes quantum tunneling micro-coils to "
            "achieve 99.8% thermal efficiency with zero heat dissipation."
        ),
        prop="an extraordinary physical claim with no verifiable mainstream scientific backing gets caught or weakened",
        check=_catches_a_flaw,
    ),
]
