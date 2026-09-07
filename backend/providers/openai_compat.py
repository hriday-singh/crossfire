"""
Owner: Dev A. OpenAI-compatible provider adapter.
Supports local proxies (gemini-web2api, Ollama, vLLM) and OpenAI-compatible endpoints.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from config import get_settings

logger = logging.getLogger(__name__)


class LLMProviderError(RuntimeError):
    """Base error for upstream LLM provider failures."""


class LLMTimeoutError(LLMProviderError, httpx.TimeoutException):
    """Upstream LLM provider timed out."""

    def __init__(self, message: str, request: httpx.Request | None = None) -> None:
        super().__init__(message)
        self.request = request


class LLMConnectionError(LLMProviderError, httpx.ConnectError):
    """Unable to connect to upstream LLM provider."""

    def __init__(self, message: str, request: httpx.Request | None = None) -> None:
        super().__init__(message)
        self.request = request


class LLMFormatError(RuntimeError):
    """Upstream returned something that is not the requested JSON schema.

    Usually the proxy leaking its own failure text ("Sorry, something went wrong...")
    as a 200 completion, not the model actually misformatting."""


def _clean_json_markdown(text: str) -> str:
    """Strip markdown code fence blocks if present, with fallbacks for partial fences."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    # Fallback for opening fence without closing fence
    fence_start = re.search(r"```(?:json)?\s*([\s\S]+)", text)
    if fence_start:
        candidate = fence_start.group(1).strip()
        brace_end = candidate.rfind("}")
        if brace_end != -1:
            return candidate[: brace_end + 1].strip()
        return candidate
    # Fallback to extract outermost JSON object or array
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end > brace_start:
        return text[brace_start : brace_end + 1].strip()
    return text


def _safe_request(exc: Exception) -> httpx.Request | None:
    try:
        return getattr(exc, "request", None)
    except Exception:
        return None


def _snippet(text: str, limit: int = 160) -> str:
    """One-line, bounded quote of upstream output — safe to surface in a UI reason string."""
    flat = " ".join(text.split())
    if not flat:
        return "(empty response)"
    return flat if len(flat) <= limit else f"{flat[:limit]}..."


