# Fix Backend Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 8 gaps documented in `BACKEND_GAPS.md` to ensure pipeline robustness, evaluator isolation, correct SSE events, and consistent data contracts.

**Architecture:**
1. Harden `core/evaluators/receipts.py` to prevent unsourced citations from generating contradictions.
2. Unify evaluator naming across `core/agent_panel.py` and `core/loop.py` using `FAILURE_MODE_TO_AGENT`.
3. Validate consequence `impact` against a strict whitelist `{"high", "medium", "low"}`.
4. Bound extracted claims to max 5 in `core/loop.py:extract_claims`.
5. Enforce evaluator input isolation in `core/loop.py:run_evaluators` using `case.model_copy()`.
6. Handle server restarts and mid-run interrupts via SQLite startup recovery in `backend/store.py` and fast-path SSE error termination in `api/routes.py`.
7. Support rationale strings on load-bearing claims (`Claim.load_bearing_reason`), dynamic load-bearing classification capped at `ceil(n/2)` (Option 1 selected by user), and publish `load_bearing_ready` SSE events.

**Tech Stack:** FastAPI, Pydantic v2, Python 3.14 / pytest, Next.js / TypeScript / vitest.

**Spec:** `BACKEND_GAPS.md`, `CROSSFIRE_PROJECT_SUMMARY.md`, `DESIGN.md`.

## Global Constraints
- Strictly maintain evaluator isolation: evaluators must never see other evaluators' findings.
- Never hardcode color/styling tokens; reuse existing design tokens.
- Maintain TypeScript strict mode and clean test passes on both backend and frontend.
- No database migrations applied automatically.
- No git commits made directly.
- Modular code: no single file exceeding 700 lines.

---

### Task 1: Evidence Gate Bypass via `_apply_citations` (Gap 6)

**Files:**
- Modify: `backend/core/evaluators/receipts.py:70-87,236-249`
- Test: `backend/tests/evaluators/test_receipts.py`

**Interfaces:**
- Consumes: `curated_items: list[EvidenceItem]`, `response.cited: list[Citation]`
- Produces: `Finding(contradiction=None if not kept or not response.cited else response.contradiction)`

- [ ] **Step 1: Write failing test in `backend/tests/evaluators/test_receipts.py`**
Test that when `ReceiptsAssessment` has `cited=[]` or citations that do not match any candidate URL, `finding.contradiction` is forced to `None` even if `response.contradiction` had text, and items are retained as unstanced context.

- [ ] **Step 2: Run test to verify it fails**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/evaluators/test_receipts.py -k "test_empty_citations_clears_contradiction"`
Expected: FAIL

- [ ] **Step 3: Update `core/evaluators/receipts.py`**
In `_apply_citations`: if `kept` is empty, reset all items' stance to `"context"` and return `items`.
In `run_receipts`: if `not response.cited` or not any citations matched, force `contradiction=None`.

- [ ] **Step 4: Run test to verify it passes**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/evaluators/test_receipts.py`
Expected: PASS

---

### Task 2: Evaluator Vocabulary Normalization (Gap 2)

**Files:**
- Modify: `backend/core/agent_panel.py:16-22`
- Modify: `backend/core/loop.py:440-506`
- Modify: `backend/tests/evaluators/test_overthinker.py`
- Test: `backend/tests/core/test_refinement.py`, `backend/tests/evaluators/test_overthinker.py`

**Interfaces:**
- Consumes: `AGENT_FAILURE_MODE`
- Produces: `FAILURE_MODE_TO_AGENT = {v: k for k, v in AGENT_FAILURE_MODE.items()}`

- [ ] **Step 1: Write failing test in `backend/tests/core/test_refinement.py`**
Test that a degraded finding created by `_degraded_finding` has `evaluator in ("devils_advocate", "receipts", "builder", "operator")`, and never `"assumption"`, `"evidence"`, etc.

- [ ] **Step 2: Run test to verify it fails**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_refinement.py -k "test_degraded_finding_evaluator_name"`
Expected: FAIL

- [ ] **Step 3: Implement inverted vocabulary mapping and update tests**
1. Define `FAILURE_MODE_TO_AGENT = {v: k for k, v in AGENT_FAILURE_MODE.items()}` in `core/agent_panel.py`.
2. In `_degraded_finding` and `test_started` event in `core/loop.py`, look up the evaluator using `FAILURE_MODE_TO_AGENT.get(item.failure_mode, item.failure_mode)`.
3. In `backend/tests/evaluators/test_overthinker.py`, update legacy assertions to accept `"operator"` to reflect the operational evaluator rename.

- [ ] **Step 4: Run tests to verify they pass**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_refinement.py backend/tests/evaluators/test_overthinker.py -c backend/pytest.ini`
Expected: PASS

