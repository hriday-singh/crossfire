"""
Owner: Dev A. Model discovery tries the usual list endpoints in order.
"""
from __future__ import annotations

import httpx
import pytest

from providers.discovery import DiscoveryError, candidate_urls, discover_models, parse_models


def test_candidate_urls_cover_openai_v1_and_ollama():
    assert candidate_urls("http://box:8000/", "openai_compat") == [
        "http://box:8000/models",
        "http://box:8000/v1/models",
        "http://box:8000/api/tags",
    ]
    assert candidate_urls("http://localhost:11434/v1", "openai_compat") == [
        "http://localhost:11434/v1/models",
        "http://localhost:11434/api/tags",
    ]
    assert candidate_urls("https://api.anthropic.com/v1", "anthropic") == [
        "https://api.anthropic.com/v1/models?limit=1000"
    ]


def test_parse_models_handles_every_common_shape():
    assert parse_models({"data": [{"id": "gpt-x"}, {"id": "gpt-x"}, {"id": "o9"}]}) == ["gpt-x", "o9"]
    assert parse_models({"models": [{"name": "llama3.1:8b"}]}) == ["llama3.1:8b"]
    assert parse_models({"data": [{"id": "models/gemini-3.7-flash"}]}) == ["gemini-3.7-flash"]
    assert parse_models(["a", "b"]) == ["a", "b"]
    assert parse_models({"object": "list"}) == []


@pytest.mark.asyncio
async def test_discover_falls_back_until_a_url_answers_and_sends_the_key():
    seen: list[tuple[str, str | None]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.url.path, request.headers.get("authorization")))
        if request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "qwen"}]})
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        models = await discover_models("http://box:8000", api_key="sk-1", client=client)

    assert models == ["qwen"]
    assert seen == [("/models", "Bearer sk-1"), ("/v1/models", "Bearer sk-1")]


@pytest.mark.asyncio
async def test_discover_reports_every_attempt_when_nothing_answers():
    transport = httpx.MockTransport(lambda request: httpx.Response(401))
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(DiscoveryError, match="HTTP 401"):
            await discover_models("http://box/v1", client=client)


@pytest.mark.asyncio
async def test_discover_needs_a_base_url():
    with pytest.raises(DiscoveryError):
        await discover_models("  ")
