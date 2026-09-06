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


# --- Fill in once providers/gemini.py exists ---
#
# @pytest.mark.asyncio
# async def test_gemini_provider_satisfies_protocol(monkeypatch):
#     """Mock google-genai's client so this never makes a real network call.
#     Assert GeminiProvider.generate() returns the same shape (str | BaseModel)
#     as FakeLLMProvider does above, for both the plain-text and
#     response_schema-set cases."""
#     ...
#
# def test_anthropic_and_openai_compat_stubs_implement_the_protocol():
#     """They don't need real behavior yet — just prove the classes exist and
#     satisfy LLMProvider, so `isinstance`-style structural checks (or a
#     runtime_checkable Protocol) don't break when someone wires a second
#     provider in later."""
#     ...
