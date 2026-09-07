"""
Owner: Dev A. The settings API behind the provider/model dropdown.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import providers
from providers import keyring


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
        "gemini_proxy",
        "gemini",
        "openai",
        "anthropic",
        "ollama",
        "custom",
    }
    assert body["active"] == "gemini_proxy"
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


def test_selecting_provider_and_model_is_what_the_pipeline_then_uses(client):
    client.post("/providers/anthropic/keys", json={"api_key": "sk-ant-abcdefgh12345678"})

    body = client.put(
        "/providers/active", json={"provider": "anthropic", "model": "claude-opus-5"}
    ).json()

    assert body["active"] == "anthropic"
    chain = providers.get_provider().targets
    assert chain[0].provider == "anthropic"
    assert chain[0].model == "claude-opus-5"


def test_fallback_chain_is_applied_in_order(client):
    client.post("/providers/gemini/keys", json={"api_key": "AIzaSyFALLBACK00001"})
    client.post("/providers/openai/keys", json={"api_key": "sk-fallback-000000002"})
    client.put("/providers/active", json={"provider": "gemini"})

    client.put("/providers/fallback", json={"chain": ["openai", "gemini_proxy"]})

    assert [t.provider for t in providers.get_provider().targets] == [
        "gemini",
        "openai",
        "gemini_proxy",
    ]


def test_providers_without_credentials_are_dropped_from_the_chain(client):
    client.put("/providers/fallback", json={"chain": ["anthropic"]})

    # anthropic requires a key and has none, so it must not enter the chain.
    assert [t.provider for t in providers.get_provider().targets] == ["gemini_proxy"]


def test_every_configured_key_becomes_a_pool_slot(client):
    for i in range(4):
        client.post("/providers/gemini/keys", json={"api_key": f"AIzaSyPOOLKEY0000{i}"})
    client.put("/providers/active", json={"provider": "gemini"})

    status = client.get("/providers/pool/status").json()
    assert status["chain"][0]["keys"] == 4
    assert status["chain"][0]["capacity"] == 8  # 4 keys x KEY_POOL_MAX_INFLIGHT


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
