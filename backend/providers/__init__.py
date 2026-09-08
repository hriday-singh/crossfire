"""
Owner: Dev A. Provider registry/factory — the one place that maps a provider
name to a concrete LLMProvider. Add a new provider by adding one entry to
providers/catalog.py; nothing else in the codebase should hardcode which
provider it's talking to (docs/00-CONTRACTS.md #2).

`get_provider()` returns a RoutingProvider built from the user's saved
settings: their active provider, its saved model, its stored API keys as a
rotating pool, and their fallback chain behind it. The instance is cached and
rebuilt only when the settings change, so key cooldown state and httpx
connection pools survive across requests.
"""
from __future__ import annotations

import logging

from config import get_settings
from providers import keyring
from providers.anthropic import AnthropicProvider
from providers.base import LLMProvider
from providers.catalog import CATALOG, DEFAULT_PROVIDER, LOCKED_PROVIDER, ProviderSpec, get_spec
from providers.gemini import GeminiProvider
from providers.openai_compat import (
    LLMConnectionError,
    LLMFormatError,
    LLMProviderError,
    LLMTimeoutError,
    OpenAICompatibleProvider,
)
from providers.pool import KeyPool, KeySlot, PoolExhaustedError
from providers.routing import AllProvidersFailedError, RoutingProvider, Target

logger = logging.getLogger(__name__)

_WIRE_CLASSES: dict[str, type] = {
    "openai_compat": OpenAICompatibleProvider,
    "anthropic": AnthropicProvider,
}

# Legacy LLM_PROVIDER value, kept so existing .env files still boot. Everything
# else resolves straight to a providers/catalog.py id.
_LEGACY_ALIASES = {"openai_compat": DEFAULT_PROVIDER}

__all__ = [
    "AllProvidersFailedError",
    "AnthropicProvider",
    "GeminiProvider",
    "KeyPool",
    "LLMConnectionError",
    "LLMFormatError",
    "LLMProvider",
    "LLMProviderError",
    "LLMTimeoutError",
    "OpenAICompatibleProvider",
    "PoolExhaustedError",
    "RoutingProvider",
    "Target",
    "build_target",
    "get_provider",
    "invalidate_cache",
]

_cached: RoutingProvider | None = None
_cached_version: int = -1


def _env_keys(spec: ProviderSpec) -> list[str]:
    """Keys from .env, used when the encrypted store has none for this provider.

    Keeps existing single-key .env installs working, and lets a developer seed
    the whole Gemini rotation pool with GEMINI_API_KEYS=key1,key2,key3.
    """
    settings = get_settings()
    raw: list[str] = []
    if spec.id == "gemini":
        raw.extend(k for k in getattr(settings, "gemini_api_keys", "").split(",") if k.strip())
        raw.append(settings.gemini_api_key)
    elif spec.id == "openai":
        raw.append(settings.openai_api_key)
    elif spec.id == "anthropic":
        raw.append(settings.anthropic_api_key)
    if spec.id == DEFAULT_PROVIDER:
        raw.append(settings.llm_api_key)
    seen: list[str] = []
    for key in raw:
        key = key.strip()
        if key and key not in seen:
            seen.append(key)
    return seen


def build_target(provider_id: str, max_inflight_per_key: int | None = None) -> Target:
    """One entry of the fallback chain: saved model/base_url plus a key pool."""
    spec = get_spec(provider_id)
    config = keyring.get_config(provider_id)

    stored = keyring.secrets_for(provider_id)
    if not stored:
        stored = [(-(i + 1), key) for i, key in enumerate(_env_keys(spec))]

    pool: KeyPool | None = None
    if stored:
        slots = [
            KeySlot(key_id=key_id, secret=secret, label=keyring.mask(secret))
            for key_id, secret in stored
        ]
        settings = get_settings()
        pool = KeyPool(
            provider=provider_id,
            slots=slots,
            rpm=config.rpm,
            max_inflight_per_key=max_inflight_per_key
            or getattr(settings, "key_pool_max_inflight", 2),
        )

    return Target(
        provider=provider_id,
        wire=spec.wire,
        model=config.model or spec.default_model,
        base_url=config.base_url or spec.base_url,
        pool=pool,
    )


def build_chain() -> list[Target]:
    """One target per enabled model per provider in the fallback chain.
    
    The primary provider's models are tried first (in the order they are enabled),
    followed by the models of each provider in the fallback chain.
    """
    providers = []
    if LOCKED_PROVIDER:
        providers = [LOCKED_PROVIDER]
    else:
        active = keyring.get_active_provider()
        chain = keyring.get_fallback_chain()
        providers = [active]
        for p in chain:
            if p not in providers:
                providers.append(p)
                
    targets = []
    for provider_id in providers:
        base = build_target(provider_id)
        models = keyring.get_enabled_models(provider_id) or [base.model]
        
        for model in models:
            targets.append(
                Target(
                    provider=provider_id,
                    wire=base.wire,
                    model=model,
                    base_url=base.base_url,
                    pool=base.pool,
                )
            )
            
    return targets


def invalidate_cache() -> None:
    global _cached, _cached_version
    _cached = None
    _cached_version = -1


def get_provider(name: str | None = None, api_key: str | None = None) -> LLMProvider:
    """The LLMProvider the pipeline should use.

    With no arguments: the user's saved provider chain, key rotation included.
    With `name`/`api_key`: a single bare adapter for that provider — used by the
    settings "test this key" endpoint and by scripts that pin one provider.
    """
    if name is None and api_key is None:
        return get_routing_provider()

    provider_id = _LEGACY_ALIASES.get((name or "").lower(), (name or "").lower()) or DEFAULT_PROVIDER
    if provider_id not in CATALOG:
        raise ValueError(f"unknown LLM provider {name!r} — choices: {sorted(CATALOG)}")
    return build_adapter(provider_id, api_key=api_key)


def build_adapter(
    provider_id: str,
    api_key: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
) -> LLMProvider:
    """A single-key adapter with no pooling or fallback (key validation, scripts)."""
    spec = get_spec(provider_id)
    config = keyring.get_config(provider_id)
    if not api_key:
        stored = keyring.secrets_for(provider_id)
        api_key = stored[0][1] if stored else (_env_keys(spec) or [None])[0]

    cls = _WIRE_CLASSES[spec.wire]
    return cls(
        api_key=api_key,
        base_url=base_url or config.base_url or spec.base_url,
        model=model or config.model or spec.default_model,
    )


def get_routing_provider() -> RoutingProvider:
    global _cached, _cached_version
    version = keyring.config_version()
    if _cached is None or _cached_version != version:
        _cached = RoutingProvider(build_chain())
        _cached_version = version
        logger.info(
            "LLM chain: %s",
            " -> ".join(
                f"{t.provider}/{t.model}" + (f"({len(t.pool)} keys)" if t.pool else "")
                for t in _cached.targets
            ),
        )
    return _cached
