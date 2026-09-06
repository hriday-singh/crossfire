"""
Owner: Dev A. Proves the point of the whole provider abstraction: nothing
outside providers/gemini.py should care which concrete provider it's talking
to. If GeminiProvider needs special-casing to pass the same test FakeLLMProvider
passes, the abstraction has a leak — fix that now, not after Dev B/C's code
has grown a dependency on Gemini-specific behavior.
"""
from __future__ import annotations

import pytest

from providers.base import LLMProvider


@pytest.mark.asyncio
async def test_fake_provider_satisfies_the_protocol(fake_provider_factory):
    provider: LLMProvider = fake_provider_factory(responses=["a plain text reply"])
    result = await provider.generate(system_prompt="sys", messages=[{"role": "user", "content": "hi"}])
    assert result == "a plain text reply"


@pytest.mark.asyncio
async def test_fake_provider_returns_structured_output_when_schema_given(fake_provider_factory, sample_claim):
    provider: LLMProvider = fake_provider_factory(responses=[sample_claim])
    result = await provider.generate(
        system_prompt="sys",
        messages=[{"role": "user", "content": "extract"}],
        response_schema=type(sample_claim),
    )
    assert result == sample_claim


@pytest.mark.asyncio
async def test_fake_provider_records_calls_for_assertion(fake_provider_factory):
    provider = fake_provider_factory(responses=["r1", "r2"])
    await provider.generate(system_prompt="sys1", messages=[])
    await provider.generate(system_prompt="sys2", messages=[])
    assert [c["system_prompt"] for c in provider.calls] == ["sys1", "sys2"]


@pytest.mark.asyncio
async def test_openai_compat_provider_generate(monkeypatch):
    import httpx
    from providers.openai_compat import OpenAICompatibleProvider

    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [
                    {"message": {"content": "mocked assistant response"}}
                ]
            }

    async def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenAICompatibleProvider()
    result = await provider.generate(
        system_prompt="sys",
        messages=[{"role": "user", "content": "hello"}],
    )
    assert result == "mocked assistant response"


@pytest.mark.asyncio
async def test_openai_compat_provider_structured_output(monkeypatch, sample_claim):
    import httpx
    from providers.openai_compat import OpenAICompatibleProvider

    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [
                    {"message": {"content": f"```json\n{sample_claim.model_dump_json()}\n```"}}
                ]
            }

    async def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenAICompatibleProvider()
    result = await provider.generate(
        system_prompt="sys",
        messages=[{"role": "user", "content": "extract"}],
        response_schema=type(sample_claim),
    )
    assert result == sample_claim

