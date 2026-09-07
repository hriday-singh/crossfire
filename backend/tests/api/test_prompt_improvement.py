from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import store
from api.routes import get_llm_provider
from api.schemas import AppliedSalvage
from core.models import Case, Claim, ClaimStatus
from core.reformulate import (
    ReformulatedPromptOutput,
    deterministic_prompt_replacement,
    reformulate_prompt_with_steelman,
)
from main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_deterministic_prompt_replacement_exact_match():
    original = "We will store customer data in unencrypted Redis cache."
    salvages = [
        AppliedSalvage(
            claim_id="c1",
            original_statement="unencrypted Redis cache",
            salvaged_claim="encrypted Redis Enterprise cluster",
        )
    ]
    result = deterministic_prompt_replacement(original, salvages)
    assert "encrypted Redis Enterprise cluster" in result
    assert "unencrypted Redis cache" not in result


def test_deterministic_prompt_replacement_sentence_overlap():
    original = (
        "We plan to build a financial tool. "
        "All customer records will be cached without encryption for sub-millisecond latency. "
        "Users will access via mobile app."
    )
    salvages = [
        AppliedSalvage(
            claim_id="c1",
            original_statement="Customer records are cached without encryption for sub-millisecond latency",
            salvaged_claim="Customer records are stored with envelope encryption using AWS KMS and TLS 1.3",
        )
    ]
    result = deterministic_prompt_replacement(original, salvages)
    assert "Customer records are stored with envelope encryption" in result
    assert "cached without encryption" not in result
    assert "We plan to build a financial tool" in result
    assert "Users will access via mobile app" in result


def test_deterministic_prompt_replacement_unmatched_fallback():
    original = "Deploying automated trading bot."
    salvages = [
        AppliedSalvage(
            claim_id="c1",
            original_statement="Completely unrelated premise not in original text",
            salvaged_claim="Implement circuit breaker thresholds at 5% drawdown",
        )
    ]
    result = deterministic_prompt_replacement(original, salvages)
    assert "Deploying automated trading bot" in result
    assert "Implement circuit breaker thresholds at 5% drawdown" in result
    assert "[Steel Man Adjustments]:" in result


@pytest.mark.asyncio
async def test_improve_prompt_endpoint_success(client, fake_provider_factory):
    case = Case(
        id="case-improve-test-1",
        raw_input="We will launch an AI support agent that answers 100% of user queries with zero human intervention.",
        status="done",
        claims=[
            Claim(
                id="claim-1",
                statement="AI answers 100% of queries with zero human intervention",
                status=ClaimStatus.BROKEN,
                salvaged_claim="AI handles tier-1 queries with automated escalation to human agents for edge cases",
            ),
            Claim(
                id="claim-2",
                statement="Users prefer chat over phone",
                status=ClaimStatus.SURVIVED,
            ),
        ],
    )
    store.set(case)

    provider = fake_provider_factory(
        responses=[
            ReformulatedPromptOutput(
                improved_prompt="We will launch an AI support agent that handles tier-1 queries with automated escalation to human agents for edge cases."
            )
        ]
    )
    app.dependency_overrides[get_llm_provider] = lambda: provider

    try:
        res = client.post(
            f"/cases/{case.id}/improve_prompt",
            json={"selected_claim_ids": ["claim-1"]},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["case_id"] == case.id
        assert data["original_prompt"] == case.raw_input
        assert (
            data["improved_prompt"]
            == "We will launch an AI support agent that handles tier-1 queries with automated escalation to human agents for edge cases."
        )
        assert len(data["applied_salvages"]) == 1
        assert data["applied_salvages"][0]["claim_id"] == "claim-1"
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_improve_prompt_endpoint_404(client):
    res = client.post(
        "/cases/non-existent-case-id/improve_prompt",
        json={"selected_claim_ids": ["c1"]},
    )
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_improve_prompt_endpoint_empty_selection_returns_original(client):
    case = Case(
        id="case-improve-test-empty",
        raw_input="Autonomous delivery drones in suburban areas.",
        status="done",
        claims=[
            Claim(
                id="claim-1",
                statement="Drones operate autonomously",
                status=ClaimStatus.BROKEN,
                salvaged_claim="Drones operate with human remote supervisors",
            )
        ],
    )
    store.set(case)

    res = client.post(
        f"/cases/{case.id}/improve_prompt",
        json={"selected_claim_ids": []},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["improved_prompt"] == case.raw_input
    assert len(data["applied_salvages"]) == 0
