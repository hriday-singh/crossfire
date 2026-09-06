# Dev C — API + SSE + Prompt-Only Evaluators

You own the most self-contained slice: the HTTP surface, the live stream, and the two evaluators that are pure prompt-in/finding-out with no tool chains attached. This is deliberately the narrowest, least ambiguous spec of the three — you shouldn't need to touch anyone else's files to get through your checklist.

**Files you own:**
```
api/routes.py            api/schemas.py
core/evaluators/devils_advocate.py
core/evaluators/overthinker.py   (stretch, hour 35+ only)
```

**Never touch:** `providers/`, `core/models.py`, `core/loop.py`, `evidence/`, `core/evaluators/receipts.py`.

**Reads but doesn't modify:** `providers/base.py` (call through `LLMProvider`), `core/models.py`, `core/loop.py` (you call `extract_claims`/`run_pipeline`, you don't implement them).

---

## Hour 0-2

- [ ] Read `docs/00-CONTRACTS.md` fully, especially §3 (SSE schema) and §4 (call sequence) — that's the exact contract you're building the routes against.

## Hour 2-11 (→ Checkpoint 1)

- [ ] `api/schemas.py`: thin request/response wrappers around `Case` for the routes below.
- [ ] `POST /cases`: calls `core.loop.extract_claims()`, returns the resulting `Case` (status `awaiting_confirmation`).
- [ ] `GET /cases/{id}/stream`: opens immediately, reads from the `asyncio.Queue` keyed by `case_id` (Dev A owns queue creation in `core/loop.py` — you just consume it), re-emits as SSE.
- [ ] `core/evaluators/devils_advocate.py`: `run_devils_advocate(claim, plan_item, case) -> Finding` — the Assumption Test. Calls `LLMProvider` directly with the claim + context. No tool chain, no evidence pipeline — that's Receipts' job, not yours.
- [ ] **Tests:** `POST /cases` returns a valid `Case` shape for a fixed input (use FastAPI's `TestClient`); `GET /cases/{id}/stream` yields events in SSE format for a manually-populated fake queue; `run_devils_advocate` on a fixture claim produces a `Finding` with non-empty `reasoning`.

**→ Update `PROGRESS.md` per box.**

## Hour 11-35 (→ Checkpoint 2)

- [ ] `POST /cases/{id}/confirm`: validates the (possibly user-edited) claim list, `asyncio.create_task(run_pipeline(case_id))`, **returns 202 immediately — does not await the pipeline.** This is the fix for the real race condition in the spec: if this awaited the full run, every SSE event fired during it would already be gone by the time the frontend's stream connection existed.
- [ ] `GET /cases/{id}`: full `Case`, for the evidence drawer, valid any time after `status == "done"`.
- [ ] `dispatch(item: TestPlanItem, case: Case)` routing: sends each `TestPlanItem` to the right evaluator by `failure_mode` (assumption → Devil's Advocate, evidence → Receipts, feasibility → Builder, edge-case → Overthinker) — this function lives wherever Dev A's `run_evaluators()` calls it from `core/loop.py`, but you're responsible for making sure your own evaluator is correctly wired into it. Coordinate with Dev A on the exact call site rather than guessing.
- [ ] Confirm every SSE event in `docs/00-CONTRACTS.md` §3 actually fires at the right moment with the right shape — this is the contract the frontend is building against, treat mismatches as bugs, not frontend's problem.
- [ ] Claim-confirmation checkpoint: make sure `POST /cases/{id}/confirm` genuinely gates on user confirmation (`awaiting_confirmation` → `testing`) rather than the frontend faking a pause client-side.
- [ ] **Tests:** `/confirm` responds in well under a second even when `run_pipeline` is mocked to take 10+ seconds (proves it's not awaiting); a full fake run through the queue produces SSE events in the documented order (`claim_map_ready` → `awaiting_confirmation` → `test_started`... → `run_complete`); `GET /cases/{id}` 404s or errors sensibly before `status == "done"` if that's the agreed behavior — confirm with Dev A.

**→ Update `PROGRESS.md`. Checkpoint 2.**

## Hour 35-48

- [ ] Stretch, only if hour 38 shows real slack and this is next in line after third-provider and document ingestion: `core/evaluators/overthinker.py` (Edge-Case Test) — same pattern as `devils_advocate.py`, no tool chain.
- [ ] Otherwise: help stress-test routes/SSE against the varied inputs Dev A is running through the eval set.
