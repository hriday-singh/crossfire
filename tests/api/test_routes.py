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
    """SKELETON:
    from main import app
    return TestClient(app)
    """
    pytest.skip("fill in once main.py + api/routes.py exist")


def test_post_cases_returns_awaiting_confirmation_case(client):
    """SKELETON:
    response = client.post("/cases", json={"raw_input": "I want to build an AI for college applications"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "awaiting_confirmation"
    assert len(body["claims"]) > 0
    """
    pass


def test_confirm_returns_202_without_blocking(client, monkeypatch):
    """The specific race-condition fix from backend spec §4: /confirm must
    return fast even if run_pipeline() is slow, because it should be
    fire-and-forget via asyncio.create_task, not awaited.
    SKELETON:
    async def slow_pipeline(case_id):
        await asyncio.sleep(5)
    monkeypatch.setattr("api.routes.run_pipeline", slow_pipeline)

    import time
    start = time.monotonic()
    response = client.post("/cases/case-1/confirm", json={"claims": [...]})
    elapsed = time.monotonic() - start

    assert response.status_code == 202
    assert elapsed < 1.0  # proves it didn't await the 5-second pipeline
    """
    pass


def test_get_case_returns_full_case_after_done(client):
    """SKELETON: seed the store with a Case in status='done' carrying findings
    and consequences, then assert GET /cases/{id} returns all of it — this is
    what the evidence drawer reads from.
    """
    pass


def test_stream_endpoint_emits_sse_events_in_documented_order(client):
    """See docs/00-CONTRACTS.md §3 for the exact event list and §4 for why the
    stream has to be readable before /confirm returns. Feed a fake queue with
    events in order and assert the SSE response body contains them as
    `event: ...` lines in that order, ending with run_complete.
    """
    pass


def test_confirm_rejects_when_case_not_in_awaiting_confirmation(client):
    """The claim-confirmation checkpoint (direction docs §11) is a real gate
    in the state machine, not client-side theater — confirming a case that's
    already `testing` or `done` should be rejected, not silently re-run.
    """
    pass
