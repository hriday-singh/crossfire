"""
Owner: Dev A. Covers the refinement-plan behaviours: the evidence gate on
`broken`, no silent evaluator loss, finding order, and case-level synthesis.

Everything here is deliberately written against non-technical decisions too —
the pipeline has to behave identically whatever the subject is.
"""
from __future__ import annotations

import pytest

from core.models import (
    Case,
    Claim,
    ClaimStatus,
    DecisionConsequence,
    EvidenceItem,
    Finding,
    TestPlanItem,
)


def _finding(evaluator: str, *, evidence=False, contradiction=None, confidence=0.6) -> Finding:
    return Finding(
        claim_id="claim-1",
        test_id=f"test-{evaluator}",
        evaluator=evaluator,
        result="result",
        evidence=(
            [
                EvidenceItem(
                    source_url="https://example.gov/rule",
                    title="The rule",
                    snippet="The rule says otherwise.",
                    retrieved_at="2026-09-06T00:00:00Z",
                )
            ]
            if evidence
            else []
        ),
        reasoning="reasoning",
        confidence=confidence,
        contradiction=contradiction,
    )


# --- Stage 1a: only a sourced contradiction can break a claim ---


def test_broken_without_evidence_is_downgraded_to_weakened():
    """The college run went 5/5 broken while every finding said 'unsupported'.
    Absence of evidence is not refutation."""
    from core.loop import apply_evidence_gate

    findings = [_finding("devils_advocate", contradiction="Nobody would do this")]
    status, reasoning = apply_evidence_gate(ClaimStatus.BROKEN, "Refuted.", findings)

    assert status is ClaimStatus.WEAKENED
    assert "traceable to a source" in reasoning


def test_broken_with_a_sourced_contradiction_stands():
    from core.loop import apply_evidence_gate

    findings = [
        _finding("devils_advocate", contradiction="Reasoning only"),
        _finding("receipts", evidence=True, contradiction="The published rule forbids it"),
    ]
    status, reasoning = apply_evidence_gate(ClaimStatus.BROKEN, "Refuted by the rule.", findings)

    assert status is ClaimStatus.BROKEN
    assert reasoning == "Refuted by the rule."


def test_evidence_without_a_contradiction_cannot_break():
    """Sources attached to a finding that never contradicted anything are not a refutation."""
    from core.loop import apply_evidence_gate

    status, _ = apply_evidence_gate(
        ClaimStatus.BROKEN, "Refuted.", [_finding("receipts", evidence=True)]
    )
    assert status is ClaimStatus.WEAKENED


@pytest.mark.parametrize(
    "status", [ClaimStatus.SURVIVED, ClaimStatus.WEAKENED, ClaimStatus.UNRESOLVED]
)
def test_gate_leaves_every_other_verdict_alone(status):
    from core.loop import apply_evidence_gate

    got, reasoning = apply_evidence_gate(status, "As judged.", [_finding("devils_advocate")])
    assert got is status
    assert reasoning == "As judged."


# --- Stage 3: the drawer leads with what moved the verdict ---


def test_rank_findings_leads_with_the_sourced_contradiction():
    from core.loop import rank_findings

    unsourced = _finding("operator", contradiction="Procurement freeze", confidence=0.9)
    plain = _finding("builder", confidence=0.95)
    decisive = _finding("receipts", evidence=True, contradiction="The rule forbids it", confidence=0.4)

    ranked = rank_findings([plain, unsourced, decisive])
    assert ranked[0] is decisive
    assert ranked[1] is unsourced


# --- Stage 1c: a failed evaluator is visible, never dropped ---


