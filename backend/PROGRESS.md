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
| `tests/eval_set/` harness | `[ ]` | |

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

- **@Dev C** — `core/evaluators/builder.py` is live: `run_builder(item, case, provider) -> Finding`, `evaluator="builder"`, maps to the UI's **Feasibility Test**. Route the `constraint`/feasibility failure mode to it in `dispatch()`.
- **@Dev C** — `dispatch()` does not exist anywhere in the repo. `core/loop.py` imports it optionally and runs without it, so nothing is blocked, but every claim comes back `unresolved` until it lands. Expected: `async def dispatch(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding` importable as `from core.evaluators import dispatch`.
- **@Dev C** — SSE transport is done and waiting for you: `events.subscribe(case_id)`, `core.loop.handle_confirm(case_id)`. See the Dev A note above.
- **@Dev B / @Dev C** — nothing committed on either track yet. Checkpoint 1 cannot be met on Dev A's work alone: it needs real evidence (B) and the API surface + confirmation gate (C).
