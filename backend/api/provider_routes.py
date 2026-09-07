"""
Owner: Dev A. Provider/model selection and API-key management for the web UI.

Everything the settings screen needs: the provider catalog for the dropdowns,
the active provider/model, the fallback order, and CRUD over the encrypted key
store. Keys go in over this API and never come back out — responses carry only
the masked hint from providers/keyring.py.

Note this API is as privileged as the machine it runs on: anything that can
reach the backend can write credentials to it. Crossfire binds to localhost and
restricts CORS to its own frontend; putting it on a shared host needs auth in
front of these routes first.
"""
from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

import providers
from providers import keyring
from providers.catalog import CATALOG, OLLAMA, get_spec

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/providers", tags=["providers"])


# ------------------------------------------------------------------- schemas


class KeyOut(BaseModel):
    id: int
    provider: str
    label: str
    hint: str = Field(description="Masked credential, e.g. 'AIza...9f2c'. Never the raw key.")
    enabled: bool


class ProviderOut(BaseModel):
    id: str
    label: str
    requires_key: bool
    editable_base_url: bool
    base_url: str
    model: str
    models: list[str]
    rpm: int
    key_count: int
    configured: bool
    notes: str


class ProvidersResponse(BaseModel):
    active: str
    fallback_chain: list[str]
    providers: list[ProviderOut]


class AddKeyRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=500)
    label: str = Field(default="", max_length=100)


class UpdateKeyRequest(BaseModel):
    enabled: bool


class ProviderConfigRequest(BaseModel):
    model: str | None = Field(default=None, max_length=200)
    base_url: str | None = Field(default=None, max_length=500)
    rpm: int | None = Field(default=None, ge=0, le=10000)


class ActiveProviderRequest(ProviderConfigRequest):
    provider: str


class FallbackChainRequest(BaseModel):
    chain: list[str] = Field(default_factory=list, max_length=len(CATALOG))


class TestProviderRequest(ProviderConfigRequest):
    api_key: str | None = Field(default=None, max_length=500)


class TestProviderResponse(BaseModel):
    ok: bool
    provider: str
    model: str
    detail: str


# --------------------------------------------------------------------- reads


def _provider_out(provider_id: str) -> ProviderOut:
    spec = get_spec(provider_id)
    config = keyring.get_config(provider_id)
    key_count = len(keyring.list_keys(provider_id))
    return ProviderOut(
        id=spec.id,
        label=spec.label,
        requires_key=spec.requires_key,
        editable_base_url=spec.editable_base_url,
        base_url=config.base_url,
        model=config.model,
        models=list(spec.models),
        rpm=config.rpm,
        key_count=key_count,
        configured=bool(config.base_url) and (key_count > 0 or not spec.requires_key),
        notes=spec.notes,
    )


@router.get("", response_model=ProvidersResponse)
def list_providers() -> ProvidersResponse:
    """Everything the provider/model dropdowns need, in one call."""
    return ProvidersResponse(
        active=keyring.get_active_provider(),
        fallback_chain=keyring.get_fallback_chain(),
        providers=[_provider_out(provider_id) for provider_id in CATALOG],
    )


@router.get("/pool/status")
def pool_status() -> dict:
    """Live per-key scheduling state — how the run is split across keys."""
    provider = providers.get_routing_provider()
    return {
        "chain": [
            {
                "provider": target.provider,
                "model": target.model,
                "base_url": target.base_url,
                "keys": len(target.pool) if target.pool else 0,
                "capacity": target.pool.capacity if target.pool else None,
                "stats": target.pool.stats().__dict__ if target.pool else None,
            }
            for target in provider.targets
        ]
    }


@router.get("/ollama/models")
async def ollama_models() -> dict:
    """Models actually pulled on the configured Ollama host."""
    config = keyring.get_config(OLLAMA)
    host = config.base_url.rstrip("/").removesuffix("/v1")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{host}/api/tags")
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Ollama not reachable at {host}: {exc}",
        ) from exc
    return {"models": [m.get("name", "") for m in data.get("models", []) if m.get("name")]}