@pytest.mark.asyncio
async def test_failed_evaluator_becomes_a_degraded_finding(monkeypatch, sample_case):
    """Observed live: a test emitted test_started and no finding ever arrived,
    so the frontend row stayed pinned open forever."""
    import core.loop as loop

    async def exploding_dispatch(item, case, provider):
        if item.failure_mode == "evidence":
            raise RuntimeError("evaluator exploded")
        return Finding(
            claim_id=item.target_claim,
            test_id=item.id,
            evaluator=item.failure_mode,
            result="ok",
            reasoning="fine",
            confidence=0.7,
        )

    monkeypatch.setattr(loop, "dispatch", exploding_dispatch)
    plan = loop.build_test_plan(sample_case)
    findings = await loop.run_evaluators(sample_case, plan, provider=None)

    assert len(findings) == len(plan)  # nothing dropped
    degraded = [f for f in findings if f.confidence is None]
    assert degraded, "a failed evaluator must still produce a finding"
    assert degraded[0].evaluator == "receipts"
    assert degraded[0].result == "System Error / Timeout"
    assert "RuntimeError" in degraded[0].reasoning
    assert degraded[0].evidence == []  # and so it can never break a claim



@pytest.mark.asyncio
async def test_evaluator_timeout_degrades_instead_of_hanging(monkeypatch, sample_case):
    import asyncio

    import core.loop as loop

    async def hanging_dispatch(item, case, provider):
        await asyncio.sleep(5)

    monkeypatch.setattr(loop, "dispatch", hanging_dispatch)
    monkeypatch.setattr(
        loop, "get_settings", lambda: type("S", (), {"evaluator_concurrency": 4, "evaluator_timeout_seconds": 0.05})()
    )

    plan = loop.build_test_plan(sample_case, panel=False)
    findings = await loop.run_evaluators(sample_case, plan, provider=None)

    assert len(findings) == len(plan)
    assert all(f.confidence is None and f.result == "System Error / Timeout" for f in findings)


@pytest.mark.asyncio
async def test_evaluator_fan_out_is_capped(monkeypatch, sample_case):
    """~35 concurrent LLM calls at once was the measured fan-out."""
    import asyncio

    import core.loop as loop

    live = {"now": 0, "peak": 0}

    async def counting_dispatch(item, case, provider):
        live["now"] += 1
        live["peak"] = max(live["peak"], live["now"])
        await asyncio.sleep(0)
        live["now"] -= 1
        return Finding(
            claim_id=item.target_claim,
            test_id=item.id,
            evaluator=item.failure_mode,
            result="ok",
            reasoning="fine",
            confidence=0.7,
        )

    monkeypatch.setattr(loop, "dispatch", counting_dispatch)
    monkeypatch.setattr(
        loop, "get_settings", lambda: type("S", (), {"evaluator_concurrency": 2, "evaluator_timeout_seconds": 30})()
    )

    await loop.run_evaluators(sample_case, loop.build_test_plan(sample_case), provider=None)
    assert live["peak"] <= 2


# --- Stage 4: one case-level verdict, not N repeated ones ---


@pytest.mark.asyncio
async def test_case_verdict_merges_and_dedupes_actions(fake_provider_factory):
    """The college run produced five separate 'pivot to human-in-the-loop'."""
    from core.loop import CaseVerdictOutput, NextActionOutput, synthesize_case_verdict

    case = Case(
        id="case-v",
        raw_input="Whether to move my mother into assisted living this spring",
        claims=[
            Claim(id="a", statement="She cannot manage the stairs", load_bearing=True, status=ClaimStatus.BROKEN),
            Claim(id="b", statement="The facility has a spring opening", load_bearing=True, status=ClaimStatus.WEAKENED),
            Claim(id="c", statement="The cost is covered", status=ClaimStatus.SURVIVED),
        ],
    )
    provider = fake_provider_factory(
        [
            CaseVerdictOutput(
                decision_state="hold",
                summary="The stairs premise did not survive.",
                next_actions=[
                    NextActionOutput(
                        action="Book an occupational-therapy home assessment.",
                        claim_ids=["a", "ghost-claim"],
                    ),
                    NextActionOutput(
                        action="book an occupational-therapy home assessment.",
                        claim_ids=["a"],
                    ),
                    NextActionOutput(
                        action="Get the facility's waitlist position in writing.",
                        claim_ids=[],
                    ),
                ],
            )
        ]
    )

    verdict = await synthesize_case_verdict(case, provider)

    assert verdict.decision_state == "hold"
    assert verdict.broken == ["a"]
    assert verdict.unproven == ["b"]
    assert verdict.survived == ["c"]
    assert len(verdict.next_actions) == 2  # the near-duplicate is merged away
    # Anchored to a real claim; the hallucinated id is dropped, not rendered as a dead link.
    assert verdict.next_actions[0].claim_ids == ["a"]
    assert verdict.next_actions[1].claim_ids == []


