"""
Owner: Dev A. Ask an endpoint which models it serves.

Gateways disagree on where the list lives, so this tries the usual places in
order and returns the first non-empty answer: OpenAI-style `{base}/models`
(OpenAI, Gemini's compat surface, vLLM, LM Studio, OpenRouter, LiteLLM...),
the same under `/v1` for a base URL given without it, then Ollama's native
`/api/tags`. Anthropic's `/models` takes its own auth headers.
"""
from __future__ import annotations

import httpx

TIMEOUT_SECONDS = 8.0


class DiscoveryError(RuntimeError):
    """No candidate URL produced a model list. The message lists every attempt."""


def candidate_urls(base_url: str, wire: str) -> list[str]:
    base = base_url.strip().rstrip("/")
    if wire == "anthropic":
        return [f"{base}/models?limit=1000"]
    root = base.removesuffix("/v1")
    urls = [f"{base}/models"]
    if not base.endswith("/v1"):
        urls.append(f"{base}/v1/models")
    urls.append(f"{root}/api/tags")
    return list(dict.fromkeys(urls))


def auth_headers(wire: str, api_key: str | None) -> dict[str, str]:
    if wire == "anthropic":
        headers = {"anthropic-version": "2023-06-01"}
        return {**headers, "x-api-key": api_key} if api_key else headers
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


def parse_models(payload: object) -> list[str]:
    """Model ids from `{"data": [{"id"}]}`, `{"models": [{"name"}]}` or a bare list."""
    if isinstance(payload, dict):
        items = payload.get("data") or payload.get("models") or []
    else:
        items = payload
    if not isinstance(items, list):
        return []
    ids: list[str] = []
    for item in items:
        value = item.get("id") or item.get("name") or item.get("model") if isinstance(item, dict) else item
        if isinstance(value, str) and value.strip():
            ids.append(value.strip().removeprefix("models/"))  # Gemini prefixes ids
    return list(dict.fromkeys(ids))


async def discover_models(
    base_url: str,
    wire: str = "openai_compat",
    api_key: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> list[str]:
    if not base_url.strip():
        raise DiscoveryError("no base URL configured")
    owned = client is None
    client = client or httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=True)
    attempts: list[str] = []
    try:
        for url in candidate_urls(base_url, wire):
            try:
                resp = await client.get(url, headers=auth_headers(wire, api_key))
                resp.raise_for_status()
                models = parse_models(resp.json())
            except httpx.HTTPStatusError as exc:
                attempts.append(f"{url} -> HTTP {exc.response.status_code}")
                continue
            except Exception as exc:  # unreachable host, non-JSON body, ...
                attempts.append(f"{url} -> {type(exc).__name__}")
                continue
            if models:
                return models
            attempts.append(f"{url} -> no models in response")
    finally:
        if owned:
            await client.aclose()
    raise DiscoveryError("; ".join(attempts))
