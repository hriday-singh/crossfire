"""Owner: Dev A. Feasibility Test evaluator."""
from __future__ import annotations

from core.evaluators.builder import BuilderVerdict, run_builder


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