@pytest.mark.asyncio
async def test_case_verdict_fallback_actions_carry_their_claim(sample_case):
    """When synthesis dies, per-claim next_validation still arrives anchored."""
    from core.loop import synthesize_case_verdict

    class DeadProvider:
        async def generate(self, system_prompt, messages, response_schema=None):
            raise RuntimeError("provider is down")

    sample_case.claims[0].status = ClaimStatus.BROKEN
    sample_case.consequences = [
        DecisionConsequence(
            claim_id=sample_case.claims[0].id,
            impact="high",
            recommended_change="Rewrite the premise.",
            next_validation="Get the containment rate in writing.",
        )
    ]

    verdict = await synthesize_case_verdict(sample_case, DeadProvider())
    assert verdict.next_actions[0].action == "Get the containment rate in writing."
    assert verdict.next_actions[0].claim_ids == [sample_case.claims[0].id]


@pytest.mark.asyncio
async def test_case_verdict_falls_back_to_a_derived_state(sample_case):
    from core.loop import synthesize_case_verdict

    class DeadProvider:
        async def generate(self, system_prompt, messages, response_schema=None):
            raise RuntimeError("provider is down")

    sample_case.claims[0].status = ClaimStatus.BROKEN
    sample_case.claims[1].status = ClaimStatus.SURVIVED

    verdict = await synthesize_case_verdict(sample_case, DeadProvider())
    assert verdict.decision_state == "drop"  # a load-bearing claim was refuted
    assert verdict.summary


@pytest.mark.asyncio
async def test_case_verdict_ignores_an_invalid_state(sample_case, fake_provider_factory):
    from core.loop import CaseVerdictOutput, synthesize_case_verdict

    sample_case.claims[0].status = ClaimStatus.WEAKENED
    sample_case.claims[1].status = ClaimStatus.SURVIVED
    provider = fake_provider_factory(
        [CaseVerdictOutput(decision_state="vibes", summary="Fine.", next_actions=[])]
    )

    verdict = await synthesize_case_verdict(sample_case, provider)
    assert verdict.decision_state == "proceed_with_changes"


# --- Stage 3: generated output is bounded, not truncated at display ---


def test_reasoning_is_clamped_to_three_sentences():
    from core.textutil import clamp_sentences, one_line

    text = "One. Two. Three. Four. Five."
    assert clamp_sentences(text) == "One. Two. Three."
    assert one_line("a" * 200).endswith("…")
    assert len(one_line("a" * 200)) <= 141


@pytest.mark.asyncio
async def test_dispatch_takes_only_the_contract_triple(sample_case, monkeypatch):
    """Contract §4: dispatch has no compensating branch for argument-order drift."""
    import core.evaluators as evaluators

    seen: list[tuple] = []

    async def recording(item, case, provider):
        seen.append((item, case, provider))
        return Finding(
            claim_id=item.target_claim, test_id=item.id, evaluator="receipts",
            result="ok", reasoning="fine", confidence=0.5,
        )

    monkeypatch.setitem(evaluators._ROUTES, "evidence", recording)
    item = TestPlanItem(id="t1", target_claim="claim-1", failure_mode="evidence", objective="obj")

    finding = await evaluators.dispatch(item, sample_case, provider="p")
    assert seen == [(item, sample_case, "p")]
    assert finding.claim_id == "claim-1"
