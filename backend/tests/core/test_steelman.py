"""
Unit tests for the Steel Man persona (Supreme Adjudicator & Principal Solutions Architect).
Tests the 3 DNA axioms:
1. Strict Anti-Voting (Judge DNA)
2. Evidence Gating (Judge DNA)
3. Mandatory Mitigation (Steelman DNA - Break to Rebuild)
"""
from __future__ import annotations

import pytest

from core.models import Claim, ClaimStatus, EvidenceItem, Finding
from core.reconcile import (
    STEEL_MAN_PERSONA,
    STEEL_MAN_SYSTEM_PROMPT,
    SteelManVerdict,
    ReconcileVerdict,
    reconcile,
    apply_evidence_gate,
    apply_steelman_gate,
)


def _finding(evaluator: str, *, evidence=False, contradiction=None, confidence=0.6, reasoning="reasoning") -> Finding:
    return Finding(
        claim_id="claim-1",
        test_id=f"test-{evaluator}",
        evaluator=evaluator,
        result="result",
        evidence=(
            [
                EvidenceItem(
                    source_url="https://sec.gov/filing",
                    title="SEC 10-K",
                    snippet="Reported revenue was $1.2M, contradicting the $10M ARR claim.",
                    retrieved_at="2026-09-06T00:00:00Z",
                    stance="contradicts",
                )
            ]
            if evidence
            else []
        ),
        reasoning=reasoning,
        confidence=confidence,
        contradiction=contradiction,
    )


def test_persona_identifier():
    assert STEEL_MAN_PERSONA == "steel_man"


def test_steelman_system_prompt_contains_dna():
    prompt = STEEL_MAN_SYSTEM_PROMPT
    assert "Steel Man" in prompt
    assert "Supreme Adjudicator" in prompt
    assert "Principal Solutions Architect" in prompt
    assert "Anti-Voting" in prompt
    assert "Evidence Gating" in prompt
    assert "Mandatory Mitigation" in prompt
    assert "PHASE 1: ADJUDICATION" in prompt
    assert "PHASE 2: MITIGATION" in prompt
    assert "Break to Rebuild" in prompt


def test_steelman_verdict_tuple_unpacking():
    v = SteelManVerdict(
        status=ClaimStatus.WEAKENED,
        reasoning="Limited empirical validation.",
        fatal_flaw="Assumes 100% conversion rate.",
        salvaged_claim="Model assumes conservative 15% conversion rate.",
        tradeoff_acknowledged="Requires 6x larger top-of-funnel lead pipeline.",
    )
    # Tuple unpacking backward compatibility:
    st, rsn = v
    assert st == ClaimStatus.WEAKENED
    assert rsn == "Limited empirical validation."
    assert len(v) == 2
    assert v[0] == ClaimStatus.WEAKENED
    assert v[1] == "Limited empirical validation."
    # Access to Steel Man mitigation attributes:
    assert v.fatal_flaw == "Assumes 100% conversion rate."
    assert v.salvaged_claim == "Model assumes conservative 15% conversion rate."
    assert v.tradeoff_acknowledged == "Requires 6x larger top-of-funnel lead pipeline."


def test_reconcile_verdict_alias():
    assert ReconcileVerdict is SteelManVerdict


@pytest.mark.asyncio
async def test_reconcile_survived_clears_salvage_fields(fake_provider_factory, sample_claim, sample_finding):
    """PHASE 2 rule: If the claim is SURVIVED or UNRESOLVED, leave salvage fields null."""
    provider = fake_provider_factory(
        responses=[
            SteelManVerdict(
                status=ClaimStatus.SURVIVED,
                reasoning="Empirical data corroborates statement.",
                fatal_flaw="Spurious flaw",
                salvaged_claim="Should be wiped",
                tradeoff_acknowledged="Should be wiped",
            )
        ]
    )
    verdict = await reconcile(sample_claim, [sample_finding], provider)
    assert verdict.status == ClaimStatus.SURVIVED
    assert verdict.reasoning == "Empirical data corroborates statement."
    # Programmatic enforcement: salvage fields MUST be None for SURVIVED
    assert verdict.fatal_flaw is None
    assert verdict.salvaged_claim is None
    assert verdict.tradeoff_acknowledged is None


