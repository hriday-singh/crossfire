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


def test_clean_json_markdown_variants():
    from providers.openai_compat import _clean_json_markdown

    assert _clean_json_markdown('{"valid": true}') == '{"valid": true}'
    assert _clean_json_markdown('```json\n{"valid": true}\n```') == '{"valid": true}'
    assert _clean_json_markdown('```\n{"valid": true}\n```') == '{"valid": true}'
    assert _clean_json_markdown('   ```json  \n{"valid": true}\n```  ') == '{"valid": true}'


@pytest.mark.asyncio
async def test_openai_compat_provider_http_error(monkeypatch):
    import httpx
    from providers.openai_compat import OpenAICompatibleProvider

    class ErrorResponse:
        def raise_for_status(self):
            request = httpx.Request("POST", "http://localhost:8081/v1/chat/completions")
            response = httpx.Response(500, request=request)
            raise httpx.HTTPStatusError("Server Error", request=request, response=response)

    async def mock_post(*args, **kwargs):
        return ErrorResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenAICompatibleProvider()
    with pytest.raises(httpx.HTTPStatusError):
        await provider.generate(system_prompt="sys", messages=[])


@pytest.mark.asyncio
async def test_gemini_provider_delegates_generate(monkeypatch):
    from providers.base import LLMProvider
    from providers.gemini import GeminiProvider
    from providers.openai_compat import OpenAICompatibleProvider

    called_with = {}

    async def mock_generate(self, system_prompt, messages, response_schema=None):
        called_with["system_prompt"] = system_prompt
        called_with["messages"] = messages
        called_with["response_schema"] = response_schema
        return "gemini delegated reply"

    monkeypatch.setattr(OpenAICompatibleProvider, "generate", mock_generate)

    gemini: LLMProvider = GeminiProvider(api_key="gem-test-key")
    result = await gemini.generate(system_prompt="sys", messages=[{"role": "user", "content": "hi"}])
    assert result == "gemini delegated reply"
    assert called_with["system_prompt"] == "sys"


@pytest.mark.asyncio
async def test_anthropic_provider_posts_to_the_messages_api(monkeypatch):
    """Claude speaks a different wire shape: system is top-level, text comes
    back as content blocks. No SDK — just the documented REST call."""
    import httpx

    from providers.anthropic import AnthropicProvider
    from providers.base import LLMProvider

    seen: dict = {}

    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"content": [{"type": "text", "text": "claude says hi"}]}

    class MockClient:
        async def post(self, url, json=None, headers=None):
            seen["url"] = url
            seen["json"] = json
            seen["headers"] = headers
            return MockResponse()

    provider: LLMProvider = AnthropicProvider(api_key="ant-key", model="claude-sonnet-5")
    monkeypatch.setattr(provider, "_get_client", lambda: _resolved(MockClient()))

    result = await provider.generate(
        system_prompt="sys", messages=[{"role": "user", "content": "hi"}]
    )

    assert result == "claude says hi"
    assert seen["url"].endswith("/messages")
    assert seen["json"]["system"] == "sys"
    assert seen["json"]["messages"] == [{"role": "user", "content": "hi"}]
    assert seen["headers"]["x-api-key"] == "ant-key"
    assert seen["headers"]["anthropic-version"] == "2023-06-01"


def _resolved(value):
    async def _coro():
        return value

    return _coro()


def test_anthropic_message_conversion_drops_system_and_starts_with_user():
    from providers.anthropic import AnthropicProvider

    converted = AnthropicProvider._to_anthropic_messages(
        [
            {"role": "system", "content": "ignored"},
            {"role": "assistant", "content": "leading assistant turn"},
        ]
    )

    assert all(m["role"] != "system" for m in converted)
    assert converted[0]["role"] == "user"


def test_get_provider_factory():
    """Named lookup builds one bare adapter per catalog id — no pool, no
    fallback. The no-argument call is the pipeline's path and is covered by
    tests/api/test_provider_routes.py."""
    from providers import get_provider
    from providers.anthropic import AnthropicProvider
    from providers.openai_compat import OpenAICompatibleProvider

    assert isinstance(get_provider("gemini"), OpenAICompatibleProvider)
    assert isinstance(get_provider("OPENAI_COMPAT"), OpenAICompatibleProvider)
    assert isinstance(get_provider("Anthropic"), AnthropicProvider)
    assert isinstance(get_provider("ollama"), OpenAICompatibleProvider)

    # API key override
    p4 = get_provider("openai_compat", api_key="custom-override-key")
    assert p4._api_key == "custom-override-key"

    # Unknown provider
    with pytest.raises(ValueError) as exc_info:
        get_provider("unsupported_provider")
    assert "unknown LLM provider 'unsupported_provider'" in str(exc_info.value)


def test_get_provider_with_no_arguments_returns_the_routing_chain():
    from providers import get_provider
    from providers.routing import RoutingProvider

    provider = get_provider()
    assert isinstance(provider, RoutingProvider)
    assert provider.primary.provider == "ollama"