class OpenAICompatibleProvider:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        client: httpx.AsyncClient | None = None,
        timeout: float | None = None,
        retry_transient: bool = True,
    ) -> None:
        # retry_transient=False is for providers/routing.py: when a key pool is
        # in play, a 429 should rotate to the next key immediately rather than
        # burn two seconds retrying the key that just refused us.
        settings = get_settings()
        self._api_key = api_key or settings.llm_api_key or settings.openai_api_key or "none"
        self._base_url = (base_url or settings.llm_base_url or "http://localhost:8081/v1").rstrip("/")
        self._model = model or settings.llm_model or "gemini-3.7-flash"
        self._timeout = timeout or getattr(settings, "llm_timeout_seconds", 90.0)
        self._retry_transient = retry_transient
        self._client = client
        self._owns_client = client is None

    async def _get_client(self) -> httpx.AsyncClient:
        """Returns a persistent pooled httpx.AsyncClient, lazily initializing if needed."""
        if self._client is None or self._client.is_closed:
            limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
            timeout_config = httpx.Timeout(
                timeout=self._timeout,
                connect=15.0,
                read=self._timeout,
                write=15.0,
                pool=15.0,
            )
            self._client = httpx.AsyncClient(
                timeout=timeout_config,
                limits=limits,
            )
            self._owns_client = True
        return self._client

    async def _reset_client(self) -> None:
        """Closes and resets the pooled client on network error or timeout."""
        if self._owns_client and self._client is not None:
            try:
                await self._client.aclose()
            except Exception:
                pass
            self._client = None

    async def aclose(self) -> None:
        """Closes the underlying pooled client if owned by this provider."""
        await self._reset_client()

    async def __aenter__(self) -> OpenAICompatibleProvider:
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.aclose()

    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel:
        formatted_messages: list[dict[str, Any]] = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        formatted_messages.extend(messages)

        if response_schema is not None:
            schema_json = json.dumps(response_schema.model_json_schema())
            instruction = (
                f"\nYou must respond with valid JSON strictly conforming to this schema:\n{schema_json}\n"
                "Return raw JSON only, without commentary."
            )
            if formatted_messages and formatted_messages[0].get("role") == "system":
                formatted_messages[0]["content"] += f"\n{instruction}"
            else:
                formatted_messages.insert(0, {"role": "system", "content": instruction})

        attempts = 2 if self._retry_transient else 1

        if response_schema is None:
            for attempt in range(attempts):
                try:
                    return await self._complete(formatted_messages)
                except httpx.TimeoutException as exc:
                    if attempt + 1 < attempts:
                        logger.warning(
                            "LLM completion attempt 1 timed out after %.1fs; resetting connection and retrying...",
                            self._timeout,
                        )
                        await self._reset_client()
                        await asyncio.sleep(1.0)
                        continue
                    raise LLMTimeoutError(
                        f"{self._model} timed out after {self._timeout}s: {_snippet(str(exc))}",
                        request=_safe_request(exc),
                    ) from exc
                except httpx.ConnectError as exc:
                    if attempt + 1 < attempts:
                        logger.warning("LLM connection failed; resetting client and retrying: %s", exc)
                        await self._reset_client()
                        await asyncio.sleep(1.0)
                        continue
                    raise LLMConnectionError(
                        f"Failed to connect to LLM at {self._base_url}: {_snippet(str(exc))}",
                        request=_safe_request(exc),
                    ) from exc
                except httpx.HTTPStatusError as exc:
                    if attempt + 1 < attempts and exc.response.status_code in (429, 500, 502, 503, 504):
                        logger.warning(
                            "LLM completion attempt 1 returned HTTP %d; resetting client and retrying in 2s...",
                            exc.response.status_code,
                        )
                        await self._reset_client()
                        await asyncio.sleep(2.0)
                        continue
                    raise

        # One retry: a proxy that answers "Sorry, something went wrong" with a 200
        # or transient timeout is retried once.
        last_error: ValidationError | Exception | None = None
        last_content = ""
        for attempt in range(attempts):
            try:
                last_content = await self._complete(formatted_messages)
            except httpx.TimeoutException as exc:
                last_error = exc
                if attempt + 1 < attempts:
                    logger.warning(
                        "LLM structured completion attempt 1 timed out after %.1fs; retrying...",
                        self._timeout,
                    )
                    await self._reset_client()
                    await asyncio.sleep(1.0)
                    continue
                raise LLMTimeoutError(
                    f"{self._model} timed out after {self._timeout}s: {_snippet(str(exc))}",
                    request=_safe_request(exc),
                ) from exc
            except httpx.ConnectError as exc:
                last_error = exc
                if attempt + 1 < attempts:
                    logger.warning("LLM structured completion connection failed; retrying: %s", exc)
                    await self._reset_client()
                    await asyncio.sleep(1.0)
                    continue
                raise LLMConnectionError(
                    f"Failed to connect to LLM at {self._base_url}: {_snippet(str(exc))}",
                    request=_safe_request(exc),
                ) from exc
            except httpx.HTTPStatusError as exc:
                last_error = exc
                if attempt + 1 < attempts and exc.response.status_code in (429, 500, 502, 503, 504):
                    logger.warning(
                        "LLM structured completion attempt 1 returned HTTP %d; retrying in 2s...",
                        exc.response.status_code,
                    )
                    await self._reset_client()
                    await asyncio.sleep(2.0)
                    continue
                raise

            try:
                return response_schema.model_validate_json(_clean_json_markdown(last_content))
            except ValidationError as exc:
                last_error = exc

        raise LLMFormatError(
            f"{self._model} did not return valid {response_schema.__name__} JSON "
            f"after {attempts} attempts; upstream said: {_snippet(last_content)}"
        ) from last_error

    async def _complete(self, formatted_messages: list[dict[str, Any]]) -> str:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }
        payload = {
            "model": self._model,
            "messages": formatted_messages,
        }

        client = await self._get_client()
        resp = await client.post(
            f"{self._base_url}/chat/completions",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

        return data["choices"][0]["message"]["content"] or ""