---

### Task 3: Validate `impact` Whitelist After LLM Synthesis (Gap 5)

**Files:**
- Modify: `backend/core/loop.py:298-308`
- Test: `backend/tests/core/test_loop.py`

**Interfaces:**
- Consumes: `result.impact: str` from `StrategicConsequenceOutput`
- Produces: `consequence.impact` constrained to `{"high", "medium", "low"}`

- [ ] **Step 1: Write failing test in `backend/tests/core/test_loop.py`**
Test that if the LLM emits `"critical"`, `"extreme"`, or invalid strings, `consequence.impact` is preserved from its baseline status-derived value rather than taking the invalid string.

- [ ] **Step 2: Run test to verify it fails**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_loop.py -k "test_synthesize_consequence_invalid_impact_fallback"`
Expected: FAIL

- [ ] **Step 3: Implement impact guard in `core/loop.py`**
In `_synthesize_single_consequence`:
```python
if result.impact and result.impact.lower().strip() in {"high", "medium", "low"}:
    consequence.impact = result.impact.lower().strip()
```

- [ ] **Step 4: Run test to verify it passes**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_loop.py -k "test_synthesize_consequence"`
Expected: PASS

---

### Task 4: Bound Claim Count to 5 (Gap 7)

**Files:**
- Modify: `backend/core/loop.py:77-80`
- Test: `backend/tests/core/test_loop.py`

**Interfaces:**
- Consumes: `ExtractedClaims.statements: list[str]`
- Produces: `statements[:5]`

- [ ] **Step 1: Write failing test in `backend/tests/core/test_loop.py`**
Test that when `ExtractedClaims` returns 8 statements, `extract_claims` limits the resulting case to at most 5 claims.

- [ ] **Step 2: Run test to verify it fails**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_loop.py -k "test_extract_claims_clamps_to_five"`
Expected: FAIL

- [ ] **Step 3: Implement clamp in `core/loop.py`**
In `extract_claims`:
```python
statements = list(getattr(result, "statements", []) or [])[:5]
```

- [ ] **Step 4: Run test to verify it passes**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_loop.py -k "test_extract_claims_clamps_to_five"`
Expected: PASS

---

### Task 5: Evaluator Case Isolation (Gap 8)

**Files:**
- Modify: `backend/core/loop.py:460-498`
- Test: `backend/tests/core/test_loop.py`

**Interfaces:**
- Consumes: `case: Case`
- Produces: `isolated_case = case.model_copy(update={"findings": [], "consequences": [], "case_verdict": None})` passed to `dispatch()`

- [ ] **Step 1: Write failing test in `backend/tests/core/test_loop.py`**
Test that if `case` already has findings populated (e.g. from previous runs), the `case` passed into `dispatch` has empty findings and empty consequences.

- [ ] **Step 2: Run test to verify it fails**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_loop.py -k "test_run_evaluators_isolates_case"`
Expected: FAIL

- [ ] **Step 3: Implement isolation in `core/loop.py:run_evaluators`**
Pass `case.model_copy(update={"findings": [], "consequences": [], "case_verdict": None})` into `dispatch`.

- [ ] **Step 4: Run test to verify it passes**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_loop.py -k "test_run_evaluators_isolates_case"`
Expected: PASS

---

### Task 6: Zombie Case and Interrupted Stream Recovery (Gap 1)

**Files:**
- Modify: `backend/store.py`
- Modify: `backend/main.py`
- Modify: `backend/api/routes.py:101-115`
- Test: `backend/tests/api/test_routes.py`

**Interfaces:**
- Consumes: cases in SQLite with status `testing`
- Produces: `recover_interrupted_cases() -> int` setting status to `error`, fast-path SSE error in `stream_case`

- [ ] **Step 1: Write failing test in `backend/tests/api/test_routes.py`**
Test that:
1. `recover_interrupted_cases()` marks cases with status `"testing"` as `"error"`.
2. `GET /cases/{id}/stream` on a case with status `"testing"` and empty event history yields an `error` SSE event and closes cleanly without hanging or infinite pinging.