@pytest.mark.asyncio
async def test_openai_compat_provider_reuses_pooled_client(monkeypatch):
    import httpx
    from providers.openai_compat import OpenAICompatibleProvider

    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [{"message": {"content": "ok"}}]
            }

    async def mock_post(self, *args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenAICompatibleProvider()
    assert provider._client is None

    # First call initializes client
    res1 = await provider.generate(system_prompt="", messages=[])
    assert res1 == "ok"
    first_client = provider._client
    assert isinstance(first_client, httpx.AsyncClient)
    assert not first_client.is_closed

    # Second call reuses exact same client instance
    res2 = await provider.generate(system_prompt="", messages=[])
    assert res2 == "ok"
    assert provider._client is first_client

    # aclose closes the pooled client
    await provider.aclose()
    assert first_client.is_closed

    # Next call after close lazily provisions a new active client
    res3 = await provider.generate(system_prompt="", messages=[])
    assert res3 == "ok"
    assert provider._client is not first_client
    assert not provider._client.is_closed
    await provider.aclose()


@pytest.mark.asyncio
async def test_openai_compat_provider_context_manager(monkeypatch):
    import httpx
    from providers.openai_compat import OpenAICompatibleProvider

    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [{"message": {"content": "context-ok"}}]
            }

    async def mock_post(self, *args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    async with OpenAICompatibleProvider() as provider:
        res = await provider.generate(system_prompt="", messages=[])
        assert res == "context-ok"
        client = provider._client
        assert not client.is_closed

    assert client.is_closed




@pytest.mark.asyncio
async def test_openai_compat_retries_once_when_upstream_returns_non_json(monkeypatch, sample_claim):
    """Some OpenAI-compatible proxies answer 200 with their own failure text instead
    of the completion. One retry recovers the claim instead of losing it to `unresolved`."""
    import httpx
    from providers.openai_compat import OpenAICompatibleProvider

    contents = [
        "Sorry, something went wrong. Please try your request again.",
        sample_claim.model_dump_json(),
    ]

    class MockResponse:
        def __init__(self, content):
            self._content = content

        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": self._content}}]}

    calls = []

    async def mock_post(*args, **kwargs):
        calls.append(kwargs)
        return MockResponse(contents[len(calls) - 1])

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenAICompatibleProvider()
    result = await provider.generate(
        system_prompt="sys",
        messages=[{"role": "user", "content": "reconcile"}],
        response_schema=type(sample_claim),
    )
    assert result == sample_claim
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_openai_compat_raises_readable_error_after_two_bad_responses(monkeypatch, sample_claim):
    import httpx
    from providers.openai_compat import LLMFormatError, OpenAICompatibleProvider

    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [
                    {"message": {"content": "Sorry, something went wrong. Please try your request again."}}
                ]
            }

    calls = []

    async def mock_post(*args, **kwargs):
        calls.append(kwargs)
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenAICompatibleProvider()
    with pytest.raises(LLMFormatError) as excinfo:
        await provider.generate(
            system_prompt="sys",
            messages=[{"role": "user", "content": "reconcile"}],
            response_schema=type(sample_claim),
        )

    message = str(excinfo.value)
    assert len(calls) == 2
    assert "Sorry, something went wrong" in message
    assert "validation error" not in message
    assert "pydantic.dev" not in message


def test_snippet_flattens_and_truncates():
    from providers.openai_compat import _snippet

    assert _snippet("") == "(empty response)"
    assert _snippet("  a\n b  ") == "a b"
    assert _snippet("x" * 200).endswith("...")
    assert len(_snippet("x" * 200)) == 163


@pytest.mark.asyncio
async def test_openai_compat_retries_on_timeout_and_succeeds(monkeypatch):
    import httpx
    from providers.openai_compat import OpenAICompatibleProvider

    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [
                    {"message": {"content": "Answer after retry"}}
                ]
            }

    attempts = 0

    async def mock_post(*args, **kwargs):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.ReadTimeout("Socket read timed out")
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenAICompatibleProvider()
    result = await provider.generate(system_prompt="", messages=[{"role": "user", "content": "hi"}])
    assert result == "Answer after retry"
    assert attempts == 2


@pytest.mark.asyncio
async def test_openai_compat_raises_llm_timeout_error_after_retries(monkeypatch):
    import httpx
    from providers.openai_compat import LLMTimeoutError, OpenAICompatibleProvider

    attempts = 0

    async def mock_post(*args, **kwargs):
        nonlocal attempts
        attempts += 1
        raise httpx.ReadTimeout("Socket read timed out")

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenAICompatibleProvider()
    with pytest.raises(LLMTimeoutError) as exc_info:
        await provider.generate(system_prompt="", messages=[{"role": "user", "content": "hi"}])

    assert attempts == 2
    assert isinstance(exc_info.value, httpx.TimeoutException)
    assert "timed out" in str(exc_info.value)

