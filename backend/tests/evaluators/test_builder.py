"""Owner: Dev A. Feasibility Test evaluator."""
from __future__ import annotations

from core.evaluators.builder import (
    BUILDER_SYSTEM_PROMPT,
    _SYSTEM_PROMPT,
    BuilderVerdict,
    run_builder,
)
from core.textutil import SPECIFICITY_RULE


async def test_run_builder_maps_verdict_onto_finding(
    fake_provider_factory, sample_case, sample_test_plan_item
):
    provider = fake_provider_factory(
        [
            BuilderVerdict(
                result="Buildable, but the trust surface is the hard part",
                reasoning="Application portals have no public write API; submission needs scraping",
                confidence=0.6,
                blocker="No sanctioned write path into the application portals",
            )
        ]
    )

    finding = await run_builder(sample_test_plan_item, sample_case, provider)

    assert finding.evaluator == "builder"
    assert finding.claim_id == sample_test_plan_item.target_claim
    assert finding.test_id == sample_test_plan_item.id
    assert finding.contradiction == "No sanctioned write path into the application portals"
    assert finding.evidence == []  # feasibility reasoning never carries sources
    assert finding.confidence == 0.6
    # the claim statement, not just the objective, must reach the model
    assert "Students will trust" in provider.calls[0]["messages"][0]["content"]


async def test_run_builder_no_blocker_leaves_contradiction_none(
    fake_provider_factory, sample_case, sample_test_plan_item
):
    provider = fake_provider_factory(
        [
            BuilderVerdict(
                result="Straightforward to build",
                reasoning="Off-the-shelf components cover every step",
                confidence=0.85,
                blocker=None,
            )
        ]
    )

    finding = await run_builder(sample_test_plan_item, sample_case, provider)

    assert finding.contradiction is None


async def test_run_builder_falls_back_to_objective_for_unknown_claim(
    fake_provider_factory, sample_case, sample_test_plan_item
):
    """dispatch() can hand over an item whose target_claim was dropped at
    confirmation — that must not raise, it must still produce a Finding."""
    orphan = sample_test_plan_item.model_copy(update={"target_claim": "claim-gone"})
    provider = fake_provider_factory(
        [BuilderVerdict(result="r", reasoning="why", confidence=0.5, blocker=None)]
    )

    finding = await run_builder(orphan, sample_case, provider)

    assert finding.claim_id == "claim-gone"
    assert sample_test_plan_item.objective in provider.calls[0]["messages"][0]["content"]


def test_builder_system_prompt_contains_technical_constraints():
    assert BUILDER_SYSTEM_PROMPT == _SYSTEM_PROMPT
    assert "MVP vs. Scale Bifurcation" in BUILDER_SYSTEM_PROMPT
    assert "[Day-1 Blocker]" in BUILDER_SYSTEM_PROMPT
    assert "[Day-1000 Blocker]" in BUILDER_SYSTEM_PROMPT
    assert "Lightweight Threat Modeling" in BUILDER_SYSTEM_PROMPT
    assert "data exposure" in BUILDER_SYSTEM_PROMPT
    assert "privilege escalation" in BUILDER_SYSTEM_PROMPT
    assert "spoofing" in BUILDER_SYSTEM_PROMPT
    assert "Calibrated Confidence Scoring" in BUILDER_SYSTEM_PROMPT
    assert "0.9 to 1.0" in BUILDER_SYSTEM_PROMPT
    assert "0.7 to 0.8" in BUILDER_SYSTEM_PROMPT
    assert "0.4 to 0.6" in BUILDER_SYSTEM_PROMPT
    assert "0.1 to 0.3" in BUILDER_SYSTEM_PROMPT
    assert "Do not utilize quantitative token or latency estimations" in BUILDER_SYSTEM_PROMPT


async def test_run_builder_passes_enhanced_prompt_and_constraints_to_provider(
    fake_provider_factory, sample_case, sample_test_plan_item
):
    provider = fake_provider_factory(
        [
            BuilderVerdict(
                result="Day-1 viable; scale requires architectural changes",
                reasoning="Off-the-shelf infra handles initial users. Threat model flags spoofing risk on OAuth callback.",
                confidence=0.8,
                blocker="[Day-1000 Blocker] High-frequency state sync requires distributed consensus",
            )
        ]
    )

    finding = await run_builder(sample_test_plan_item, sample_case, provider)

    assert finding.evaluator == "builder"
    assert finding.contradiction == "[Day-1000 Blocker] High-frequency state sync requires distributed consensus"
    assert finding.confidence == 0.8

    # Verify provider call received enhanced prompt and constraints
    call = provider.calls[0]
    assert BUILDER_SYSTEM_PROMPT in call["system_prompt"]
    assert SPECIFICITY_RULE in call["system_prompt"]
    assert "MVP vs. Scale Bifurcation" in call["messages"][0]["content"]
    assert "Lightweight Threat Modeling" in call["messages"][0]["content"]
    assert "Calibrated Confidence Scoring" in call["messages"][0]["content"]

