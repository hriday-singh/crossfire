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


def test_post_cases_with_ingestion_context(client, fake_provider_factory):
    from api.routes import get_llm_provider
    from core.loop import ExtractedClaims
    from main import app

    provider = fake_provider_factory(
        responses=[ExtractedClaims(statements=["Claim with document context"])]
    )
    app.dependency_overrides[get_llm_provider] = lambda: provider

    try:
        response = client.post(
            "/cases",
            json={
                "raw_input": "Launch autonomous grading platform",
                "context": "Ingested PDF: University policy requires human supervisor for all grades",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["context"] == "Ingested PDF: University policy requires human supervisor for all grades"
        assert len(body["claims"]) == 1
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_post_cases_validation_error_on_empty_input(client):
    response = client.post("/cases", json={"raw_input": ""})
    assert response.status_code == 422


def test_confirm_updates_case_with_user_edited_claims(client, monkeypatch, sample_case):
    import store
    from core.models import Claim

    store.set(sample_case)

    async def fake_confirm(case_id):
        pass

    monkeypatch.setattr("api.routes.handle_confirm", fake_confirm)

    edited_claim = Claim(id="c-edited", statement="User edited this specific claim assertion")
    response = client.post(
        f"/cases/{sample_case.id}/confirm",
        json={"claims": [edited_claim.model_dump()]},
    )
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "testing"
    assert body["case_id"] == sample_case.id

    saved_case = store.get(sample_case.id)
    assert saved_case is not None
    assert len(saved_case.claims) == 1
    assert saved_case.claims[0].id == "c-edited"
    assert saved_case.claims[0].statement == "User edited this specific claim assertion"
    assert saved_case.status == "testing"


def test_stream_returns_404_for_unknown_case(client):
    response = client.get("/cases/nonexistent-case-uuid/stream")
    assert response.status_code == 404
    assert response.json()["detail"] == "Case not found"


def test_stream_terminates_on_error_event(client, sample_case):
    import events
    import store

    store.set(sample_case)
    queue = events.get_queue(sample_case.id)
    queue.put_nowait({"event": "error", "data": {"stage": "evaluators", "message": "Provider timeout"}})

    response = client.get(f"/cases/{sample_case.id}/stream")
    assert response.status_code == 200
    assert "event: error" in response.text
    assert "Provider timeout" in response.text


def test_post_cases_emits_initial_sse_events(client, fake_provider_factory):
    import events
    from api.routes import get_llm_provider
    from core.loop import ExtractedClaims
    from main import app

    provider = fake_provider_factory(
        responses=[ExtractedClaims(statements=["First assertion", "Second assertion"])]
    )
    app.dependency_overrides[get_llm_provider] = lambda: provider

    try:
        response = client.post(
            "/cases",
            json={"raw_input": "New proposal testing stream emission"},
        )
        assert response.status_code == 200
        case_id = response.json()["id"]

        queue = events.get_queue(case_id)
        assert not queue.empty()
        ev1 = queue.get_nowait()
        assert ev1["event"] == "claim_map_ready"
        assert len(ev1["data"]["claims"]) == 2

        ev2 = queue.get_nowait()
        assert ev2["event"] == "awaiting_confirmation"
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_cors_preflight_allows_configured_origin(client):
    response = client.options(
        "/cases",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_get_llm_provider_resolves_from_settings():
    from api.routes import get_llm_provider
    from providers.openai_compat import OpenAICompatibleProvider

    provider = get_llm_provider()
    assert isinstance(provider, OpenAICompatibleProvider)


def test_stream_completed_case_terminates_immediately(client, sample_case):
    import store

    sample_case.status = "done"
    store.set(sample_case)

    # Calling stream on already finished case should yield run_complete and close, not hang
    response = client.get(f"/cases/{sample_case.id}/stream")
    assert response.status_code == 200
    assert "event: run_complete" in response.text
    assert sample_case.id in response.text


def test_confirm_rejects_empty_claims_list(client, sample_case):
    import store

    store.set(sample_case)
    response = client.post(
        f"/cases/{sample_case.id}/confirm",
        json={"claims": []},
    )
    assert response.status_code == 400
    assert "empty claims" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_stream_emits_ping_heartbeat_during_idle(sample_case, monkeypatch):
    import events
    import store
    from main import app
    import httpx

    sample_case.status = "testing"
    store.set(sample_case)

    # Patch timeout in routes to 0.05s so the test runs in milliseconds
    monkeypatch.setattr("api.routes.SSE_PING_INTERVAL_SECONDS", 0.05)

    async def auto_closer():
        await asyncio.sleep(0.12)
        await events.publish(sample_case.id, "run_complete", {"case_id": sample_case.id})
        await events.close(sample_case.id)

    asyncio.create_task(auto_closer())

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(f"/cases/{sample_case.id}/stream")
        assert response.status_code == 200
        assert ": ping\n\n" in response.text
        assert "event: run_complete" in response.text


def test_post_ingest_url_success(client, monkeypatch):
    async def mock_ingest_url(url, claim_statement=None, provider=None):
        return f"Curated content from {url}"

    monkeypatch.setattr("api.routes.ingest_url", mock_ingest_url)

    response = client.post(
        "/ingest/url",
        json={"url": "https://example.com/article", "claim_statement": "Market size is $10B"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["context"] == "Curated content from https://example.com/article"
    assert data["character_count"] == len("Curated content from https://example.com/article")


def test_post_ingest_url_serp_rejected(client, monkeypatch):
    async def mock_ingest_url(url, claim_statement=None, provider=None):
        raise ValueError(f"Direct search engine results page ingestion is disallowed: {url}")

    monkeypatch.setattr("api.routes.ingest_url", mock_ingest_url)

    response = client.post(
        "/ingest/url",
        json={"url": "https://google.com/search?q=test"},
    )
    assert response.status_code == 400
    assert "Direct search engine results page ingestion is disallowed" in response.json()["detail"]


def test_post_ingest_pdf_success(client, monkeypatch):
    import base64

    async def mock_ingest_pdf(source, claim_statement=None, provider=None):
        assert isinstance(source, bytes)
        return "Extracted PDF content here"

    monkeypatch.setattr("api.routes.ingest_pdf", mock_ingest_pdf)

    encoded = base64.b64encode(b"%PDF-1.4 dummy pdf content").decode("ascii")
    response = client.post(
        "/ingest/pdf",
        json={"pdf_base64": encoded, "claim_statement": "Target market"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["context"] == "Extracted PDF content here"
    assert data["character_count"] == len("Extracted PDF content here")


def test_post_ingest_pdf_invalid_base64(client):
    response = client.post(
        "/ingest/pdf",
        json={"pdf_base64": "not-valid-base64-content!!*#%"},
    )
    assert response.status_code == 400
    assert "Invalid base64 PDF data" in response.json()["detail"]


def test_post_ingest_pdf_scanned_rejected(client, monkeypatch):
    import base64

    async def mock_ingest_pdf(source, claim_statement=None, provider=None):
        raise ValueError("Scanned or image-only PDF detected: no extractable text found.")

    monkeypatch.setattr("api.routes.ingest_pdf", mock_ingest_pdf)

    encoded = base64.b64encode(b"dummy pdf bytes").decode("ascii")
    response = client.post(
        "/ingest/pdf",
        json={"pdf_base64": encoded},
    )
    assert response.status_code == 400
    assert "Scanned or image-only PDF detected" in response.json()["detail"]


def test_health_and_ready_endpoints(client):
    from config import get_settings

    settings = get_settings()

    res_health = client.get("/health")
    assert res_health.status_code == 200
    data_health = res_health.json()
    assert data_health["status"] == "ok"
    assert data_health["provider"] == settings.llm_provider
    assert data_health["model"] == settings.llm_model

    res_ready = client.get("/ready")
    assert res_ready.status_code == 200
    data_ready = res_ready.json()
    assert data_ready["status"] == "ok"
    assert data_ready["provider"] == settings.llm_provider
    assert data_ready["model"] == settings.llm_model


def test_rate_limiter_disabled_by_default(client, fake_provider_factory):
    from api.routes import get_llm_provider
    from core.loop import ExtractedClaims
    from main import app

    provider = fake_provider_factory(
        responses=[ExtractedClaims(statements=["Assertion"])] * 15
    )
    app.dependency_overrides[get_llm_provider] = lambda: provider

    try:
        # Rate limiter is disabled by default: 11 requests should all succeed
        for i in range(12):
            res = client.post("/cases", json={"raw_input": f"Proposal attempt {i}"})
            assert res.status_code == 200
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_rate_limiter_blocks_after_10_requests_per_minute_when_enabled(client, fake_provider_factory):
    from api.rate_limiter import rate_limiter
    from api.routes import get_llm_provider
    from core.loop import ExtractedClaims
    from main import app

    rate_limiter.enabled = True
    provider = fake_provider_factory(
        responses=[ExtractedClaims(statements=["Assertion"])] * 15
    )
    app.dependency_overrides[get_llm_provider] = lambda: provider

    try:
        # First 10 requests should succeed
        for i in range(10):
            res = client.post("/cases", json={"raw_input": f"Proposal attempt {i}"})
            assert res.status_code == 200, f"Request {i+1} failed unexpectedly"

        # 11th request from same IP should receive 429 Too Many Requests
        res_blocked = client.post("/cases", json={"raw_input": "Proposal attempt 11"})
        assert res_blocked.status_code == 429
        assert "Rate limit exceeded" in res_blocked.json()["detail"]
        assert "Retry-After" in res_blocked.headers

        # Non-rate-limited endpoints like /health should still be accessible
        res_health = client.get("/health")
        assert res_health.status_code == 200
    finally:
        rate_limiter.enabled = False
        rate_limiter.reset()
        app.dependency_overrides.pop(get_llm_provider, None)


def test_post_ingest_image_success(client, monkeypatch):
    import base64

    async def mock_ingest_image(source, claim_statement=None, provider=None):
        assert isinstance(source, bytes)
        return "Extracted Image text from mock OCR"

    monkeypatch.setattr("api.routes.ingest_image", mock_ingest_image)

    encoded = base64.b64encode(b"\x89PNG\r\n\x1a\n fake png").decode("ascii")
    response = client.post(
        "/ingest/image",
        json={"image_base64": encoded, "claim_statement": "Target market"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["context"] == "Extracted Image text from mock OCR"
    assert data["character_count"] == len("Extracted Image text from mock OCR")


def test_post_ingest_image_invalid_base64(client):
    response = client.post(
        "/ingest/image",
        json={"image_base64": "invalid-base64-character-string!@#"},
    )
    assert response.status_code == 400
    assert "Invalid base64 image data" in response.json()["detail"]


def test_post_ingest_image_empty_text_rejected(client, monkeypatch):
    import base64

    async def mock_ingest_image(source, claim_statement=None, provider=None):
        return ""

    monkeypatch.setattr("api.routes.ingest_image", mock_ingest_image)

    encoded = base64.b64encode(b"dummy image bytes").decode("ascii")
    response = client.post(
        "/ingest/image",
        json={"image_base64": encoded},
    )
    assert response.status_code == 400
    assert "No extractable text found in image" in response.json()["detail"]


def test_post_cases_custom_agents(client, fake_provider_factory):
    from api.routes import get_llm_provider
    from core.loop import ExtractedClaims
    from main import app

    provider = fake_provider_factory(
        responses=[
            ExtractedClaims(statements=["A custom assumption about unit economics."])
        ]
    )
    app.dependency_overrides[get_llm_provider] = lambda: provider

    try:
        response = client.post(
            "/cases",
            json={
                "raw_input": "Test proposal with custom agents",
                "agent_mode": "custom",
                "selected_agents": ["devils_advocate", "builder"],
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["agent_mode"] == "custom"
        assert body["selected_agents"] == ["devils_advocate", "builder"]
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_post_cases_auto_agents_returns_rationales(client, fake_provider_factory):
    from api.routes import get_llm_provider
    from core.loop import ExtractedClaims
    from main import app

    provider = fake_provider_factory(
        responses=[
            ExtractedClaims(statements=["Users will pay $50/mo for this platform."])
        ]
    )
    app.dependency_overrides[get_llm_provider] = lambda: provider

    try:
        response = client.post(
            "/cases",
            json={
                "raw_input": "Test proposal in auto mode",
                "agent_mode": "auto",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["agent_mode"] == "auto"
        assert "devils_advocate" in body["selected_agents"]
        assert "receipts" in body["selected_agents"]
        assert "agent_rationales" in body
        assert len(body["agent_rationales"]) >= 2
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_confirm_updates_selected_agents(client, monkeypatch, sample_case):
    import store
    from core.loop import handle_confirm

    store.set(sample_case)

    async def mock_handle_confirm(case_id):
        pass

    monkeypatch.setattr("api.routes.handle_confirm", mock_handle_confirm)

    response = client.post(
        f"/cases/{sample_case.id}/confirm",
        json={
            "claims": [c.model_dump() for c in sample_case.claims],
            "selected_agents": ["devils_advocate", "overthinker"],
        },
    )
    assert response.status_code == 202
    updated = store.get(sample_case.id)
    assert updated.selected_agents == ["devils_advocate", "overthinker"]


def test_confirm_empty_selected_agents_rejected(client, sample_case):
    import store
    store.set(sample_case)

    response = client.post(
        f"/cases/{sample_case.id}/confirm",
        json={
            "claims": [c.model_dump() for c in sample_case.claims],
            "selected_agents": [],
        },
    )
    assert response.status_code == 400
    assert "At least one agent must be selected" in response.json()["detail"]





