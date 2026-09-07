"""
Owner: Dev A. Failover behaviour: a 429 must cost the next key, not the run.
"""
from __future__ import annotations

import httpx
import pytest
from pydantic import BaseModel

from providers.openai_compat import LLMTimeoutError
from providers.pool import KeyPool, KeySlot
from providers.routing import AllProvidersFailedError, RoutingProvider, Target


class Reply(BaseModel):
    text: str


def http_error(status: int, retry_after: str | None = None) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://example.test/v1/chat/completions")
    headers = {"retry-after": retry_after} if retry_after else {}
    response = httpx.Response(status, request=request, headers=headers, text="nope")
    return httpx.HTTPStatusError("boom", request=request, response=response)


class ScriptedAdapter:
    """Answers per key id: an Exception raises, anything else is returned."""

    def __init__(self, script: dict[int, object], key_id: int, calls: list[int]) -> None:
        self._script = script
        self._key_id = key_id
        self._calls = calls

    async def generate(self, system_prompt, messages, response_schema=None):
        self._calls.append(self._key_id)
        outcome = self._script.get(self._key_id, "ok")
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def scripted_target(
    provider: str,
    keys: int,
    script: dict[int, object],
    calls: list[int],
    offset: int = 0,
) -> Target:
    slots = [KeySlot(key_id=offset + i, secret=f"s{offset + i}") for i in range(keys)]
    target = Target(
        provider=provider,
        wire="openai_compat",
        model="test-model",
        base_url="https://example.test/v1",
        pool=KeyPool(provider, slots, max_inflight_per_key=1),
    )
    target.adapter_for = lambda key_id, secret: ScriptedAdapter(script, key_id, calls)  # type: ignore[method-assign]
    return target


@pytest.mark.asyncio
async def test_rate_limited_key_rotates_to_the_next_key_and_succeeds():
    calls: list[int] = []
    target = scripted_target("gemini", 3, {0: http_error(429), 1: "second key wins"}, calls)

    result = await RoutingProvider([target]).generate("sys", [{"role": "user", "content": "hi"}])

    assert result == "second key wins"
    assert calls == [0, 1]
    assert target.pool.stats().rate_limits == 1


@pytest.mark.asyncio
async def test_retry_after_header_sets_the_cooldown():
    calls: list[int] = []
    target = scripted_target("gemini", 2, {0: http_error(429, retry_after="45"), 1: "ok"}, calls)

    await RoutingProvider([target]).generate("sys", [])

    benched = target.pool.slots[0]
    assert benched.cooldown_until > 0


@pytest.mark.asyncio
async def test_all_keys_rate_limited_falls_through_to_the_next_provider():
    calls: list[int] = []
    primary = scripted_target("gemini", 2, {0: http_error(429), 1: http_error(429)}, calls)
    backup = scripted_target("openai", 1, {10: "backup answered"}, calls, offset=10)

    result = await RoutingProvider([primary, backup]).generate("sys", [])

    assert result == "backup answered"
    assert calls == [0, 1, 10]


@pytest.mark.asyncio
async def test_invalid_credential_retires_the_key_rather_than_benching_it():
    calls: list[int] = []
    target = scripted_target("openai", 2, {0: http_error(401), 1: "ok"}, calls)

    await RoutingProvider([target]).generate("sys", [])

    assert target.pool.slots[0].dead is True


@pytest.mark.asyncio
async def test_timeouts_rotate_keys_too():
    calls: list[int] = []
    target = scripted_target("gemini", 2, {0: LLMTimeoutError("slow"), 1: "ok"}, calls)

    assert await RoutingProvider([target]).generate("sys", []) == "ok"
    assert calls == [0, 1]


@pytest.mark.asyncio
async def test_bad_request_is_raised_not_rotated():
    # A 400 is our payload's fault; every other key would fail identically.
    calls: list[int] = []
    target = scripted_target("openai", 3, {0: http_error(400)}, calls)

    with pytest.raises(httpx.HTTPStatusError):
        await RoutingProvider([target]).generate("sys", [])
    assert calls == [0]


@pytest.mark.asyncio
async def test_every_provider_failing_raises_one_aggregated_error():
    calls: list[int] = []
    primary = scripted_target("gemini", 1, {0: http_error(429)}, calls)
    backup = scripted_target("openai", 1, {10: http_error(500)}, calls, offset=10)

    with pytest.raises(AllProvidersFailedError) as exc:
        await RoutingProvider([primary, backup]).generate("sys", [])

    assert "gemini" in str(exc.value)
    assert "openai" in str(exc.value)


@pytest.mark.asyncio
async def test_keyless_target_still_works():
    calls: list[int] = []
    target = Target(provider="gemini_proxy", wire="openai_compat", model="m", base_url="http://x/v1")
    target.adapter_for = lambda key_id, secret: ScriptedAdapter({0: "proxy ok"}, 0, calls)  # type: ignore[method-assign]

    assert await RoutingProvider([target]).generate("sys", []) == "proxy ok"


@pytest.mark.asyncio
async def test_structured_schema_is_passed_through_unchanged():
    reply = Reply(text="structured")
    calls: list[int] = []
    target = scripted_target("gemini", 1, {0: reply}, calls)

    result = await RoutingProvider([target]).generate("sys", [], response_schema=Reply)
    assert result == reply


def test_routing_provider_requires_at_least_one_target():
    with pytest.raises(ValueError):
        RoutingProvider([])
