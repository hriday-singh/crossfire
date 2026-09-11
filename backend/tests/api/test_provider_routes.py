"""
Owner: Dev A. The settings API behind the provider/model dropdown.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import providers
from providers import keyring
from providers.catalog import GEMINI_MODELS


@pytest.fixture
def client():
    from main import app

    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_keyring():
    keyring.clear()
    providers.invalidate_cache()
    yield
    keyring.clear()
    providers.invalidate_cache()


def test_catalog_lists_every_supported_provider(client):
    body = client.get("/providers").json()

    assert {p["id"] for p in body["providers"]} == {
        "gemini",
        "openai",
        "anthropic",
        "ollama",
        "deepseek",
        "custom",
    }
    assert body["active"] == "ollama"
    assert body["fallback_chain"] == []


def test_catalog_carries_the_model_options_for_the_dropdown(client):
    body = client.get("/providers").json()
    anthropic = next(p for p in body["providers"] if p["id"] == "anthropic")

    assert anthropic["requires_key"] is True
    assert anthropic["editable_base_url"] is False
    assert anthropic["base_url"] == "https://api.anthropic.com/v1"
    assert anthropic["model"] in anthropic["models"]
    assert anthropic["configured"] is False  # no key yet


def test_add_key_returns_a_mask_not_the_key(client):
    response = client.post(
        "/providers/gemini/keys", json={"api_key": "AIzaSyTOPSECRET0123456", "label": "personal"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["hint"] == "AIza...3456"
    assert "AIzaSyTOPSECRET0123456" not in response.text
    assert "api_key" not in body


def test_stored_keys_are_never_echoed_by_any_read_endpoint(client):
    secret = "sk-never-echo-this-value-42"
    client.post("/providers/openai/keys", json={"api_key": secret})

    for path in ("/providers", "/providers/openai/keys", "/providers/pool/status"):
        assert secret not in client.get(path).text


def test_multiple_keys_stack_up_for_one_provider(client):
    for i in range(3):
        client.post("/providers/gemini/keys", json={"api_key": f"AIzaSyKEY000000000{i}"})

    listed = client.get("/providers/gemini/keys").json()
    assert len(listed) == 3

    catalog = client.get("/providers").json()
    gemini = next(p for p in catalog["providers"] if p["id"] == "gemini")
    assert gemini["key_count"] == 3
    assert gemini["configured"] is True


def test_disabling_and_deleting_a_key(client):
    created = client.post("/providers/openai/keys", json={"api_key": "sk-toggle-me-123456"}).json()

    patched = client.patch(f"/providers/keys/{created['id']}", json={"enabled": False}).json()
    assert patched[0]["enabled"] is False

    assert client.delete(f"/providers/keys/{created['id']}").status_code == 204
    assert client.get("/providers/openai/keys").json() == []
    assert client.delete(f"/providers/keys/{created['id']}").status_code == 404


def test_gemini_catalog_entry_lists_its_models(client):
    body = client.get("/providers").json()
    by_id = {p["id"]: p for p in body["providers"]}

    assert by_id["gemini"]["models"] == GEMINI_MODELS


def test_selecting_a_model_is_what_the_pipeline_then_uses(client):
    body = client.put(
        "/providers/active", json={"provider": "gemini", "model": "gemini-3.6-flash"}
    ).json()

    assert body["active"] == "gemini"
    assert providers.get_provider().targets[0].model == "gemini-3.6-flash"


def test_unpinned_routing_follows_selection(client):
    client.post("/providers/anthropic/keys", json={"api_key": "sk-ant-abcdefgh12345678"})
    client.put("/providers/active", json={"provider": "anthropic", "model": "claude-opus-5"})
    client.put("/providers/fallback", json={"chain": ["openai", "anthropic"]})

    # Since LOCKED_PROVIDER is None, cross-provider routing is active.
    body = client.get("/providers").json()
    assert body["active"] == "anthropic"
    assert body["locked_provider"] is None
    # Anthropic is active, openai and anthropic are fallbacks.
    # The chain deduplicates, so it will be anthropic, openai
    assert {t.provider for t in providers.get_provider().targets} == {"anthropic", "openai"}


def test_enabled_models_are_the_fallback_order(client):
    client.put("/providers/active", json={"provider": "gemini", "model": "gemini-3.6-flash"})

    body = client.put(
        "/providers/gemini/models",
        json={"models": ["gemini-flash-lite", "gemini-3.7-flash"]},
    ).json()

    # Primary first, then the enabled models in the order they were sent.
    assert body["enabled_models"] == [
        "gemini-3.6-flash",
        "gemini-flash-lite",
        "gemini-3.7-flash",
    ]
    assert [t.model for t in providers.get_provider().targets] == body["enabled_models"]


def test_disabled_models_leave_the_chain(client):
    client.put("/providers/active", json={"provider": "gemini"})
    client.put("/providers/gemini/models", json={"models": []})

    body = client.get("/providers").json()
    gemini = next(p for p in body["providers"] if p["id"] == "gemini")

    # Everything disabled still leaves the primary: it is the selected model.
    assert gemini["enabled_models"] == [gemini["model"]]
    assert [t.model for t in providers.get_provider().targets] == [gemini["model"]]


def test_every_configured_key_becomes_a_pool_slot(client):
    client.put("/providers/active", json={"provider": "gemini"})
    for i in range(4):
        client.post("/providers/gemini/keys", json={"api_key": f"AIzaSyPOOLKEY0000{i}"})

    status = client.get("/providers/pool/status").json()
    assert status["chain"][0]["keys"] == 4
    assert status["chain"][0]["capacity"] == 8  # 4 keys x KEY_POOL_MAX_INFLIGHT


def test_all_models_share_one_key_pool(client):
    client.post("/providers/gemini/keys", json={"api_key": "AIzaSySHAREDPOOL01"})

    targets = providers.get_provider().targets

    # One pool per provider, not per model: a key benched on one model stays
    # benched for the retry on the next.
    assert len({id(t.pool) for t in targets}) == 1


def test_custom_endpoint_accepts_a_user_supplied_base_url(client):
    body = client.put(
        "/providers/custom/config",
        json={"base_url": "https://gateway.internal/v1", "model": "house-model"},
    ).json()

    assert body["base_url"] == "https://gateway.internal/v1"
    assert body["model"] == "house-model"


def test_unknown_provider_is_a_404_everywhere(client):
    assert client.get("/providers/nope/keys").status_code == 404
    assert client.post("/providers/nope/keys", json={"api_key": "x" * 20}).status_code == 404
    assert client.put("/providers/active", json={"provider": "nope"}).status_code == 404


def test_health_reports_the_selected_provider(client):
    client.post("/providers/openai/keys", json={"api_key": "sk-health-check-1234"})
    client.put("/providers/active", json={"provider": "openai", "model": "gpt-4o"})

    body = client.get("/health").json()
    assert body["provider"] == "openai"
    assert body["model"] == "gpt-4o"


# ------------------------------------------------- multiple custom endpoints


def _custom(client, name, base_url, model="house-model", **extra):
    return client.post(
        "/providers/custom",
        json={"name": name, "base_url": base_url, "model": model, **extra},
    )


def test_several_custom_endpoints_coexist(client):
    _custom(client, "OpenRouter", "https://openrouter.ai/api/v1", model="mixtral")
    _custom(client, "vLLM Box", "http://10.0.0.5:8000/v1", model="qwen2.5-72b")

    body = client.get("/providers").json()
    added = {p["id"]: p for p in body["providers"] if p["removable"]}

    assert set(added) == {"custom:openrouter", "custom:vllm-box"}
    assert added["custom:openrouter"]["base_url"] == "https://openrouter.ai/api/v1"
    assert added["custom:vllm-box"]["model"] == "qwen2.5-72b"


def test_custom_endpoint_api_key_is_optional_and_stored_masked(client):
    keyless = _custom(client, "Open Gateway", "http://gw.internal/v1").json()
    keyed = _custom(
        client, "Paid Gateway", "https://paid.example/v1", api_key="sk-paid-000000001234"
    ).json()

    assert keyless["key_count"] == 0
    assert keyless["configured"] is True  # no key required for a custom endpoint
    assert keyed["key_count"] == 1

    keys = client.get("/providers/custom:paid-gateway/keys").json()
    assert keys[0]["hint"] == "sk-p...1234"
    assert "sk-paid-000000001234" not in client.get("/providers").text


def test_duplicate_custom_endpoint_name_is_rejected(client):
    assert _custom(client, "My Gateway", "http://a/v1").status_code == 201
    assert _custom(client, "my  gateway!", "http://b/v1").status_code == 409


def test_custom_endpoint_name_must_contain_something_usable(client):
    assert _custom(client, "---", "http://a/v1").status_code == 400


def test_custom_endpoints_keep_their_own_url_and_model(client):
    _custom(client, "First Backup", "http://one/v1", model="m1")
    _custom(client, "Second Backup", "http://two/v1", model="m2")

    # Not in the running chain while the provider is pinned, but still stored
    # and still buildable, so unpinning needs none of this re-entered.
    first = providers.build_target("custom:first-backup")
    second = providers.build_target("custom:second-backup")
    assert (first.base_url, first.model) == ("http://one/v1", "m1")
    assert (second.base_url, second.model) == ("http://two/v1", "m2")


def test_deleting_a_custom_endpoint_removes_its_keys_and_chain_entry(client):
    _custom(client, "Doomed", "http://doomed/v1", api_key="sk-doomed-0000000001")
    client.put("/providers/fallback", json={"chain": ["custom:doomed", "ollama"]})

    assert client.delete("/providers/custom:doomed").status_code == 204

    body = client.get("/providers").json()
    assert "custom:doomed" not in {p["id"] for p in body["providers"]}
    assert body["fallback_chain"] == ["ollama"]
    assert keyring.list_keys("custom:doomed") == []


def test_deleting_the_active_custom_endpoint_falls_back_to_the_default(client):
    _custom(client, "Solo", "http://solo/v1")
    client.put("/providers/active", json={"provider": "custom:solo"})

    client.delete("/providers/custom:solo")

    assert client.get("/providers").json()["active"] == "ollama"


def test_builtin_providers_cannot_be_deleted(client):
    assert client.delete("/providers/openai").status_code == 400
    assert client.delete("/providers/custom:ghost").status_code == 404


# ------------------------------------------------------- testing every link


class _StubAdapter:
    """Answers 'ok' unless what it was built for is on the dead list."""

    def __init__(self, model, base_url):
        self._model = model
        self._dead = "dead" in base_url or "lite" in model

    async def generate(self, system_prompt, messages, response_schema=None):
        if self._dead:
            raise ConnectionError("connection refused")
        return "ok"


def test_testing_the_chain_reports_one_row_per_enabled_model(client, monkeypatch):
    client.put("/providers/active", json={"provider": "gemini", "model": "gemini-3.7-flash"})
    client.put(
        "/providers/gemini/models",
        json={"models": ["gemini-3.6-flash", "gemini-flash-lite"]},
    )

    monkeypatch.setattr(
        providers,
        "build_adapter",
        lambda provider_id, model=None, **kw: _StubAdapter(model or "", ""),
    )

    rows = client.post("/providers/test").json()

    assert [(r["model"], r["ok"]) for r in rows] == [
        ("gemini-3.7-flash", True),
        ("gemini-3.6-flash", True),
        ("gemini-flash-lite", False),
    ]
    assert "ConnectionError" in rows[2]["detail"]


def test_a_single_provider_can_be_tested_with_an_unsaved_key(client, monkeypatch):
    monkeypatch.setattr(
        providers,
        "build_adapter",
        lambda provider_id, model=None, **kw: _StubAdapter("gpt-5.6-luna", "http://x/v1"),
    )

    body = client.post("/providers/openai/test", json={"api_key": "sk-unsaved-00000001"}).json()

    assert body == {"ok": True, "provider": "openai", "model": "gpt-5.6-luna", "detail": "ok"}


def test_activating_provider_removes_it_from_fallback_chain(client):
    client.put("/providers/fallback", json={"chain": ["openai", "anthropic"]})
    assert client.get("/providers").json()["fallback_chain"] == ["openai", "anthropic"]

    client.put("/providers/active", json={"provider": "openai"})
    body = client.get("/providers").json()
    assert body["active"] == "openai"
    assert body["fallback_chain"] == ["anthropic"]

