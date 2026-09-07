"""
Owner: Dev A. Claude adapter — direct HTTP against the Anthropic Messages API.

No SDK: POST {base_url}/messages with `x-api-key` + `anthropic-version`. The
wire shape is the one thing that differs from OpenAI-compatible providers
(system prompt is a top-level field, not a message; text comes back as a
content-block list), so it gets its own class. Structured output uses the same
schema-in-the-system-prompt approach as providers/openai_compat.py.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from providers.openai_compat import (
    LLMConnectionError,
    LLMFormatError,
    LLMTimeoutError,
    _clean_json_markdown,
    _safe_request,
    _snippet,
)

logger = logging.getLogger(__name__)

ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_BASE_URL = "https://api.anthropic.com/v1"
DEFAULT_MODEL = "claude-sonnet-5"
DEFAULT_MAX_TOKENS = 8192


class AnthropicProvider:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        client: httpx.AsyncClient | None = None,
        timeout: float | None = None,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        retry_transient: bool = True,
    ) -> None:
        from config import get_settings

        settings = get_settings()
        self._api_key = api_key or settings.anthropic_api_key or ""
        self._base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self._model = model or DEFAULT_MODEL
        self._timeout = timeout or getattr(settings, "llm_timeout_seconds", 90.0)
        self._max_tokens = max_tokens
        self._retry_transient = retry_transient
        self._client = client
        self._owns_client = client is None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(
                    timeout=self._timeout,
                    connect=15.0,
                    read=self._timeout,
                    write=15.0,
                    pool=15.0,
                ),
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            )
            self._owns_client = True
        return self._client

    async def aclose(self) -> None:
        if self._owns_client and self._client is not None:
            try:
                await self._client.aclose()
            except Exception:
                pass
            self._client = None

    async def __aenter__(self) -> AnthropicProvider:
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.aclose()

    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel:
        system = system_prompt or ""
        if response_schema is not None:
            schema_json = json.dumps(response_schema.model_json_schema())
            system += (
                f"\nYou must respond with valid JSON strictly conforming to this schema:\n"
                f"{schema_json}\nReturn raw JSON only, without commentary."
            )

        attempts = 2 if self._retry_transient else 1
        last_content = ""
        last_error: Exception | None = None

        for attempt in range(attempts):
            try:
                last_content = await self._complete(system, self._to_anthropic_messages(messages))
            except httpx.TimeoutException as exc:
                if attempt + 1 < attempts:
                    logger.warning("Claude call timed out after %.1fs; retrying", self._timeout)
                    await self.aclose()
                    continue
                raise LLMTimeoutError(
                    f"{self._model} timed out after {self._timeout}s: {_snippet(str(exc))}",
                    request=_safe_request(exc),
                ) from exc
            except httpx.ConnectError as exc:
                if attempt + 1 < attempts:
                    logger.warning("Claude connection failed; retrying: %s", exc)
                    await self.aclose()
                    continue
                raise LLMConnectionError(
                    f"Failed to connect to Anthropic at {self._base_url}: {_snippet(str(exc))}",
                    request=_safe_request(exc),
                ) from exc

            if response_schema is None:
                return last_content
            try:
                return response_schema.model_validate_json(_clean_json_markdown(last_content))
            except ValidationError as exc:
                last_error = exc
                if attempt + 1 >= attempts:
                    break

        raise LLMFormatError(
            f"{self._model} did not return valid {response_schema.__name__} JSON "  # type: ignore[union-attr]
            f"after {attempts} attempt(s); upstream said: {_snippet(last_content)}"
        ) from last_error

    @staticmethod
    def _to_anthropic_messages(messages: list[dict]) -> list[dict[str, Any]]:
        """Drop system turns (Anthropic takes those top-level) and normalise roles.

        The Messages API rejects a conversation that does not start with a user
        turn, so a leading assistant turn is prefixed with a placeholder rather
        than 400-ing mid-run.
        """
        converted: list[dict[str, Any]] = []
        for message in messages:
            role = message.get("role", "user")
            if role == "system":
                continue
            converted.append(
                {
                    "role": "assistant" if role == "assistant" else "user",
                    "content": message.get("content", ""),
                }
            )
        if not converted:
            converted = [{"role": "user", "content": "Proceed."}]
        elif converted[0]["role"] != "user":
            converted.insert(0, {"role": "user", "content": "Continue."})
        return converted

    async def _complete(self, system: str, messages: list[dict[str, Any]]) -> str:
        payload: dict[str, Any] = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "messages": messages,
        }
        if system:
            payload["system"] = system

        client = await self._get_client()
        resp = await client.post(
            f"{self._base_url}/messages",
            json=payload,
            headers={
                "content-type": "application/json",
                "x-api-key": self._api_key,
                "anthropic-version": ANTHROPIC_VERSION,
            },
        )
        resp.raise_for_status()
        data = resp.json()

        return "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )
