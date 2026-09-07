"""
Owner: Dev A. Tests for timeout and upstream provider error resilience across API routes.
"""
import httpx
import pytest
from fastapi.testclient import TestClient

from api.routes import get_llm_provider
from main import app
from providers.openai_compat import LLMFormatError


@pytest.fixture
def client():
    return TestClient(app)


class TimeoutProvider:
    async def generate(self, system_prompt, messages, response_schema=None):
        raise httpx.ReadTimeout("Socket read timed out")


class ConnectErrorProvider:
    async def generate(self, system_prompt, messages, response_schema=None):
        raise httpx.ConnectError("Connection refused by localhost:8081")


class FormatErrorProvider:
    async def generate(self, system_prompt, messages, response_schema=None):
        raise LLMFormatError("Proxy returned 'Sorry, something went wrong'")


class RateLimitErrorProvider:
    async def generate(self, system_prompt, messages, response_schema=None):
        req = httpx.Request("POST", "http://localhost:8081/v1/chat/completions")
        resp = httpx.Response(502, request=req, json={"error": {"message": "upstream error: HTTP Error 429: Too Many Requests"}})
        raise httpx.HTTPStatusError("502 Bad Gateway", request=req, response=resp)


def test_baseline_timeout_returns_504(client):
    app.dependency_overrides[get_llm_provider] = lambda: TimeoutProvider()
    try:
        response = client.post("/baseline", json={"raw_input": "Should I switch jobs?"})
        assert response.status_code == 504
        data = response.json()
        assert "timed out" in data["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_baseline_connect_error_returns_502(client):
    app.dependency_overrides[get_llm_provider] = lambda: ConnectErrorProvider()
    try:
        response = client.post("/baseline", json={"raw_input": "Should I switch jobs?"})
        assert response.status_code == 502
        data = response.json()
        assert "failed" in data["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_baseline_rate_limit_returns_429(client):
    app.dependency_overrides[get_llm_provider] = lambda: RateLimitErrorProvider()
    try:
        response = client.post("/baseline", json={"raw_input": "Should I switch jobs?"})
        assert response.status_code == 429
        data = response.json()
        assert "429" in data["detail"] or "too many requests" in data["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_create_case_timeout_returns_504(client):
    app.dependency_overrides[get_llm_provider] = lambda: TimeoutProvider()
    try:
        response = client.post("/cases", json={"raw_input": "Should I hire a COO?"})
        assert response.status_code == 504
        data = response.json()
        assert "timed out" in data["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)


def test_format_error_returns_502(client):
    app.dependency_overrides[get_llm_provider] = lambda: FormatErrorProvider()
    try:
        response = client.post("/cases", json={"raw_input": "Should I hire a COO?"})
        assert response.status_code == 502
        data = response.json()
        assert "proxy returned" in data["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_llm_provider, None)
