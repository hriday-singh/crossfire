"""
Owner: Dev A. Provider registry/factory — the one place that maps a provider
name to a concrete LLMProvider. Add a new provider by adding one line to
_REGISTRY; nothing else in the codebase should hardcode which provider it's
talking to (docs/00-CONTRACTS.md #2).
"""
from __future__ import annotations

from config import get_settings
from providers.anthropic import AnthropicProvider
from providers.base import LLMProvider
from providers.gemini import GeminiProvider
from providers.openai_compat import OpenAICompatibleProvider

_REGISTRY: dict[str, type] = {
    "gemini": GeminiProvider,
    "anthropic": AnthropicProvider,
    "openai_compat": OpenAICompatibleProvider,
}


def get_provider(name: str | None = None, api_key: str | None = None) -> LLMProvider:
    """Build the LLMProvider named by `name` (defaults to settings.llm_provider),
    optionally overriding its API key (defaults to settings.llm_api_key, falling
    back to that provider's own *_API_KEY env var)."""
    settings = get_settings()
    name = (name or settings.llm_provider).lower()
    key = api_key or settings.llm_api_key or None
    try:
        provider_cls = _REGISTRY[name]
    except KeyError:
        raise ValueError(f"unknown LLM provider {name!r} — choices: {sorted(_REGISTRY)}") from None
    return provider_cls(api_key=key) if key else provider_cls()