@pytest.mark.asyncio
async def test_reconcile_unresolved_clears_salvage_fields(fake_provider_factory, sample_claim, conflicting_findings):
    """PHASE 2 rule: If the claim is SURVIVED or UNRESOLVED, leave salvage fields null."""
    provider = fake_provider_factory(
        responses=[
            SteelManVerdict(
                status=ClaimStatus.UNRESOLVED,
                reasoning="Conflicting data with equal weight.",
                fatal_flaw="Unclear",
                salvaged_claim="Unclear",
                tradeoff_acknowledged="Unclear",
            )
        ]
    )
    verdict = await reconcile(sample_claim, conflicting_findings, provider)
    assert verdict.status == ClaimStatus.UNRESOLVED
    assert verdict.fatal_flaw is None
    assert verdict.salvaged_claim is None
    assert verdict.tradeoff_acknowledged is None


@pytest.mark.asyncio
async def test_reconcile_weakened_retains_break_to_rebuild(fake_provider_factory, sample_claim, sample_finding):
    """PHASE 2 rule: If WEAKENED or BROKEN, execute Break to Rebuild protocol."""
    provider = fake_provider_factory(
        responses=[
            SteelManVerdict(
                status=ClaimStatus.WEAKENED,
                reasoning="Market size estimate exceeds total addressable population.",
                fatal_flaw="TAM calculation includes global market without local licensing.",
                salvaged_claim="Target US domestic market of $250M first under state licensing.",
                tradeoff_acknowledged="Initial revenue ceiling capped at $10M for first 24 months.",
            )
        ]
    )
    verdict = await reconcile(sample_claim, [sample_finding], provider)
    assert verdict.status == ClaimStatus.WEAKENED
    assert verdict.fatal_flaw == "TAM calculation includes global market without local licensing."
    assert verdict.salvaged_claim == "Target US domestic market of $250M first under state licensing."
    assert verdict.tradeoff_acknowledged == "Initial revenue ceiling capped at $10M for first 24 months."


@pytest.mark.asyncio
async def test_reconcile_broken_immutable_law_leaves_salvage_null(fake_provider_factory, sample_claim):
    """Exception rule: If claim violates immutable laws of physics/math/federal law, leave salvage fields null."""
    provider = fake_provider_factory(
        responses=[
            SteelManVerdict(
                status=ClaimStatus.BROKEN,
                reasoning="Violates second law of thermodynamics (perpetual energy output exceeds input).",
                fatal_flaw="Thermodynamic impossibility.",
                salvaged_claim=None,
                tradeoff_acknowledged=None,
            )
        ]
    )
    verdict = await reconcile(sample_claim, [], provider)
    assert verdict.status == ClaimStatus.BROKEN
    assert verdict.salvaged_claim is None
    assert verdict.tradeoff_acknowledged is None


def test_apply_steelman_gate_downgrades_broken_without_evidence():
    """DNA Axiom 2: Absence of evidence is not refutation.
    If panel attacks claim without grounded citations, downgrade to weakened programmatically.
    """
    verdict = SteelManVerdict(
        status=ClaimStatus.BROKEN,
        reasoning="Refuted by speculative builder concerns.",
        fatal_flaw="Assumes easy integration.",
        salvaged_claim="Use standard REST API adapter.",
        tradeoff_acknowledged="Higher latency by 50ms.",
    )
    findings = [_finding("builder", contradiction="Integration is too complex")]
    gated = apply_steelman_gate(verdict, findings)
    assert gated.status == ClaimStatus.WEAKENED
    assert "Downgraded from broken to weakened" in gated.reasoning
    # Mitigation fields remain valid for weakened claim
    assert gated.fatal_flaw == "Assumes easy integration."
    assert gated.salvaged_claim == "Use standard REST API adapter."
    assert gated.tradeoff_acknowledged == "Higher latency by 50ms."


def test_apply_steelman_gate_clears_salvage_if_unresolved():
    verdict = SteelManVerdict(
        status=ClaimStatus.UNRESOLVED,
        reasoning="Unresolved claim.",
        fatal_flaw="Some flaw",
        salvaged_claim="Some salvage",
        tradeoff_acknowledged="Some tradeoff",
    )
    gated = apply_steelman_gate(verdict, [])
    assert gated.status == ClaimStatus.UNRESOLVED
    assert gated.fatal_flaw is None
    assert gated.salvaged_claim is None
    assert gated.tradeoff_acknowledged is None


