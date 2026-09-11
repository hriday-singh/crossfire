"""
Owner: Dev A. The LLMProvider the pipeline actually talks to.

One `generate()` call walks a chain of targets — the user's active provider
first, then their configured fallbacks. Within a target it borrows keys from
that provider's KeyPool: a 429 benches the key and the call retries instantly
on the next one, and only when a provider runs out of usable keys does the
chain move on to the next provider.

Everything upstream (loop.py, evaluators, ingestion) still sees the plain
LLMProvider protocol and knows nothing about pools, keys or fallbacks.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx
from pydantic import BaseModel

from providers.anthropic import AnthropicProvider
from providers.base import LLMProvider
from providers.openai_compat import (
    LLMConnectionError,
    LLMProviderError,
    LLMTimeoutError,
    OpenAICompatibleProvider,
)
from providers.pool import KeyPool, KeySlot, PoolExhaustedError

logger = logging.getLogger(__name__)

#: Keys tried per provider before giving up on it and falling through.
MAX_KEY_ATTEMPTS = 4
_FATAL_STATUS = (401, 403)
_RETRYABLE_STATUS = (408, 409, 425, 429, 500, 502, 503, 504)


class AllProvidersFailedError(LLMProviderError):
    """Every provider in the chain, and every key in each, refused the call."""


@dataclass
class Target:
    """One provider in the fallback chain, with its keys."""

    provider: str
    wire: str
    model: str
    base_url: str
    pool: KeyPool | None = None
    #: adapters are cached per key so the httpx connection pool is reused
    _adapters: dict[int, LLMProvider] = field(default_factory=dict, repr=False)
    _consecutive_failures: int = field(default=0, repr=False)
    _dead_until: float = field(default=0.0, repr=False)

    def adapter_for(self, key_id: int, secret: str | None) -> LLMProvider:
        cached = self._adapters.get(key_id)
        if cached is not None:
            return cached
        # With two or more keys, rotation IS the retry: a 429 should move to the
        # next key immediately rather than sleeping on the one that refused us.
        # With zero or one key there is nothing to rotate to, so keep the
        # adapter's own transient retry.
        rotates = self.pool is not None and len(self.pool) > 1
        if self.wire == "anthropic":
            adapter: LLMProvider = AnthropicProvider(
                api_key=secret,
                base_url=self.base_url,
                model=self.model,
                retry_transient=not rotates,
            )
        else:
            adapter = OpenAICompatibleProvider(
                api_key=secret or "none",
                base_url=self.base_url,
                model=self.model,
                retry_transient=not rotates,
            )
        self._adapters[key_id] = adapter
        return adapter


def _retry_after(exc: httpx.HTTPStatusError) -> float | None:
    raw = exc.response.headers.get("retry-after") if exc.response is not None else None
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None  # ponytail: HTTP-date form is rare here; backoff covers it


class RoutingProvider:
    """LLMProvider that rotates keys within a provider and falls back across providers."""

    def __init__(self, targets: list[Target], max_key_attempts: int = MAX_KEY_ATTEMPTS) -> None:
        if not targets:
            raise ValueError("RoutingProvider needs at least one target")
        self._targets = targets
        self._max_key_attempts = max_key_attempts
        self._last_cause: Exception | None = None

    @property
    def targets(self) -> list[Target]:
        return list(self._targets)

    @property
    def primary(self) -> Target:
        return self._targets[0]

    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel:
        errors: list[str] = []

        for target in self._targets:
            try:
                return await self._generate_on(target, system_prompt, messages, response_schema)
            except PoolExhaustedError as exc:
                errors.append(f"{target.provider}: {exc}")
                logger.warning("Provider %s exhausted, falling through: %s", target.provider, exc)
            except _TargetFailed as exc:
                errors.append(f"{target.provider}: {exc.reason}")
                logger.warning("Provider %s failed, falling through: %s", target.provider, exc.reason)
                self._last_cause = exc.cause

        raise AllProvidersFailedError(
            "no LLM provider could serve the request — " + "; ".join(errors)
        ) from self._last_cause

    async def _generate_on(
        self,
        target: Target,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None,
    ) -> str | BaseModel:
        if target.pool is None:
            import time
            now = time.time()
            if now < target._dead_until:
                raise _TargetFailed(f"endpoint benched for {target._dead_until - now:.0f}s due to failures")

            # Keyless provider (Ollama, open custom endpoint): nothing to
            # rotate, the adapter's own retry applies.
            adapter = target.adapter_for(0, None)
            try:
                result = await adapter.generate(system_prompt, messages, response_schema)
                target._consecutive_failures = 0
                target._dead_until = 0.0
                return result
            except (httpx.HTTPStatusError, LLMTimeoutError, LLMConnectionError) as exc:
                if isinstance(exc, httpx.HTTPStatusError):
                    status = exc.response.status_code
                    if status not in _FATAL_STATUS and status not in _RETRYABLE_STATUS and status != 429:
                        raise exc
                
                target._consecutive_failures += 1
                if target._consecutive_failures >= 3:
                    target._dead_until = time.time() + 60.0
                    logger.warning("Endpoint %s benched for 60s after 3 consecutive failures", target.provider)
                raise _TargetFailed(_describe(exc), exc) from exc

        attempts = min(self._max_key_attempts, max(1, len(target.pool)))
        last: Exception | None = None

        for _ in range(attempts):
            slot: KeySlot = await target.pool.acquire()
            try:
                result = await target.adapter_for(slot.key_id, slot.secret).generate(
                    system_prompt, messages, response_schema
                )
            except httpx.HTTPStatusError as exc:
                last = exc
                status = exc.response.status_code
                if status in _FATAL_STATUS:
                    logger.warning(
                        "%s key %s rejected (HTTP %d); retiring it",
                        target.provider,
                        slot.label or slot.key_id,
                        status,
                    )
                    await target.pool.report_fatal(slot)
                elif status == 429:
                    await target.pool.report_rate_limited(slot, _retry_after(exc))
                elif status in _RETRYABLE_STATUS:
                    await target.pool.report_error(slot, _retry_after(exc))
                else:
                    # 400-class request problem: another key will fail the same way.
                    raise exc
            except (LLMTimeoutError, LLMConnectionError, httpx.TimeoutException, httpx.ConnectError) as exc:
                last = exc
                await target.pool.report_error(slot)
            else:
                await target.pool.report_success(slot)
                return result
            finally:
                await target.pool.release(slot)

        raise _TargetFailed(
            f"all {attempts} key attempt(s) failed — {_describe(last)}", last
        ) from last


class _TargetFailed(Exception):
    """Internal: this provider is out of options, try the next one in the chain."""

    def __init__(self, reason: str, cause: Exception | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.cause = cause


def _describe(exc: Exception | None) -> str:
    if exc is None:
        return "unknown error"
    if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
        return f"HTTP {exc.response.status_code}"
    return f"{type(exc).__name__}: {exc}"