# -------------------------------------------------------------------- writes


@router.put("/active", response_model=ProvidersResponse)
def set_active(payload: ActiveProviderRequest) -> ProvidersResponse:
    """Select the provider (and optionally its model) the pipeline runs on."""
    _require_known(payload.provider)
    keyring.set_config(
        payload.provider, model=payload.model, base_url=payload.base_url, rpm=payload.rpm
    )
    keyring.set_active_provider(payload.provider)
    providers.invalidate_cache()
    return list_providers()


@router.put("/fallback", response_model=ProvidersResponse)
def set_fallback(payload: FallbackChainRequest) -> ProvidersResponse:
    """Order in which other providers are tried once the active one is rate-limited."""
    for provider_id in payload.chain:
        _require_known(provider_id)
    keyring.set_fallback_chain(payload.chain)
    providers.invalidate_cache()
    return list_providers()


@router.put("/{provider_id}/config", response_model=ProviderOut)
def set_provider_config(provider_id: str, payload: ProviderConfigRequest) -> ProviderOut:
    _require_known(provider_id)
    keyring.set_config(
        provider_id, model=payload.model, base_url=payload.base_url, rpm=payload.rpm
    )
    providers.invalidate_cache()
    return _provider_out(provider_id)


@router.get("/{provider_id}/keys", response_model=list[KeyOut])
def list_provider_keys(provider_id: str) -> list[KeyOut]:
    _require_known(provider_id)
    return [KeyOut(**key.__dict__) for key in keyring.list_keys(provider_id)]


@router.post("/{provider_id}/keys", response_model=KeyOut, status_code=status.HTTP_201_CREATED)
def add_provider_key(provider_id: str, payload: AddKeyRequest) -> KeyOut:
    """Store one more key for this provider. Multiple keys are rotated across."""
    _require_known(provider_id)
    try:
        stored = keyring.add_key(provider_id, payload.api_key, payload.label)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    providers.invalidate_cache()
    return KeyOut(**stored.__dict__)


@router.patch("/keys/{key_id}", response_model=list[KeyOut])
def update_provider_key(key_id: int, payload: UpdateKeyRequest) -> list[KeyOut]:
    if not keyring.set_key_enabled(key_id, payload.enabled):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")
    providers.invalidate_cache()
    return [KeyOut(**key.__dict__) for key in keyring.list_keys()]


@router.delete("/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_provider_key(key_id: int) -> None:
    if not keyring.delete_key(key_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")
    providers.invalidate_cache()


@router.post("/{provider_id}/test", response_model=TestProviderResponse)
async def test_provider(provider_id: str, payload: TestProviderRequest) -> TestProviderResponse:
    """One cheap live call, so a wrong key fails here and not mid-run.

    Accepts an unsaved `api_key` so the UI can validate before storing it.
    """
    _require_known(provider_id)
    adapter = providers.build_adapter(
        provider_id,
        api_key=payload.api_key,
        model=payload.model,
        base_url=payload.base_url,
    )
    model = getattr(adapter, "_model", payload.model or "")
    try:
        reply = await adapter.generate(
            system_prompt="Reply with the single word: ok",
            messages=[{"role": "user", "content": "ping"}],
        )
        return TestProviderResponse(
            ok=True, provider=provider_id, model=model, detail=str(reply)[:200]
        )
    except httpx.HTTPStatusError as exc:
        return TestProviderResponse(
            ok=False,
            provider=provider_id,
            model=model,
            detail=f"HTTP {exc.response.status_code}: {exc.response.text[:200]}",
        )
    except Exception as exc:
        return TestProviderResponse(
            ok=False, provider=provider_id, model=model, detail=f"{type(exc).__name__}: {exc}"[:300]
        )
    finally:
        close = getattr(adapter, "aclose", None)
        if close is not None:
            await close()


def _require_known(provider_id: str) -> None:
    if provider_id not in CATALOG:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown provider {provider_id!r} — choices: {sorted(CATALOG)}",
        )