@pytest.mark.asyncio
async def test_pipeline_steelman_salvage_integration(sample_case):
    """Verifies that run_pipeline threads Steel Man salvage fields and emits them."""
    import events
    import store
    from core.loop import run_pipeline
    from tests.core.test_loop import SchemaProvider

    store.set(sample_case)
    events.reset()

    await run_pipeline(sample_case.id, provider=SchemaProvider())
    received_events = events.get_history(sample_case.id)

    case = store.get(sample_case.id)
    assert case.status == "done"

    # Verify claim has Steelman mitigation fields
    claim = case.claims[0]
    assert claim.fatal_flaw == "Unverified adoption rate."
    assert claim.salvaged_claim == "Pilot with 5 enterprise customers before full rollout."
    assert claim.tradeoff_acknowledged == "Slower initial revenue growth."

    # Verify consequence has Steelman mitigation fields
    consequence = case.consequences[0]
    assert consequence.fatal_flaw == "Unverified adoption rate."
    assert consequence.salvaged_claim == "Pilot with 5 enterprise customers before full rollout."
    assert consequence.tradeoff_acknowledged == "Slower initial revenue growth."

    # Verify verdict_ready event carried the salvage fields
    verdict_events = [e for e in received_events if e.get("event") == "verdict_ready"]
    assert len(verdict_events) == len(case.claims)
    first_verdict_data = verdict_events[0]["data"]
    assert first_verdict_data["fatal_flaw"] == "Unverified adoption rate."
    assert first_verdict_data["salvaged_claim"] == "Pilot with 5 enterprise customers before full rollout."
    assert first_verdict_data["tradeoff_acknowledged"] == "Slower initial revenue growth."

    # Verify activity stream emitted Steelman tag
    activity_events = [e for e in received_events if e.get("event") == "activity"]
    steelman_activities = [e for e in activity_events if e["data"].get("tag") == "Steelman"]
    assert len(steelman_activities) >= 1


@pytest.mark.asyncio
async def test_reconcile_emits_verdict_ready_progressively(sample_case):
    import asyncio
    import events
    import store
    from core.loop import run_pipeline, ReconcileVerdict
    from core.models import Claim, ClaimStatus
    from tests.core.test_loop import SchemaProvider

    c1 = Claim(id="c1", statement="Fast claim")
    c2 = Claim(id="c2", statement="Slow claim")
    sample_case.claims = [c1, c2]
    store.set(sample_case)
    events.reset()

    c1_emitted_while_c2_running = False

    async def slow_reconcile_gen(messages):
        nonlocal c1_emitted_while_c2_running
        prompt_text = str(messages)
        if "Slow claim" in prompt_text:
            await asyncio.sleep(0.05)
            history = events.get_history(sample_case.id)
            c1_events = [
                e for e in history
                if e.get("event") == "verdict_ready" and e.get("data", {}).get("claim_id") == "c1"
            ]
            if c1_events:
                c1_emitted_while_c2_running = True
        return ReconcileVerdict(
            status=ClaimStatus.SURVIVED,
            reasoning="Reasoning",
            salvaged_claim="Salvaged",
            fatal_flaw="Flaw",
            tradeoff_acknowledged="Tradeoff",
        )

    provider = SchemaProvider()
    original_generate = provider.generate

    async def custom_generate(system_prompt, messages, response_schema=None):
        if getattr(response_schema, "__name__", None) in ("SteelManVerdict", "ReconcileVerdict"):
            return await slow_reconcile_gen(messages)
        return await original_generate(system_prompt, messages, response_schema=response_schema)

    provider.generate = custom_generate

    await run_pipeline(sample_case.id, provider=provider)
    history = events.get_history(sample_case.id)
    verdict_events = [e for e in history if e.get("event") == "verdict_ready"]
    assert len(verdict_events) == 2
    assert c1_emitted_while_c2_running, "verdict_ready for c1 should emit before c2 completes"


