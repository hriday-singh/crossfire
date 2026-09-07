"""
Owner: Dev A. Static description of every LLM provider Crossfire can talk to.

Direct HTTP only — no vendor SDKs. Each entry names the REST base URL, whether
a user-supplied key is required, and the model ids the UI offers in its
dropdown. Adding a provider is one entry here plus (only if its wire format is
not OpenAI-compatible) one adapter class.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field, replace
from config import get_settings

GEMINI = "gemini"
GEMINI_PROXY = "gemini_proxy"
OPENAI = "openai"
ANTHROPIC = "anthropic"
OLLAMA = "ollama"
CUSTOM = "custom"

#: Ids of user-added endpoints: "custom:openrouter", "custom:vllm-box".
CUSTOM_PREFIX = "custom:"
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")


@dataclass(frozen=True)
class ProviderSpec:
    id: str
    label: str
    #: "openai_compat" -> providers.openai_compat.OpenAICompatibleProvider,
    #: "anthropic" -> providers.anthropic.AnthropicProvider.
    wire: str
    base_url: str
    requires_key: bool
    #: base_url is per-install (self-hosted proxy, Ollama host, custom gateway)
    editable_base_url: bool
    default_model: str
    models: list[str] = field(default_factory=list)
    #: free-tier requests/minute per key; 0 = don't pace. See providers/pool.py.
    default_rpm: int = 0
    notes: str = ""


CATALOG: dict[str, ProviderSpec] = {
    GEMINI_PROXY: ProviderSpec(
        id=GEMINI_PROXY,
        label="Gemini Proxy (default)",
        wire="openai_compat",
        base_url=get_settings().llm_base_url,
        requires_key=False,
        editable_base_url=True,
        default_model=get_settings().llm_model,
        models=list(dict.fromkeys([get_settings().llm_model, "gemini-3.8-flash", "gemini-3.5-pro", "gemini-3.1-pro"])),
        notes="Crossfire's bundled gemini-web2api proxy. No API key needed.",
    ),
    GEMINI: ProviderSpec(
        id=GEMINI,
        label="Google Gemini",
        wire="openai_compat",
        # Google's own OpenAI-compatible surface — same /chat/completions shape.
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        requires_key=True,
        editable_base_url=False,
        default_model="gemini-3.8-flash",
        models=[
            "gemini-3.8-flash",
            "gemini-3.5-pro",
            "gemini-3.1-pro",
            "gemini-3.5-flash-lite",
        ],
        default_rpm=10,
        notes="Free-tier keys rate-limit hard; add several and Crossfire shards across them.",
    ),
    OPENAI: ProviderSpec(
        id=OPENAI,
        label="OpenAI",
        wire="openai_compat",
        base_url="https://api.openai.com/v1",
        requires_key=True,
        editable_base_url=False,
        default_model="gpt-5.6-luna",
        models=["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5", "gpt-4o"],
    ),
    ANTHROPIC: ProviderSpec(
        id=ANTHROPIC,
        label="Claude (Anthropic)",
        wire="anthropic",
        base_url="https://api.anthropic.com/v1",
        requires_key=True,
        editable_base_url=False,
        default_model="claude-sonnet-5",
        models=["claude-fable-5-1", "claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"],
    ),
    OLLAMA: ProviderSpec(
        id=OLLAMA,
        label="Ollama (local)",
        wire="openai_compat",
        base_url="http://localhost:11434/v1",
        requires_key=False,
        editable_base_url=True,
        default_model="llama3.1",
        models=["llama3.1", "qwen2.5", "mistral", "gemma3"],
        notes="Model list is discovered live from /api/tags when the host is reachable.",
    ),
    CUSTOM: ProviderSpec(
        id=CUSTOM,
        label="Custom OpenAI-compatible endpoint",
        wire="openai_compat",
        base_url="",
        requires_key=False,
        editable_base_url=True,
        default_model="",
        models=[],
        notes="Any gateway that speaks POST {base_url}/chat/completions.",
    ),
}

DEFAULT_PROVIDER = GEMINI_PROXY


def slugify(name: str) -> str:
    """'My vLLM Box!' -> 'my-vllm-box'. Raises if nothing usable survives."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")[:32].rstrip("-")
    if not _SLUG_RE.match(slug):
        raise ValueError(f"{name!r} has no letters or digits to name an endpoint with")
    return slug


def custom_id(name: str) -> str:
    return CUSTOM_PREFIX + slugify(name)


def is_custom(provider_id: str) -> bool:
    """True for a user-added endpoint — the only kind that can be deleted."""
    return provider_id.startswith(CUSTOM_PREFIX)


def custom_label(provider_id: str) -> str:
    return provider_id[len(CUSTOM_PREFIX):]



def get_spec(provider_id: str) -> ProviderSpec:
    """The static description of a provider.

    User-added endpoints have no CATALOG entry — they are the CUSTOM spec with
    their own id, and their base_url/model come from provider_config.
    """
    spec = CATALOG.get(provider_id)
    if spec is not None:
        return spec
    if is_custom(provider_id) and _SLUG_RE.match(custom_label(provider_id)):
        return replace(CATALOG[CUSTOM], id=provider_id, label=custom_label(provider_id))
    raise ValueError(
        f"unknown provider {provider_id!r} — choices: {sorted(CATALOG)} or a 'custom:<name>' endpoint"
    )
