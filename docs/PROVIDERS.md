# Providers, API keys, and key rotation

Backend reference for multi-provider support. Direct HTTP against each vendor's
REST API — no vendor SDKs anywhere in `backend/providers/`.

## Supported providers

| id | Label | Endpoint | Key | Wire |
|---|---|---|---|---|
| `gemini_proxy` | Gemini Proxy (default) | `http://localhost:8081/v1` | no | OpenAI-compatible |
| `gemini` | Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | yes | OpenAI-compatible |
| `openai` | OpenAI | `https://api.openai.com/v1` | yes | OpenAI-compatible |
| `anthropic` | Claude | `https://api.anthropic.com/v1` | yes | Messages API |
| `ollama` | Ollama (local) | `http://localhost:11434/v1` | no | OpenAI-compatible |
| `custom` | Any OpenAI-compatible gateway | user-supplied | optional | OpenAI-compatible |

Only Claude needs its own adapter (`providers/anthropic.py`): system prompt is a
top-level field and text arrives as content blocks. Everything else is
`providers/openai_compat.py` pointed at a different base URL.

`base_url` is user-editable only for `gemini_proxy`, `ollama`, and `custom`. A
vendor's host is pinned, so a stored OpenAI key cannot be redirected elsewhere
by editing a setting — that is what `custom` is for.

Provider and model live in the catalog (`providers/catalog.py`), which is the
single source for the UI's two dropdowns: provider, then that provider's models.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/providers` | Catalog + active provider + fallback chain + key counts |
| PUT | `/providers/active` | Select provider (and optionally model) |
| PUT | `/providers/fallback` | Set the fallback order |
| PUT | `/providers/{id}/config` | Set model / base_url / rpm |
| GET | `/providers/{id}/keys` | List keys (masked) |
| POST | `/providers/{id}/keys` | Add a key |
| PATCH | `/providers/keys/{key_id}` | Enable/disable a key |
| DELETE | `/providers/keys/{key_id}` | Delete a key |
| POST | `/providers/{id}/test` | One live call to validate a key before saving |
| GET | `/providers/pool/status` | Live per-key scheduling state |
| GET | `/providers/ollama/models` | Models actually pulled on the Ollama host |

## Key storage

Keys are entered in the UI, never in `.env`. `providers/keyring.py` encrypts each
one with Fernet before it reaches SQLite (`provider_keys.ciphertext`) and stores a
masked `hint` (`AIza...9f2c`) alongside it. `secrets_for()` is the only plaintext
exit; no API response ever contains a raw key.

The master key comes from `CROSSFIRE_SECRET_KEY`, or from a generated
`backend/.crossfire_key` (gitignored, mode 0600) on first use. Set it explicitly
to move a database between machines — otherwise stored keys decrypt to nothing on
the new host and the UI shows them so they can be re-added.

Schema: `migrations/003_create_provider_credentials.sql`.

**This API is as privileged as the machine it runs on.** Anything that can reach
the backend can write credentials to it. Crossfire binds to localhost with CORS
restricted to its own frontend; deploying it on a shared host needs auth in front
of `/providers/*` first.

## Key rotation and fallback

A full Crossfire panel is ~20 concurrent LLM calls. A free Gemini key allows
about 10 requests/minute. One key turns a run into a queue; ten keys used well
run it at ten times the per-key ceiling. That is what `providers/pool.py` does.

Per key, three mechanisms:

* **least-inflight dispatch** — each concurrent caller takes the least-loaded
  healthy key, so evaluators land on different keys instead of stacking on one;
* **RPM pacing** — a key is handed out at most once per `60/rpm` seconds, which
  avoids the 429 rather than reacting to it (`rpm=0` disables pacing);
* **failure cooldown** — a key that answers 429 is benched for `Retry-After` or
  an exponential backoff (20s → 300s) and the next caller skips it. Four
  consecutive failures retire it for the process; a 401/403 retires it at once.

`providers/routing.py` sits on top. One `generate()` call walks the chain: within
a provider it borrows keys from the pool, so a 429 costs the next key rather than
the run; only when a provider is out of usable keys does it fall through to the
next provider. A 400 is raised immediately — every other key would fail the same
way. Upstream code still sees the plain `LLMProvider` protocol.

Capacity is `keys x KEY_POOL_MAX_INFLIGHT` (default 2). Ten Gemini keys give 20
concurrent slots, which covers `EVALUATOR_CONCURRENCY=8` with headroom.

The built chain is cached and rebuilt only when settings change, so cooldown
state and httpx connection pools survive across requests.

### Seeding a pool from .env

Useful on a fresh machine; keys added in the UI take precedence.

```
GEMINI_API_KEYS=key1,key2,key3
KEY_POOL_MAX_INFLIGHT=2
```

### Watching it work

`GET /providers/pool/status` reports per-key inflight counts, successes, rate
limits, and which keys are retired — the readout that shows a run genuinely
spread across the pool.
