"""
Tests for server restart recovery and interrupted stream handling (Gap 1).
"""
from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient

import events
import store
from core.models import Case, Claim
from main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_recover_interrupted_cases_marks_testing_as_error():
    store.clear()
    case = Case(
        id="case-interrupted-1",
        raw_input="Deploy production release",
        status="testing",
        claims=[Claim(id="c1", statement="Deployment is stable")],
    )
    store.set(case)

    # In-memory and SQLite row both have status "testing"
    assert store.get("case-interrupted-1").status == "testing"

    recovered_count = store.recover_interrupted_cases()
    assert recovered_count == 1

    updated_case = store.get("case-interrupted-1")
    assert updated_case is not None
    assert updated_case.status == "error"


def test_stream_case_interrupted_emits_error_and_closes(client):
    store.clear()
    case = Case(
        id="case-interrupted-2",
        raw_input="Migrate user database",
        status="testing",
        claims=[Claim(id="c2", statement="Migration has zero downtime")],
    )
    store.set(case)

    # Ensure no events in memory
    events.reset()

    response = client.get("/cases/case-interrupted-2/stream")
    assert response.status_code == 200
    content = response.text

    assert "event: error" in content
    assert "Run interrupted or server restarted" in content
    assert ": ping" not in content


def test_lifespan_recovers_interrupted_cases_on_startup():
    store.clear()
    case = Case(
        id="case-startup-recovery",
        raw_input="Process batch transactions",
        status="testing",
        claims=[Claim(id="c3", statement="Batch completes in time")],
    )
    store.set(case)

    # Trigger FastAPI lifespan startup
    with TestClient(app):
        recovered = store.get("case-startup-recovery")
        assert recovered is not None
        assert recovered.status == "error"
