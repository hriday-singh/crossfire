# Crossfire Backend — Progress

Update this immediately after finishing any checklist item in your `docs/dev-*-tasks.md`. Don't batch it up — the point of this file is that at hour 11 and hour 35, anyone can read it and know the real state without calling a meeting.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Checkpoint 1 — Hour 11 (Progress Review)

Target: input in, claim extraction, ≥2 genuinely different tests, real evidence, one real claim verdict (ugly is fine).

**Status:** `[ ]`

## Checkpoint 2 — Hour 35 (Prototype Evaluation)

Target: loop runs cleanly on several inputs, claim-confirmation gate is real, evidence-drawer fields are all populated.

**Status:** `[ ]`

---

## Dev A — Core Loop + Providers

| Task | Status | Notes |
|---|---|---|
| Contracts frozen (`core/models.py`, `providers/base.py`) | `[x]` | |
| `GeminiProvider` wired | `[~]` | scaffolded, generate() not implemented yet |
| `extract_claims()` | `[ ]` | |
| `classify_load_bearing()` v1 | `[ ]` | |
| `build_test_plan()` | `[ ]` | |
| `reconcile()` | `[ ]` | |
| `build_consequences()` | `[ ]` | |
| `run_pipeline()` full orchestration + SSE queue | `[ ]` | |
| Second provider | `[ ]` | |
| `builder.py` (if time) | `[ ]` | |
| `tests/eval_set/` harness | `[ ]` | |

**Last updated:** Dev A at hour 0
**Note:** Full repo skeleton in place (all dirs/files per docs/05-PARALLEL-WORKFLOW.md §3), venv set up, `pytest` green (13 passed, 35 skipped). `core/models.py` + `providers/base.py` frozen, matches `docs/00-CONTRACTS.md` exactly. Added a provider registry (`providers/get_provider(name, api_key)`) plus `LLM_PROVIDER`/`LLM_API_KEY` in `.env` so switching/overriding providers is config, not code. `anthropic.py`/`openai_compat.py` are stubs (raise `NotImplementedError`); `core/loop.py` has real signatures matching `test_loop.py`'s skeletons but no logic yet — that's hour 2-25, gated on the two RESEARCH FIRST docs (`dev-a/research/01-load-bearing.md`, `02-reconcile.md`).

## Dev B — Evidence + Receipts

| Task | Status | Notes |
|---|---|---|
| `search_evidence()` (Tavily) | `[ ]` | |
| Curation v1 (heuristic) | `[ ]` | |
| `receipts.py` producing real `Finding` | `[ ]` | |
| Scrapling deep-fetch + adaptive-scrutiny wiring | `[ ]` | |
| Demo fallback switch (`DEMO_FIXTURES`) | `[ ]` | |
| Failure handling (dead sources → unresolved, not crash) | `[ ]` | |
| Curation v2 (LLM, if time) | `[ ]` | |
| `ingestion/pdf.py` (stretch) | `[ ]` | |

**Last updated:** — by — at hour —
**Note:**

## Dev C — API + SSE + Evaluators

| Task | Status | Notes |
|---|---|---|
| `POST /cases` | `[ ]` | |
| `GET /cases/{id}/stream` | `[ ]` | |
| `devils_advocate.py` producing real `Finding` | `[ ]` | |
| `POST /cases/{id}/confirm` (202, non-blocking) | `[ ]` | |
| `GET /cases/{id}` | `[ ]` | |
| `dispatch()` routing wired with Dev A | `[ ]` | |
| SSE events verified against contract | `[ ]` | |
| Claim-confirmation gate is real, not client-faked | `[ ]` | |
| `overthinker.py` (stretch) | `[ ]` | |

**Last updated:** — by — at hour —
**Note:**

---

## Blockers / Cross-Team Flags

Anything that needs another dev's attention goes here, tagged with their name. Clear it once resolved instead of deleting the line — leave a one-word "resolved" so there's a record.

- (none yet)
