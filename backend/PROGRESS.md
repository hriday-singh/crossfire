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
| `GeminiProvider` wired | `[x]` | wired to delegate to proxy / OpenAICompat |
| `extract_claims()` | `[x]` | narrow `ExtractedClaims` schema, maps onto `Case` |
| `classify_load_bearing()` v1 | `[x]` | locked framing in `docs/dev-a/research/01-load-bearing.md` |
| `build_test_plan()` | `[x]` | keyword-bucket routing (evidence/behavior/constraint/alternative) |
| `reconcile()` | `[x]` | structured-LLM verdict, decision locked in `docs/dev-a/research/02-reconcile.md` |
| `build_consequences()` | `[x]` | deterministic status/load-bearing routing, no LLM call |
| `run_pipeline()` full orchestration + SSE queue | `[ ]` | |
| Second provider | `[x]` | `OpenAICompatibleProvider` implemented for local proxy (http://localhost:8081/v1) |
| `builder.py` (if time) | `[ ]` | |
| `tests/eval_set/` harness | `[ ]` | |

**Last updated:** Dev A
**Note:** `OpenAICompatibleProvider` wired and tested against local `gemini-web2api` proxy (`http://localhost:8081/v1`, model `gemini-3.7-flash`). `GeminiProvider` delegates to the proxy when configured. Both text and Pydantic structured output verified live and with unit tests. `build_consequences()` done — remaining gap: `Claim` has no `reasoning` field yet, so `verdict_reasoning` is synthesized from status/load_bearing, not the real reconcile output; needs real wiring once `run_pipeline()` threads reconcile → claim → consequence.

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
| `POST /cases` | `[x]` | Calls `extract_claims`, saves to store, returns `awaiting_confirmation` |
| `GET /cases/{id}/stream` | `[x]` | Opens immediately, reads from queue, emits SSE events matching contract §3 |
| `devils_advocate.py` producing real `Finding` | `[x]` | Assumption test, prompt-only, isolated to single claim, zero tool chains |
| `POST /cases/{id}/confirm` (202, non-blocking) | `[x]` | Validates state gate, launches background `run_pipeline()`, returns 202 immediately |
| `GET /cases/{id}` | `[x]` | Returns full Case for evidence drawer |
| `dispatch()` routing wired with Dev A | `[~]` | Evaluators ready; waiting for Dev A to implement `run_evaluators()` call site |
| SSE events verified against contract | `[x]` | Verified documented event ordering in SSE stream |
| Claim-confirmation gate is real, not client-faked | `[x]` | Rejects confirm requests when not in `awaiting_confirmation` status |
| `overthinker.py` (stretch) | `[x]` | Edge-case test evaluator implemented and unit tested |

**Last updated:** Dev C
**Note:** Checkpoint 1 and Checkpoint 2 deliverables complete. All 9 route and evaluator unit tests pass. `dispatch()` routing will be hooked into Dev A's `run_evaluators()` once Dev A writes the orchestrator in `core/loop.py`.


---

## Blockers / Cross-Team Flags

Anything that needs another dev's attention goes here, tagged with their name. Clear it once resolved instead of deleting the line — leave a one-word "resolved" so there's a record.

- (none yet)
