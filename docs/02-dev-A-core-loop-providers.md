# Dev A — Core Loop + Providers (the spine)

**Why this one's yours:** every other module calls into what you're building. The two genuinely open design problems in the whole spec — how load-bearing gets decided, how conflicting evidence gets reconciled without a vote — live here, and both need the full context of the project to get right, not a narrow spec someone else can execute mechanically. It's also the piece where the most LLM iteration happens (prompt design for extraction, load-bearing, reconciliation), which is where your API credits will actually go.

**Files you own** (nobody else touches these):
```
providers/base.py       providers/gemini.py     providers/anthropic.py
providers/openai_compat.py
core/models.py          core/loop.py            core/evaluators/builder.py (hour 18+)
store.py                config.py               main.py (route wiring — see docs/05-PARALLEL-WORKFLOW.md)
tests/eval_set/          (harness — Dev B/C add their own cases into it)
```

**Never touch:** `api/`, `evidence/`, `core/evaluators/receipts.py`, `core/evaluators/devils_advocate.py`, `core/evaluators/overthinker.py`, `ingestion/`.

---

## Hour 0-2

- [ ] Write `core/models.py` exactly as specified in `docs/00-CONTRACTS.md` §1.
- [ ] Write `providers/base.py` — the `LLMProvider` protocol, `docs/00-CONTRACTS.md` §2.
- [ ] Share both with Dev B and Dev C before either of them writes code against them. This is the lock.
- [ ] `config.py`: `.env` loading via `python-dotenv`, including `DEMO_MODE` flag. Add `.env` to `.gitignore` in the same commit that creates it.

## Hour 2-11 (→ Checkpoint 1)

- [ ] `providers/gemini.py`: concrete `GeminiProvider` wrapping `google-genai`. When `response_schema` is set, use Gemini's native structured-output mode, not hand-parsed JSON.
- [ ] `providers/anthropic.py`, `providers/openai_compat.py`: empty stub classes implementing `LLMProvider`, nothing more yet.
- [ ] `core/loop.py`: `extract_claims(raw_input: str) -> Case` — one structured call (or a small chain, your call) through `GeminiProvider`, producing a `Case` in `awaiting_confirmation` status.
- [ ] `core/loop.py`: first pass at `classify_load_bearing(claim, case) -> bool`. The question the system asks is explicit and checkable: *if this claim turns out false, would the recommended decision materially change?* Don't return a raw confidence score — make the yes/no question itself the thing the LLM answers.
- [ ] `store.py`: `dict[str, Case]` keyed by case id. Simple get/set/delete.
- [ ] **Tests:** provider protocol conformance (a fake provider satisfying `LLMProvider` can be swapped in for `GeminiProvider` in tests — nothing should import `google-genai` directly outside `providers/gemini.py`); `extract_claims` on 2-3 fixed inputs produces a valid `Case`; `classify_load_bearing` on a hand-picked obvious-yes and obvious-no claim.

**→ Update `PROGRESS.md` when each box above is checked, not all at once at the end.**

## Hour 11-18

- [ ] `build_test_plan(case) -> list[TestPlanItem]`: route claims to test types by what the claim actually needs (evidence / alternative / behavior / constraint / failure-mode), not by which evaluator happens to be free.
- [ ] Harden `classify_load_bearing` across a wider set of claim types, not just the one demo input.
- [ ] **Tests:** test-plan routing sends different `failure_mode`s to different claim types (assert it isn't always the same three).

## Hour 18-25

- [ ] `reconcile(claim, findings: list[Finding]) -> tuple[ClaimStatus, str]` (status + `verdict_reasoning`). Resolution is evidence quality + traceability + how critical the claim is — **never a vote**. Genuinely conflicting or thin evidence → `UNRESOLVED`, not a forced winner.
- [ ] `build_consequences(case) -> list[DecisionConsequence]`. Every significant claim gets one. At least one broken/unresolved *load-bearing* claim per run needs a concrete `next_validation` — not "do more research."
- [ ] If evidence path + loop are both solid: start `core/evaluators/builder.py` (Feasibility Test). If not, skip without guilt — this is explicitly optional at this stage.
- [ ] **Tests:** `reconcile` with unanimous strong evidence → confident status; `reconcile` with conflicting evidence → `UNRESOLVED`; `build_consequences` always sets `next_validation` for broken+load-bearing claims.

## Hour 25-30

- [ ] Wire the full `run_pipeline()` orchestration per `docs/00-CONTRACTS.md` §4 — `asyncio.create_task`, never awaited inline from `/confirm`.
- [ ] `asyncio.Queue` per case_id for SSE; push each stage's event as it happens; close + drop the queue on `run_complete` (or timeout with no consumer) so a multi-run demo session doesn't leak memory.
- [ ] Second provider wired end-to-end (Anthropic or OpenAI-compatible — pick whichever SDK is less friction once you're actually looking at it).
- [ ] **Tests:** `/confirm`-equivalent call returns fast even when `run_pipeline` is slow (mock it with `asyncio.sleep`); queue emits events in the right order for a fixed fake pipeline; second provider passes the same protocol-conformance test as Gemini.

## Hour 30-35 (→ Checkpoint 2)

- [ ] Run the full loop against 3-4 different inputs, not just the original demo one. Fix whatever breaks at the seams with Dev B's evidence output or Dev C's routes.
- [ ] Confirm every `Finding`/`DecisionConsequence` the evidence drawer needs is actually populated, not just structurally present.

**→ Update `PROGRESS.md`. Checkpoint 2.**

## Hour 35-48

- [ ] Own the `tests/eval_set/` harness: turn the 5-10 hand-picked internal validation cases into pytest, one function per case, asserting the property it was chosen for (obvious flaw → `broken`, a fine idea → mostly `survived`, mixed evidence → `unresolved`).
- [ ] Because you understand the whole spine, you're the natural triage point for cross-module bugs that show up during rehearsal — keep slack in your schedule here rather than starting new features.
