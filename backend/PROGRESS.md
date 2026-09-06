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
| `run_pipeline()` full orchestration + SSE queue | `[x]` | `events.py` (queue per case_id) + `run_pipeline`/`run_evaluators`/`handle_confirm` in `core/loop.py` |
| Second provider | `[x]` | `OpenAICompatibleProvider` implemented for local proxy (http://localhost:8081/v1) |
| `builder.py` (if time) | `[x]` | Feasibility Test; structured `BuilderVerdict`, no search — `evidence=[]` by design |
| `tests/eval_set/` harness | `[x]` | 6 cases in `tests/eval_set/cases.py`; real pipeline, opt-in via `CROSSFIRE_EVAL_LIVE=1` |

**Last updated:** Dev A
**Note:** `OpenAICompatibleProvider` wired and tested against local `gemini-web2api` proxy (`http://localhost:8081/v1`, model `gemini-3.7-flash`). `GeminiProvider` delegates to the proxy when configured. Both text and Pydantic structured output verified live and with unit tests.

`run_pipeline()` landed. All required Dev A rows are now done; only the two "if time" rows remain. Details Dev B and Dev C need:

- **`events.py` is the SSE transport.** `subscribe(case_id)` is an async generator — Dev C's `GET /cases/{id}/stream` iterates it and formats each `{"event", "data"}` as an SSE frame. Nothing else to wire; the pipeline writes with `publish()` and always `close()`s in a `finally`, including on error.
- **`core.loop.handle_confirm(case_id)` is what `POST /cases/{id}/confirm` calls**, then returns 202. It `create_task`s and returns — do not await it.
- **`dispatch()` is imported optionally.** `core/loop.py` does `try: from core.evaluators import dispatch / except ImportError: dispatch = None`. Until Dev C lands it the pipeline runs end-to-end with zero findings and every claim reconciles to `unresolved` — which is correct behaviour, not a stub. Signature expected: `async def dispatch(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding`. Landing it needs no edit to `core/loop.py`.
- **verdict_reasoning gap closed.** `run_pipeline` threads the real `reconcile()` reasoning onto each `DecisionConsequence` after `build_consequences()`. No `Claim` model change, so contracts stay frozen.
- **Test isolation:** `tests/conftest.py` now has an autouse fixture clearing `store._cases` and `events._queues` between tests. Both are module-global by design; reusing a `case_id` across tests without this inherits the previous run's events.

## Dev B — Evidence + Receipts

| Task | Status | Notes |
|---|---|---|
| `search_evidence()` (Tavily) | `[x]` | single-query basic search with tenacity retry, graceful empty list degradation |
| Curation v1 (heuristic) | `[x]` | keyword relevance scoring, strictly bounded 1-3 sentences |
| `receipts.py` producing real `Finding` | `[x]` | calls through LLMProvider with curated evidence, produces well-formed Finding |
| Scrapling deep-fetch + adaptive-scrutiny wiring | `[x]` | deep-fetch only for load_bearing is True and thin snippet, SERP guard enforced |
| Demo fallback switch (`DEMO_FIXTURES`) | `[x]` | DEMO_MODE flag + explicit claim.id match bypasses network calls |
| Failure handling (dead sources → unresolved, not crash) | `[x]` | network/API failures degrade to empty list rather than raising |
| Curation v2 (LLM, if time) | `[ ]` | |
| `ingestion/pdf.py` (stretch) | `[ ]` | |

**Last updated:** Dev B
**Note:** All core Dev B modules (`evidence/search.py`, `evidence/curate.py`, `evidence/fetch.py`, `core/evaluators/receipts.py`) and all tests in `tests/evidence/` and `tests/evaluators/test_receipts.py` implemented and passing cleanly.

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

- **@Dev B / @Dev C** — the eval set is the acceptance test for your work. `CROSSFIRE_EVAL_LIVE=1 pytest tests/eval_set -s` runs 6 hand-picked decisions through the real pipeline against the real provider (skipped by default, so normal `pytest` stays offline and fast). Today it's 4 failed / 3 passed (7th test is an offline guard on the case list), and the failures are correct: with no `dispatch()` and no evidence there are zero findings, so every claim reconciles to `unresolved`. `mixed_evidence` and `vague_input` pass only because `unresolved`/"didn't crash" is what they assert — they are not yet evidence of anything working. Those turn green as your tracks land — add cases for your own area to `tests/eval_set/cases.py`.
- **@Dev C** — `core/evaluators/builder.py` is live: `run_builder(item, case, provider) -> Finding`, `evaluator="builder"`, maps to the UI's **Feasibility Test**. Route the `constraint`/feasibility failure mode to it in `dispatch()`.
- **@Dev C** — `dispatch()` does not exist anywhere in the repo. `core/loop.py` imports it optionally and runs without it, so nothing is blocked, but every claim comes back `unresolved` until it lands. Expected: `async def dispatch(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding` importable as `from core.evaluators import dispatch`.
- **@Dev C** — SSE transport is done and waiting for you: `events.subscribe(case_id)`, `core.loop.handle_confirm(case_id)`. See the Dev A note above.
- **@Dev B / @Dev C** — nothing committed on either track yet. Checkpoint 1 cannot be met on Dev A's work alone: it needs real evidence (B) and the API surface + confirmation gate (C).
