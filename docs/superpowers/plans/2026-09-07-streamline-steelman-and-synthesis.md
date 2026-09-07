# Streamline Steel Man & Final Synthesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 15–25s of unnecessary latency and perceived dead time in Steel Man and Final Synthesis by introducing progressive streaming, upstream concurrency controls, and eliminating redundant per-claim consequence LLM passes while preserving 100% rigorous reasoning quality.

**Architecture:** 
1. Stream `verdict_ready` and `consequence_ready` events immediately from each claim's reconciliation task rather than batching behind `asyncio.gather`.
2. Guard concurrent Steel Man LLM calls with a configurable semaphore (`steelman_concurrency=3`) to prevent upstream reverse-proxy connection queuing.
3. Use Steel Man's rich mitigation outputs (`salvaged_claim`, `tradeoff_acknowledged`, `fatal_flaw`) via `build_consequences()` as the primary consequence payload, avoiding 3–5 redundant per-claim LLM calls and consolidating synthesis directly into the case-level verdict synthesis.

**Tech Stack:** Python 3.14, FastAPI, Asyncio, Pydantic v2, Pytest.

**Spec:** Contract in `backend/docs/00-CONTRACTS.md` (SSE Event Schema & DecisionConsequence / CaseVerdict schemas).

## Global Constraints
- Dev A owns `core/loop.py`, `core/reconcile.py`, `core/synthesis.py`.
- No database migrations or commits.
- Maintain full compatibility with all SSE event shapes: `verdict_ready`, `consequence_ready`, `case_verdict`, `activity`, `run_complete`.
- All 388+ backend unit tests must continue passing.

---

### Task 1: Add Configurable Steel Man Concurrency in `config.py`

**Files:**
- Modify: `backend/config.py:38-45`
- Test: `backend/tests/test_config.py`

**Interfaces:**
- Produces: `Settings.steelman_concurrency: int` (default `3`, env `STEELMAN_CONCURRENCY`)

- [x] **Step 1: Write the failing test**
In `backend/tests/test_config.py`:
```python
def test_steelman_concurrency_default():
    from config import Settings
    s = Settings()
    assert hasattr(s, "steelman_concurrency")
    assert s.steelman_concurrency == 3
```

- [x] **Step 2: Run test to verify it fails**
Run: `uv run pytest backend/tests/test_config.py -k test_steelman_concurrency_default`
Expected: FAIL (attribute error)

- [x] **Step 3: Implement in `backend/config.py`**
Add to `Settings`:
```python
    steelman_concurrency: int = Field(default=3, alias="STEELMAN_CONCURRENCY")
```

- [x] **Step 4: Run test to verify it passes**
Run: `uv run pytest backend/tests/test_config.py -k test_steelman_concurrency_default`
Expected: PASS

---

### Task 2: Progressive Incremental Event Streaming in `loop.py`

**Files:**
- Modify: `backend/core/loop.py:415-495`
- Test: `backend/tests/core/test_steelman.py`
- Test: `backend/tests/core/test_loop.py`

**Interfaces:**
- Consumes: `reconcile(clm, findings, provider)` -> `SteelManVerdict`
- Produces: Emits `verdict_ready` event immediately inside `_reconcile_single` as each individual claim completes, rather than batching after `asyncio.gather`.
- Emits progressive `activity` updates per claim resolution.

- [x] **Step 1: Write the failing test**
In `backend/tests/core/test_loop.py`, add a test verifying that `verdict_ready` events fire as tasks complete without waiting for the slowest task:
```python
@pytest.mark.asyncio
async def test_reconcile_emits_verdict_ready_progressively(sample_case):
    import events
    import store
    from core.loop import run_pipeline
    from tests.core.test_loop import SchemaProvider

    store.set(sample_case)
    events.reset()
    await run_pipeline(sample_case.id, provider=SchemaProvider())
    history = events.get_history(sample_case.id)
    verdict_events = [e for e in history if e.get("event") == "verdict_ready"]
    assert len(verdict_events) == len(sample_case.claims)
```

