"""
Owner: Dev A. The one property that matters here: a stored API key is not
readable from the database, and never comes back out of any API-facing call.
"""
from __future__ import annotations

import sqlite3

import pytest

from providers import keyring


@pytest.fixture(autouse=True)
def clean_keyring():
    keyring.clear()
    yield
    keyring.clear()


def read_raw_rows() -> list[bytes]:
    conn = sqlite3.connect(str(keyring._db_path()))
    try:
        return [row[0] for row in conn.execute("SELECT ciphertext FROM provider_keys")]
    finally:
        conn.close()


def test_stored_key_round_trips_through_decryption():
    keyring.add_key("openai", "sk-test-abcdef123456", label="laptop")
    assert [secret for _, secret in keyring.secrets_for("openai")] == ["sk-test-abcdef123456"]


def test_plaintext_never_touches_the_database():
    secret = "sk-supersecret-value-9999"
    keyring.add_key("openai", secret)

    blobs = read_raw_rows()
    assert blobs
    assert all(secret.encode() not in blob for blob in blobs)


def test_listing_keys_returns_only_a_mask():
    keyring.add_key("gemini", "AIzaSyABCDEFGH12345678")
    listed = keyring.list_keys("gemini")

    assert len(listed) == 1
    assert listed[0].hint == "AIza...5678"
    assert "AIzaSyABCDEFGH12345678" not in listed[0].hint
    assert not hasattr(listed[0], "secret")


def test_mask_hides_short_secrets_entirely():
    assert keyring.mask("abc") == "***"
    assert keyring.mask("abcdefgh") == "********"


def test_multiple_keys_per_provider_are_all_returned_in_order():
    for i in range(3):
        keyring.add_key("gemini", f"AIza-key-number-{i}")

    assert [s for _, s in keyring.secrets_for("gemini")] == [
        "AIza-key-number-0",
        "AIza-key-number-1",
        "AIza-key-number-2",
    ]


def test_disabled_keys_are_excluded_from_the_rotation_pool():
    first = keyring.add_key("gemini", "AIza-key-number-0")
    keyring.add_key("gemini", "AIza-key-number-1")

    keyring.set_key_enabled(first.id, False)

    assert [s for _, s in keyring.secrets_for("gemini")] == ["AIza-key-number-1"]
    assert len(keyring.list_keys("gemini")) == 2  # still visible in the UI


def test_deleting_a_key_removes_it():
    stored = keyring.add_key("openai", "sk-delete-me-please")
    assert keyring.delete_key(stored.id) is True
    assert keyring.secrets_for("openai") == []
    assert keyring.delete_key(stored.id) is False


def test_empty_key_is_rejected():
    with pytest.raises(ValueError):
        keyring.add_key("openai", "   ")


def test_unknown_provider_is_rejected():
    with pytest.raises(ValueError):
        keyring.add_key("not-a-provider", "sk-whatever-123456")


def test_config_defaults_come_from_the_catalog():
    config = keyring.get_config("openai")
    assert config.base_url == "https://api.openai.com/v1"
    assert config.model == "gpt-5.6-luna"


def test_config_override_persists():
    keyring.set_config("openai", model="gpt-4o")
    assert keyring.get_config("openai").model == "gpt-4o"


def test_base_url_is_pinned_for_vendor_providers():
    # Redirecting "openai" elsewhere would ship the user's OpenAI key to a
    # third party; that is what the `custom` provider is for.
    keyring.set_config("openai", base_url="http://evil.test/v1")
    assert keyring.get_config("openai").base_url == "https://api.openai.com/v1"


def test_base_url_is_editable_for_ollama_and_custom():
    keyring.set_config("ollama", base_url="http://192.168.1.9:11434/v1")
    assert keyring.get_config("ollama").base_url == "http://192.168.1.9:11434/v1"

    keyring.set_config("custom", base_url="https://gateway.internal/v1", model="my-model")
    assert keyring.get_config("custom").base_url == "https://gateway.internal/v1"


def test_active_provider_defaults_to_ollama():
    assert keyring.get_active_provider() == "ollama"


def test_active_provider_persists_and_rejects_unknown_values():
    keyring.set_active_provider("anthropic")
    assert keyring.get_active_provider() == "anthropic"
    with pytest.raises(ValueError):
        keyring.set_active_provider("nope")


def test_fallback_chain_persists_and_deduplicates():
    assert keyring.set_fallback_chain(["openai", "gemini", "openai"]) == ["openai", "gemini"]
    assert keyring.get_fallback_chain() == ["openai", "gemini"]


def test_config_version_changes_on_every_write():
    before = keyring.config_version()
    keyring.add_key("openai", "sk-version-bump-1234")
    assert keyring.config_version() != before


def test_custom_endpoints_are_registered_and_deletable():
    keyring.set_config("custom:box-a", model="m", base_url="http://a/v1")
    keyring.set_config("custom:box-b", model="m", base_url="http://b/v1")

    assert keyring.list_custom_providers() == ["custom:box-a", "custom:box-b"]
    assert "custom:box-a" in keyring.known_providers()

    assert keyring.delete_provider("custom:box-a") is True
    assert keyring.list_custom_providers() == ["custom:box-b"]
    assert keyring.delete_provider("custom:box-a") is False


def test_builtin_providers_cannot_be_deleted():
    with pytest.raises(ValueError):
        keyring.delete_provider("openai")
