"""
Owner: Dev A. DeepSeek V4 thinking mode: per-model switch + effort, the long
timeout it needs, and the chain of thought reaching findings.
"""
from __future__ import annotations

import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

import providers
from providers import keyring
from providers.catalog import ThinkingSetting
from providers.openai_compat import (
    THINKING_TIMEOUT_SECONDS,
    LLMTimeoutError,
    OpenAICompatibleProvider,
    reasoning_sink,
)


@pytest.fixture(autouse=True)
def clean_keyring():
    keyring.clear()
    providers.invalidate_cache()
    yield
    keyring.clear()
    providers.invalidate_cache()


@pytest.fixture
def client():
    from main import app

    return TestClient(app)


def _mock_post(monkeypatch, calls: list[dict]) -> None:
    class MockResponse:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": "ok", "reasoning_content": " weighing it "}}]}

    async def mock_post(*args, **kwargs):
        calls.append(dict(kwargs["json"]))
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)


async def test_thinking_on_sends_effort_uses_long_timeout_and_captures_reasoning(monkeypatch):
    calls: list[dict] = []
    _mock_post(monkeypatch, calls)

    provider = OpenAICompatibleProvider(model="deepseek-flash", thinking=ThinkingSetting(True, "max"))
    assert provider._timeout == THINKING_TIMEOUT_SECONDS

    sink: list[str] = []
    token = reasoning_sink.set(sink)
    try:
        assert await provider.generate("sys", [{"role": "user", "content": "hi"}]) == "ok"
    finally:
        reasoning_sink.reset(token)

    assert calls[-1]["thinking"] == {"type": "enabled"}
    assert calls[-1]["reasoning_effort"] == "max"
    assert sink == ["weighing it"]


async def test_thinking_off_sends_disabled_and_no_effort(monkeypatch):
    calls: list[dict] = []
    _mock_post(monkeypatch, calls)

    provider = OpenAICompatibleProvider(model="deepseek-flash", thinking=ThinkingSetting(False, "high"))
    assert provider._timeout < THINKING_TIMEOUT_SECONDS
    await provider.generate("sys", [{"role": "user", "content": "hi"}])

    assert calls[-1]["thinking"] == {"type": "disabled"}
    assert "reasoning_effort" not in calls[-1]


async def test_provider_without_thinking_sends_no_thinking_field(monkeypatch):
    calls: list[dict] = []
    _mock_post(monkeypatch, calls)

    await OpenAICompatibleProvider(model="llama3.1").generate("sys", [{"role": "user", "content": "hi"}])
    assert "thinking" not in calls[-1]


async def test_reasoning_reaches_caller_through_wait_for(monkeypatch):
    """loop.py wraps evaluators in asyncio.wait_for, which copies the context."""
    calls: list[dict] = []
    _mock_post(monkeypatch, calls)
    provider = OpenAICompatibleProvider(model="deepseek-flash", thinking=ThinkingSetting())

    sink: list[str] = []
    token = reasoning_sink.set(sink)
    try:
        await asyncio.wait_for(provider.generate("sys", [{"role": "user", "content": "hi"}]), timeout=5)
    finally:
        reasoning_sink.reset(token)
    assert sink == ["weighing it"]


async def test_thinking_timeout_is_not_retried(monkeypatch):
    """A 120 s thinking timeout is a hang, not a blip: retrying doubles the wait."""
    calls: list[int] = []

    async def mock_post(*args, **kwargs):
        calls.append(1)
        raise httpx.ReadTimeout("slow")

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    provider = OpenAICompatibleProvider(model="deepseek-flash", thinking=ThinkingSetting())
    with pytest.raises(LLMTimeoutError):
        await provider.generate("sys", [{"role": "user", "content": "hi"}])
    assert len(calls) == 1


def test_keyring_defaults_thinking_on_for_deepseek_and_round_trips():
    assert keyring.get_thinking("deepseek")["deepseek-flash"] == ThinkingSetting(True, "high")
    assert keyring.get_thinking("ollama") == {}

    keyring.set_thinking("deepseek", "deepseek-flash", enabled=False, effort="low")
    saved = keyring.get_thinking("deepseek")
    assert saved["deepseek-flash"] == ThinkingSetting(False, "low")
    assert saved["deepseek-v4-pro"] == ThinkingSetting(True, "high")


def test_keyring_rejects_bad_thinking_input():
    with pytest.raises(ValueError):
        keyring.set_thinking("deepseek", "deepseek-flash", enabled=True, effort="medium")
    with pytest.raises(ValueError):
        keyring.set_thinking("deepseek", "not-saved", enabled=True, effort="high")
    with pytest.raises(ValueError):
        keyring.set_thinking("ollama", "llama3.1", enabled=True, effort="high")


def test_thinking_route_round_trips_and_reaches_the_chain(client):
    body = client.get("/providers").json()
    deepseek = next(p for p in body["providers"] if p["id"] == "deepseek")
    assert deepseek["supports_thinking"] is True
    assert deepseek["thinking"]["deepseek-flash"] == {"enabled": True, "effort": "high"}
    ollama = next(p for p in body["providers"] if p["id"] == "ollama")
    assert ollama["supports_thinking"] is False
    assert ollama["thinking"] == {}

    resp = client.put(
        "/providers/deepseek/thinking",
        json={"model": "deepseek-flash", "enabled": False, "effort": "low"},
    )
    assert resp.status_code == 200
    assert resp.json()["thinking"]["deepseek-flash"] == {"enabled": False, "effort": "low"}

    keyring.set_active_provider("deepseek")
    targets = {t.model: t for t in providers.build_chain()}
    assert targets["deepseek-flash"].thinking == ThinkingSetting(False, "low")
    assert targets["deepseek-v4-pro"].thinking == ThinkingSetting(True, "high")


def test_thinking_route_rejects_bad_effort_and_unsupported_provider(client):
    bad_effort = client.put(
        "/providers/deepseek/thinking",
        json={"model": "deepseek-flash", "enabled": True, "effort": "medium"},
    )
    assert bad_effort.status_code == 422
    unsupported = client.put(
        "/providers/ollama/thinking",
        json={"model": "llama3.1", "enabled": True, "effort": "high"},
    )
    assert unsupported.status_code == 400