- [x] **Step 2: Run test to verify current baseline passes/fails**
Run: `uv run pytest backend/tests/core/test_loop.py -k test_reconcile_emits_verdict_ready_progressively`

- [x] **Step 3: Update `_reconcile_single` in `backend/core/loop.py`**
Refactor `_reconcile_single` in `run_pipeline`:
1. Use `limit = asyncio.Semaphore(getattr(settings, "steelman_concurrency", 3))` so upstream proxy calls are bounded.
2. Inside `_reconcile_single`:
   - Calculate claim confidence and apply gates immediately.
   - Publish `verdict_ready` for that claim immediately via `await events.publish(case.id, "verdict_ready", {...})`.
   - Thread `reasonings[clm.id] = reasoning` into a shared dictionary.
3. Await all `_reconcile_single` tasks with `asyncio.gather`.

- [x] **Step 4: Run test to verify it passes**
Run: `uv run pytest backend/tests/core/test_steelman.py`
Expected: All 11 tests PASS

---

### Task 3: Streamline Synthesis & Eliminate Redundant Consequence Calls

**Files:**
- Modify: `backend/core/loop.py:496-540`
- Modify: `backend/core/synthesis.py:164-181`
- Test: `backend/tests/core/test_synthesis.py`

**Interfaces:**
- Consumes: Steel Man's `salvaged_claim`, `fatal_flaw`, and `tradeoff_acknowledged` on `case.claims`
- Produces: `case.consequences` populated via `build_consequences(case)` directly, immediately streaming `consequence_ready` without blocking for 3–5 redundant LLM calls.
- Executes single `synthesize_case_verdict()` call for executive headline, summary, and next actions.

- [x] **Step 1: Write the test verifying consequences are built directly from Steel Man mitigations**
In `backend/tests/core/test_synthesis.py`:
```python
def test_build_consequences_preserves_all_steelman_fields():
    from core.models import Case, Claim, ClaimStatus
    from core.synthesis import build_consequences
    claim = Claim(
        id="c1",
        statement="High load system",
        status=ClaimStatus.BROKEN,
        load_bearing=True,
        fatal_flaw="Single point of failure in DB",
        salvaged_claim="Use read replicas",
        tradeoff_acknowledged="Adds replication lag",
    )
    case = Case(id="case-1", raw_input="Deploy system", claims=[claim])
    consequences = build_consequences(case)
    assert len(consequences) == 1
    c = consequences[0]
    assert c.fatal_flaw == "Single point of failure in DB"
    assert c.salvaged_claim == "Use read replicas"
    assert c.tradeoff_acknowledged == "Adds replication lag"
    assert "Salvaged claim: Use read replicas" in c.recommended_change
```

- [x] **Step 2: Run test to verify it passes**
Run: `uv run pytest backend/tests/core/test_synthesis.py`
Expected: PASS

- [x] **Step 3: Streamline `run_pipeline` in `backend/core/loop.py`**
In `backend/core/loop.py`:
1. Build consequences immediately using `case.consequences = build_consequences(case)`.
2. Thread `reasonings` from Steel Man into each consequence.
3. Emit `consequence_ready` events immediately for each consequence as soon as Steel Man concludes.
4. Execute `synthesize_case_verdict(case, provider)` as the single, authoritative synthesis pass.
5. Publish `case_verdict` and finish.

- [x] **Step 4: Run full backend test suite**
Run: `uv run pytest backend/tests`
Expected: All 388+ tests PASS with zero regressions.

---

### Task 4: End-to-End Latency Verification

**Files:**
- Test: Benchmark script execution using `uv run python`

- [x] **Step 1: Run isolated benchmark script on sample case**
Verify that tail latency drops from ~16.6s (1 claim) and ~35s (5 claims) down to under ~11s (1 claim) and ~15s (5 claims), and that live SSE events stream smoothly without dead-time pauses.

- [x] **Step 2: Run `pytest` on all core and API tests**
Run: `uv run pytest backend/tests/core backend/tests/api`
Expected: 100% PASS