- [ ] **Step 2: Run test to verify it fails**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/api/test_routes.py -k "test_stream_case_interrupted"`
Expected: FAIL

- [ ] **Step 3: Implement recovery in `store.py`, `main.py`, and `api/routes.py`**
1. In `store.py`, add `recover_interrupted_cases()`.
2. In `main.py`, add `lifespan` handler that calls `store.recover_interrupted_cases()`.
3. In `api/routes.py:stream_case`, add check:
```python
if case.status == "testing" and not events.get_history(case_id):
    yield f"event: error\ndata: {json.dumps({'stage': 'run_pipeline', 'message': 'Run interrupted or server restarted'})}\n\n"
    return
```

- [ ] **Step 4: Run test to verify it passes**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/api/test_routes.py -k "test_stream_case_interrupted"`
Expected: PASS

---

### Task 7: Load-Bearing Rationale, Dynamic Cap, and `load_bearing_ready` SSE Event (Gap 3 & Gap 4)

**Files:**
- Modify: `backend/core/models.py:20-26`
- Modify: `backend/core/loop.py:128-188,520-530`
- Modify: `frontend/src/types/crossfire.ts:18-24,124-135`
- Modify: `frontend/src/hooks/useCaseStream.ts`
- Modify: `frontend/src/context/caseReducer.ts`
- Test: `backend/tests/core/test_loop.py`, `frontend/src/tests/caseReducer.test.ts`

**Interfaces:**
- Consumes: `Claim.load_bearing_reason: str | None = None`
- Produces: `load_bearing_ready` SSE event `{claim_id: str, load_bearing: bool, reason: str}`

- [ ] **Step 1: Write failing test in `backend/tests/core/test_loop.py`**
Test that:
1. `rank_load_bearing` supports rationale strings in `LoadBearingRanking` and saves them to `claim.load_bearing_reason`.
2. Dynamic classification allows 0 up to `ceil(n/2)` claims to be load-bearing.
3. `run_pipeline` publishes `load_bearing_ready` SSE events for each claim.

- [ ] **Step 2: Run test to verify it fails**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_loop.py -k "test_rank_load_bearing_rationale"`
Expected: FAIL

- [ ] **Step 3: Implement backend models, ranking, and event publishing**
1. In `core/models.py`, add `load_bearing_reason: str | None = None` to `Claim`.
2. In `core/loop.py`, update `LoadBearingRanking`:
```python
class LoadBearingRanking(BaseModel):
    ranked_indices: list[int] = Field(
        default_factory=list,
        description="Claim numbers in priority order. Every claim appears exactly once.",
    )
    load_bearing_count: int | None = Field(
        default=None,
        description="Number of claims that are genuinely load-bearing (materially change the decision if false). At most ceil(n/2), can be 0.",
    )
    reasons: list[str] = Field(
        default_factory=list,
        description="One explanation per claim in ranked_indices order explaining why it is load-bearing or secondary.",
    )
```
3. In `rank_load_bearing`, respect `load_bearing_count` clamped to `[0, ceil(n/2)]` (defaulting to `ceil(n/2)` if omitted or on fallback), assign `claim.load_bearing_reason`, and update `case.claims`.
4. In `run_pipeline`, emit `load_bearing_ready` events carrying `{claim_id, load_bearing, reason}`.

- [ ] **Step 4: Update frontend types and stream reducer**
1. In `frontend/src/types/crossfire.ts`, add `load_bearing_reason?: string | null` to `Claim`, and add `"load_bearing_ready"` to `SSEEventName`.
2. In `frontend/src/hooks/useCaseStream.ts`, listen for `"load_bearing_ready"`.
3. In `frontend/src/context/caseReducer.ts`, handle `"load_bearing_ready"` by updating the corresponding claim's `load_bearing` and `load_bearing_reason`.

- [ ] **Step 5: Run tests to verify they pass**
Run: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/core/test_loop.py -c backend/pytest.ini`
Run: `npm test -- --run` in `frontend`
Expected: PASS

---

### Task 8: Full Verification and Cleanup

**Files:**
- Modify: `BACKEND_GAPS.md` (mark items resolved)

- [ ] **Step 1: Run full backend test suite**
Run: `.\backend\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini`
Expected: 100% tests pass cleanly.

- [ ] **Step 2: Run full frontend test suite**
Run: `npm test -- --run` in `frontend`
Expected: 100% tests pass cleanly.

- [ ] **Step 3: Run progress checker**
Run: `python backend/progress.py`
Expected: 100% complete.

- [ ] **Step 4: Update `BACKEND_GAPS.md`**
Document fixes and audit status.
