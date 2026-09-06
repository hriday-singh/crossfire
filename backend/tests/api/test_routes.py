"""
Owner: Dev C. See docs/04-dev-C-api-sse-evaluators.md. Uses FastAPI's
TestClient (needs `httpx` installed — it's a TestClient dependency).
"""
from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app

    return TestClient(app)


def test_post_cases_returns_awaiting_confirmation_case(client, fake_provider_factory):
    from api.routes import get_llm_provider
    from core.loop import ExtractedClaims
    from main import app

    provider = fake_provider_factory(
        responses=[
            ExtractedClaims(
                statements=["Students will trust an AI submitting applications on their behalf"]
            )
        ]
    )
    app.dependency_overrides[get_llm_provider] = lambda: provider

    try:
        response = client.post(
            "/cases",
            json={"raw_input": "I want to build an AI for college applications"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "awaiting_confirmation"
        assert len(body["claims"]) > 0
        assert body["claims"][0]["statement"] == "Students will trust an AI submitting applications on their behalf"
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_confirm_returns_202_without_blocking(client, monkeypatch, sample_case):
    import time
    import store
    from core.loop import handle_confirm

    store.set(sample_case)

    async def slow_pipeline(case_id):
        await asyncio.sleep(5)

    # Goes through the real handle_confirm — the scheduling machinery (and the
    # strong task reference that stops the run being garbage-collected) is what
    # keeps this non-blocking, so stubbing it out would test nothing.
    async def confirm_with_slow_pipeline(case_id):
        await handle_confirm(case_id, run_pipeline=slow_pipeline)

    monkeypatch.setattr("api.routes.handle_confirm", confirm_with_slow_pipeline)

    start = time.monotonic()
    response = client.post(
        f"/cases/{sample_case.id}/confirm",
        json={"claims": [c.model_dump() for c in sample_case.claims]},
    )
    elapsed = time.monotonic() - start

    assert response.status_code == 202
    assert elapsed < 1.0  # proves it didn't await the 5-second pipeline
    body = response.json()
    assert body["status"] == "testing"


def test_get_case_returns_full_case_after_done(client, sample_case, sample_finding):
    import store
    from core.models import DecisionConsequence

    done_case = sample_case.model_copy(
        update={
            "status": "done",
            "findings": [sample_finding],
            "consequences": [
                DecisionConsequence(
                    claim_id=sample_case.claims[0].id,
                    impact="high",
                    recommended_change="Test directly",
                    next_validation="Run survey",
                    verdict_reasoning="Reconciled as survived",
                )
            ],
        }
    )
    store.set(done_case)

    response = client.get(f"/cases/{done_case.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "done"
    assert len(body["findings"]) == 1
    assert len(body["consequences"]) == 1
    assert body["findings"][0]["evaluator"] == "receipts"
    assert body["consequences"][0]["impact"] == "high"


def test_stream_endpoint_emits_sse_events_in_documented_order(client, sample_case):
    import events
    import store

    store.set(sample_case)
    # The real transport the pipeline writes to. Feeding `events` rather than a
    # queue owned by the route is the point of the test: if the endpoint ever
    # reads from a different queue again, this goes red instead of passing
    # against a registry nothing publishes to.
    queue = events.get_queue(sample_case.id)

    def publish(event: str, data: dict) -> None:
        """Same payload shape events.publish() puts on the queue."""
        queue.put_nowait({"event": event, "data": data})

    # Documented SSE events from docs/00-CONTRACTS.md §3
    publish("claim_map_ready", {"claims": [{"id": "c1", "statement": "test claim"}]})
    publish("awaiting_confirmation", {})
    publish(
        "test_started",
        {"test_id": "t1", "target_claim_id": "c1", "evaluator": "devils_advocate"},
    )
    publish(
        "finding_ready",
        {
            "finding": {
                "claim_id": "c1",
                "test_id": "t1",
                "evaluator": "devils_advocate",
                "result": "Assumption challenged",
                "evidence": [],
                "reasoning": "Unproven precedent",
                "confidence": 0.7,
            },
            "target_claim_id": "c1",
        },
    )
    publish(
        "verdict_ready",
        {"claim_id": "c1", "status": "survived", "verdict_reasoning": "Sufficient support"},
    )
    publish(
        "consequence_ready",
        {
            "consequence": {
                "claim_id": "c1",
                "impact": "low",
                "recommended_change": "Proceed",
            }
        },
    )
    publish("run_complete", {"case_id": sample_case.id})

    response = client.get(f"/cases/{sample_case.id}/stream")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    content = response.text
    events = [
        "event: claim_map_ready",
        "event: awaiting_confirmation",
        "event: test_started",
        "event: finding_ready",
        "event: verdict_ready",
        "event: consequence_ready",
        "event: run_complete",
    ]
    last_idx = -1
    for ev in events:
        idx = content.find(ev)
        assert idx != -1, f"Missing event: {ev} in response: {content}"
        assert idx > last_idx, f"Event {ev} occurred out of order"
        last_idx = idx


def test_confirm_rejects_when_case_not_in_awaiting_confirmation(client, sample_case):
    import store

    # Case in testing status
    sample_case.status = "testing"
    store.set(sample_case)

    response = client.post(f"/cases/{sample_case.id}/confirm", json={})
    assert response.status_code == 400
    assert "Cannot confirm" in response.json()["detail"]

    # Case in done status
    sample_case.status = "done"
    store.set(sample_case)

    response = client.post(f"/cases/{sample_case.id}/confirm", json={})
    assert response.status_code == 400
    assert "Cannot confirm" in response.json()["detail"]

