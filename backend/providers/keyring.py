"""
Owner: Dev A. Encrypted, multi-key credential store for LLM providers.

Keys are entered in the web UI, never in .env, and never leave this module in
plaintext: every read path outside `secrets_for()` returns a masked hint. At
rest each key is Fernet-encrypted with a master key from CROSSFIRE_SECRET_KEY,
or from a 0600 file generated next to the SQLite database on first use.

Same database file as store.py (SQLITE_DB_PATH), so tests get isolation for
free. Schema mirrors migrations/003_create_provider_credentials.sql.
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import stat
import threading
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from providers.catalog import (
    CATALOG,
    CUSTOM,
    CUSTOM_PREFIX,
    DEFAULT_PROVIDER,
    THINKING_EFFORTS,
    ThinkingSetting,
    get_spec,
    is_custom,
)

_ACTIVE_PROVIDER = "active_provider"
_FALLBACK_CHAIN = "fallback_chain"
_ENABLED_MODELS = "enabled_models"  # one row per provider: "enabled_models:<id>"
_MODELS = "models"  # one row per provider: "models:<id>" — the saved model list
_THINKING = "thinking"  # one row per provider: "thinking:<id>" — {model: {enabled, effort}}

#: Upper bound on a provider's saved model list. OpenRouter-sized gateways list
#: a few hundred; this only stops a runaway response from bloating the store.
MAX_MODELS = 1000

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_initialized: set[str] = set()
_version = 0


class KeyringError(RuntimeError):
    """Credential storage could not be read or written."""


@dataclass(frozen=True)
class StoredKey:
    id: int
    provider: str
    label: str
    hint: str
    enabled: bool


@dataclass(frozen=True)
class ProviderConfig:
    provider: str
    model: str
    base_url: str
    rpm: int


def _db_path() -> Path:
    return Path(os.getenv("SQLITE_DB_PATH", Path(__file__).parent.parent / "crossfire.db"))


def _master_keys() -> list[bytes]:
    """Every master key that may have encrypted a stored credential, newest first.

    CROSSFIRE_SECRET_KEY if set, then the generated per-install key file beside
    the database. Both are tried on decrypt, so setting CROSSFIRE_SECRET_KEY on
    an install that already stored keys under the file key does not silently
    orphan them. New keys are encrypted with the first.

    The file is chmod 0600. On Windows the mode is advisory, which is acceptable
    here: this protects a local credential store, it is not a secret manager.
    """
    keys: list[bytes] = []
    env_key = os.getenv("CROSSFIRE_SECRET_KEY", "").strip()
    if env_key:
        try:
            Fernet(env_key.encode())
        except Exception as exc:
            raise KeyringError(
                "CROSSFIRE_SECRET_KEY is not a valid Fernet key. Generate one with "
                "providers.keyring.generate_master_key()."
            ) from exc
        keys.append(env_key.encode())

    key_file = _db_path().parent / ".crossfire_key"
    if key_file.exists():
        file_key = key_file.read_bytes().strip()
        if file_key not in keys:
            keys.append(file_key)
    elif not keys:
        file_key = Fernet.generate_key()
        key_file.parent.mkdir(parents=True, exist_ok=True)
        key_file.write_bytes(file_key)
        try:
            key_file.chmod(stat.S_IRUSR | stat.S_IWUSR)
        except OSError:  # ponytail: best-effort, file mode is advisory on Windows
            pass
        keys.append(file_key)
    return keys


def generate_master_key() -> str:
    """A fresh value for CROSSFIRE_SECRET_KEY."""
    return Fernet.generate_key().decode()


def _fernet() -> MultiFernet:
    return MultiFernet([Fernet(key) for key in _master_keys()])


def _connect() -> sqlite3.Connection:
    path = str(_db_path())
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    if path not in _initialized:
        _init_schema(conn)
        _initialized.add(path)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS provider_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                label TEXT NOT NULL DEFAULT '',
                ciphertext BLOB NOT NULL,
                hint TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_provider_keys_provider ON provider_keys(provider)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS provider_config (
                provider TEXT PRIMARY KEY,
                model TEXT NOT NULL DEFAULT '',
                base_url TEXT NOT NULL DEFAULT '',
                rpm INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS provider_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )


def mask(secret: str) -> str:
    """Display form of a credential. Not reversible; safe to log or return."""
    secret = secret.strip()
    if len(secret) <= 8:
        return "*" * len(secret)
    return f"{secret[:4]}...{secret[-4:]}"


def _bump() -> None:
    """Invalidate provider instances cached against this configuration."""
    global _version
    _version += 1


def config_version() -> int:
    """Monotonic counter; changes whenever keys or settings change."""
    return _version


def list_custom_providers() -> list[str]:
    """Ids of the user-added endpoints, oldest first.

    A custom endpoint exists exactly when it has a provider_config row — there
    is no separate registry table to keep in sync.
    """
    with closing(_connect()) as conn, conn:
        rows = conn.execute(
            "SELECT provider FROM provider_config WHERE provider LIKE ? ORDER BY rowid",
            (CUSTOM_PREFIX + "%",),
        ).fetchall()
    return [row["provider"] for row in rows]


def known_providers() -> list[str]:
    """Every provider the UI can select: the catalog plus custom endpoints.

    The bare `custom` catalog entry is only a template for user-added endpoints
    and stays hidden — unless an older install already saved a base URL on it,
    in which case it is kept so that setup is not lost.
    """
    with closing(_connect()) as conn, conn:
        rows = conn.execute(
            "SELECT provider, base_url FROM provider_config "
            "WHERE provider = ? OR provider LIKE ? ORDER BY rowid",
            (CUSTOM, CUSTOM_PREFIX + "%"),
        ).fetchall()
    template_in_use = any(r["provider"] == CUSTOM and r["base_url"].strip() for r in rows)
    builtins = [p for p in CATALOG if p != CUSTOM or template_in_use]
    return builtins + [r["provider"] for r in rows if is_custom(r["provider"])]


def delete_provider(provider_id: str) -> bool:
    """Remove a custom endpoint, its keys, and any reference to it."""
    if not is_custom(provider_id):
        raise ValueError(f"{provider_id!r} is a built-in provider and cannot be deleted")
    with _lock:
        with closing(_connect()) as conn, conn:
            cur = conn.execute("DELETE FROM provider_config WHERE provider = ?", (provider_id,))
            deleted = cur.rowcount > 0
            conn.execute("DELETE FROM provider_keys WHERE provider = ?", (provider_id,))
            # Re-adding an endpoint under the same name must start clean.
            conn.execute(
                "DELETE FROM provider_settings WHERE key IN (?, ?)",
                (f"{_MODELS}:{provider_id}", f"{_ENABLED_MODELS}:{provider_id}"),
            )
    if not deleted:
        return False
    _bump()
    if get_active_provider() == provider_id:
        set_active_provider(DEFAULT_PROVIDER)
    chain = [p for p in get_fallback_chain() if p != provider_id]
    set_fallback_chain(chain)
    return True


# --------------------------------------------------------------------------- keys


def add_key(provider: str, api_key: str, label: str = "") -> StoredKey:
    get_spec(provider)  # reject unknown providers before storing anything
    api_key = api_key.strip()
    if not api_key:
        raise ValueError("api_key must not be empty")

    token = _fernet().encrypt(api_key.encode())
    hint = mask(api_key)
    resolved_label = label.strip() or f"key {hint}"
    with _lock:
        with closing(_connect()) as conn, conn:
            cur = conn.execute(
                "INSERT INTO provider_keys (provider, label, ciphertext, hint) VALUES (?, ?, ?, ?)",
                (provider, resolved_label, token, hint),
            )
            key_id = int(cur.lastrowid or 0)
    _bump()
    return StoredKey(id=key_id, provider=provider, label=resolved_label, hint=hint, enabled=True)


def list_keys(provider: str | None = None) -> list[StoredKey]:
    sql = "SELECT id, provider, label, hint, enabled FROM provider_keys"
    params: tuple = ()
    if provider:
        sql += " WHERE provider = ?"
        params = (provider,)
    sql += " ORDER BY id"
    with closing(_connect()) as conn, conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        StoredKey(
            id=row["id"],
            provider=row["provider"],
            label=row["label"],
            hint=row["hint"],
            enabled=bool(row["enabled"]),
        )
        for row in rows
    ]


def delete_key(key_id: int) -> bool:
    with _lock:
        with closing(_connect()) as conn, conn:
            cur = conn.execute("DELETE FROM provider_keys WHERE id = ?", (key_id,))
            deleted = cur.rowcount > 0
    if deleted:
        _bump()
    return deleted


def set_key_enabled(key_id: int, enabled: bool) -> bool:
    with _lock:
        with closing(_connect()) as conn, conn:
            cur = conn.execute(
                "UPDATE provider_keys SET enabled = ? WHERE id = ?",
                (1 if enabled else 0, key_id),
            )
            changed = cur.rowcount > 0
    if changed:
        _bump()
    return changed


def secrets_for(provider: str) -> list[tuple[int, str]]:
    """(key_id, plaintext) for every enabled key of `provider`, oldest first.

    The only plaintext exit from this module. Callers hold it in memory and
    never persist it or echo it back over the API.
    """
    with closing(_connect()) as conn, conn:
        rows = conn.execute(
            "SELECT id, ciphertext FROM provider_keys WHERE provider = ? AND enabled = 1 ORDER BY id",
            (provider,),
        ).fetchall()

    fernet = _fernet()
    out: list[tuple[int, str]] = []
    for row in rows:
        try:
            out.append((row["id"], fernet.decrypt(row["ciphertext"]).decode()))
        except InvalidToken:
            # Neither master key opens it (the key file was lost or replaced).
            # Skip rather than crash the pipeline; the settings UI still lists
            # the key so the user can delete and re-add it.
            logger.warning(
                "Stored %s key #%s cannot be decrypted with the current master key "
                "(was backend/.crossfire_key or CROSSFIRE_SECRET_KEY changed?) — skipping it",
                provider,
                row["id"],
            )
            continue
    return out


# ------------------------------------------------------------------------- config


def get_config(provider: str) -> ProviderConfig:
    spec = get_spec(provider)
    with closing(_connect()) as conn, conn:
        row = conn.execute(
            "SELECT model, base_url, rpm FROM provider_config WHERE provider = ?", (provider,)
        ).fetchone()
    if row is None:
        return ProviderConfig(provider, spec.default_model, spec.base_url, spec.default_rpm)
    return ProviderConfig(
        provider=provider,
        model=row["model"] or spec.default_model,
        base_url=row["base_url"] or spec.base_url,
        rpm=int(row["rpm"]) if row["rpm"] is not None else spec.default_rpm,
    )


def set_config(
    provider: str,
    model: str | None = None,
    base_url: str | None = None,
    rpm: int | None = None,
) -> ProviderConfig:
    current = get_config(provider)
    spec = get_spec(provider)
    new_base = current.base_url if base_url is None else base_url.strip()
    if not spec.editable_base_url:
        # A vendor's REST host is not user-editable: pointing "openai" at an
        # arbitrary host would silently ship the user's OpenAI key elsewhere.
        # That is what the `custom` provider is for.
        new_base = spec.base_url
    merged = ProviderConfig(
        provider=provider,
        model=(current.model if model is None else model.strip()),
        base_url=new_base,
        rpm=current.rpm if rpm is None else max(0, int(rpm)),
    )
    primary_changed = bool(merged.model) and merged.model != current.model
    # Read before the write: get_enabled_models() puts the *current* primary first.
    enabled_before = get_enabled_models(provider) if primary_changed else []
    with _lock:
        with closing(_connect()) as conn, conn:
            conn.execute(
                """
                INSERT INTO provider_config (provider, model, base_url, rpm) VALUES (?, ?, ?, ?)
                ON CONFLICT(provider) DO UPDATE SET model = excluded.model,
                                                    base_url = excluded.base_url,
                                                    rpm = excluded.rpm
                """,
                (provider, merged.model, merged.base_url, merged.rpm),
            )
    _bump()
    if primary_changed:
        # Switching primary demotes the old one to fallback #1 instead of
        # dropping it, and the new one joins the saved list.
        set_models(provider, [*get_models(provider), merged.model])
        set_enabled_models(provider, [merged.model, *enabled_before])
    return merged


def _get_setting(key: str) -> str | None:
    with closing(_connect()) as conn, conn:
        row = conn.execute("SELECT value FROM provider_settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def _set_setting(key: str, value: str) -> None:
    with _lock:
        with closing(_connect()) as conn, conn:
            conn.execute(
                "INSERT INTO provider_settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )
    _bump()


def get_active_provider() -> str:
    value = _get_setting(_ACTIVE_PROVIDER)
    if not value or value not in known_providers():
        return DEFAULT_PROVIDER
    return value


def set_active_provider(provider: str) -> str:
    get_spec(provider)
    _set_setting(_ACTIVE_PROVIDER, provider)
    chain = get_fallback_chain()
    if provider in chain:
        set_fallback_chain([p for p in chain if p != provider])
    return provider


def get_fallback_chain() -> list[str]:
    """Providers tried, in order, once the active one exhausts its keys."""
    raw = _get_setting(_FALLBACK_CHAIN)
    if not raw:
        return []
    try:
        values = json.loads(raw)
    except json.JSONDecodeError:
        return []
    known = known_providers()
    # A deleted custom endpoint drops out of the chain rather than breaking it.
    return [v for v in values if isinstance(v, str) and v in known]


def set_fallback_chain(providers: list[str]) -> list[str]:
    cleaned: list[str] = []
    for provider in providers:
        get_spec(provider)
        if provider not in cleaned:
            cleaned.append(provider)
    _set_setting(_FALLBACK_CHAIN, json.dumps(cleaned))
    return cleaned


def get_enabled_models(provider: str) -> list[str]:
    """The models this provider may run, in fallback order, primary first.

    The primary (provider_config.model) is always the head of the list — a
    model cannot be disabled while it is the selected one. Providers the user
    has never touched default to their whole catalog list, so the fallback is
    useful before anyone opens the settings screen.
    """
    spec = get_spec(provider)
    primary = get_config(provider).model
    raw = _get_setting(f"{_ENABLED_MODELS}:{provider}")
    stored = list(spec.models) if raw is None else _json_list(raw)
    ordered = [primary, *[m for m in stored if m != primary]]
    return [m for m in ordered if m]


def set_enabled_models(provider: str, models: list[str]) -> list[str]:
    """Replace the enabled-model list. Order is the fallback order."""
    get_spec(provider)
    _set_setting(f"{_ENABLED_MODELS}:{provider}", json.dumps(_dedupe(models)))
    return get_enabled_models(provider)


def get_models(provider: str) -> list[str]:
    """Every model saved for this provider, enabled or not.

    Defaults to the catalog list until the user adds, fetches or removes one.
    Enabled models are always included, so nothing that can run is invisible.
    """
    spec = get_spec(provider)
    raw = _get_setting(f"{_MODELS}:{provider}")
    listed = list(spec.models) if raw is None else _json_list(raw)
    return _dedupe([*listed, *get_enabled_models(provider)])


def set_models(provider: str, models: list[str]) -> list[str]:
    get_spec(provider)
    _set_setting(f"{_MODELS}:{provider}", json.dumps(_dedupe(models)[:MAX_MODELS]))
    return get_models(provider)


def add_models(provider: str, models: list[str], enabled: bool = True) -> list[str]:
    """Save more models (typed in or fetched from the endpoint).

    With `enabled`, they join the end of the fallback order. A provider that has
    no primary yet (a fresh custom endpoint) takes the first one as primary.
    """
    new = _dedupe(models)
    set_models(provider, [*get_models(provider), *new])
    if new and not get_config(provider).model:
        set_config(provider, model=new[0])
    if enabled:
        set_enabled_models(provider, [*get_enabled_models(provider), *new])
    return get_models(provider)


def remove_model(provider: str, model: str) -> list[str]:
    """Forget a model entirely. The primary cannot be removed — pick another first."""
    model = model.strip()
    if model == get_config(provider).model:
        raise ValueError(f"{model!r} is the primary model — make another model primary first")
    set_enabled_models(provider, [m for m in get_enabled_models(provider) if m != model])
    return set_models(provider, [m for m in get_models(provider) if m != model])


def get_thinking(provider: str) -> dict[str, ThinkingSetting]:
    """Thinking setting per saved model. Empty for providers without thinking.

    A model the user never touched gets the default (on, high effort), which
    is what DeepSeek does when the request carries no `thinking` field.
    """
    if not get_spec(provider).supports_thinking:
        return {}
    raw = _get_setting(f"{_THINKING}:{provider}")
    try:
        stored = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        stored = {}
    if not isinstance(stored, dict):
        stored = {}
    out: dict[str, ThinkingSetting] = {}
    for model in get_models(provider):
        entry = stored.get(model)
        if not isinstance(entry, dict):
            out[model] = ThinkingSetting()
            continue
        effort = entry.get("effort")
        out[model] = ThinkingSetting(
            enabled=bool(entry.get("enabled", True)),
            effort=effort if effort in THINKING_EFFORTS else "high",
        )
    return out


def set_thinking(provider: str, model: str, enabled: bool, effort: str) -> dict[str, ThinkingSetting]:
    if not get_spec(provider).supports_thinking:
        raise ValueError(f"{provider!r} does not support thinking mode")
    if effort not in THINKING_EFFORTS:
        raise ValueError(f"effort must be one of {', '.join(THINKING_EFFORTS)}")
    model = model.strip()
    if model not in get_models(provider):
        raise ValueError(f"{model!r} is not a saved model for {provider}")
    current = {m: {"enabled": s.enabled, "effort": s.effort} for m, s in get_thinking(provider).items()}
    current[model] = {"enabled": enabled, "effort": effort}
    _set_setting(f"{_THINKING}:{provider}", json.dumps(current))
    return get_thinking(provider)


def _json_list(raw: str) -> list[str]:
    try:
        values = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return _dedupe(v for v in values if isinstance(v, str)) if isinstance(values, list) else []


def _dedupe(models) -> list[str]:
    """Stripped, non-empty, first occurrence wins — order is meaningful."""
    return list(dict.fromkeys(m.strip() for m in models if m.strip()))


def clear() -> None:
    """Test helper — wipes credentials and settings for the current database."""
    with _lock:
        with closing(_connect()) as conn, conn:
            conn.execute("DELETE FROM provider_keys")
            conn.execute("DELETE FROM provider_config")
            conn.execute("DELETE FROM provider_settings")
    _bump()
