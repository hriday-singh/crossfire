-- Migration: 003_create_provider_credentials.sql
-- Description: Multi-provider model selection and encrypted API-key storage.
--   provider_keys     — one row per API key. `ciphertext` is Fernet-encrypted with
--                       CROSSFIRE_SECRET_KEY (or the generated .crossfire_key file);
--                       `hint` is the masked display form and is safe to return over
--                       the API. Plaintext keys are never stored in any column.
--                       Several rows may share a provider — that is the rotation pool
--                       (backend/providers/pool.py).
--   provider_config   — per-provider model / base_url / requests-per-minute overrides.
--   provider_settings — key-value app settings: active_provider, fallback_chain.
-- Applied at runtime by backend/providers/keyring.py:_init_schema for parity with
-- store.py; this file is the reviewable record of the schema.

CREATE TABLE IF NOT EXISTS provider_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    ciphertext BLOB NOT NULL,
    hint TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_keys_provider ON provider_keys(provider);

CREATE TABLE IF NOT EXISTS provider_config (
    provider TEXT PRIMARY KEY,
    model TEXT NOT NULL DEFAULT '',
    base_url TEXT NOT NULL DEFAULT '',
    rpm INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS provider_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
