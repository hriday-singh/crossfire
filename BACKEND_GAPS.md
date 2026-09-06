# Backend Gaps — Pipeline Audit

Audited against `CROSSFIRE_PROJECT_SUMMARY.md` (steps 1–7) and `DESIGN.md`.
Personas excluded (owned separately).

**Pipeline verdict:** every step exists and is wired. `POST /cases` (extract +
input gate) → `confirm` (validate, 202) → background `run_pipeline` →
`rank_load_bearing` → `build_test_plan` → `run_evaluators` (capped fan-out,
per-call timeout, degraded finding on failure) → parallel `reconcile` +
`apply_evidence_gate` → `rank_findings` → `build_consequences` + LLM synthesis
→ `synthesize_case_verdict` → `run_complete`, `store.set` in `finally`.
Evaluator isolation holds. Below is what does not match the plan.

**Closed:** rate limiting removed (`api/rate_limiter.py` deleted, dependencies
and tests stripped). Open-source, self-hosted, single-user — the limiter only
ever throttled the operator's own machine.

**Status:** All 8 audit gaps resolved and covered with unit tests. Full backend suite passing (229 passed, 8 skipped).

---

## 1. Restart mid-run leaves a zombie case and a stream that never ends [RESOLVED]
`events.py`, `store.py`, `main.py`, `api/routes.py:107`

- **Fix Applied:**
  - Added `recover_interrupted_cases()` in `store.py` to transition any cases left in `testing` to `error` on startup.
  - Wired FastAPI lifespan context in `main.py` to trigger startup recovery.
  - In `stream_case` (`api/routes.py`), added fast-path check: if status is `testing` and `events.get_history()` is empty, emit `error` with `"Run interrupted or server restarted"` and terminate immediately.
  - Verified with dedicated tests in `tests/api/test_recovery.py`.

## 2. `Finding.evaluator` uses two different vocabularies [RESOLVED]
`core/agent_panel.py`, `core/loop.py: _degraded_finding`

- **Fix Applied:**
  - Added `FAILURE_MODE_TO_AGENT` inverted map in `core/agent_panel.py`.
  - Updated `_degraded_finding` and `test_started` event in `core/loop.py` to use `FAILURE_MODE_TO_AGENT.get(item.failure_mode, item.failure_mode)` so evaluators always map to the canonical agent IDs (`devils_advocate | receipts | builder | operator`).
  - Updated legacy test assertions in `tests/evaluators/test_overthinker.py`.

## 3. Load-bearing has no rationale and no SSE event [RESOLVED]
`core/models.py`, `core/loop.py: rank_load_bearing`

- **Fix Applied:**
  - Added `load_bearing_reason: str | None = None` to `Claim` model in `core/models.py`.
  - Added `reasons` field to `LoadBearingRanking` in `core/loop.py` and populated `claim.load_bearing_reason`.
  - In `run_pipeline`, published `load_bearing_ready` SSE event carrying `{claim_id, load_bearing, reason}` immediately after ranking.
  - Updated frontend types (`frontend/src/types/crossfire.ts`), listener (`useCaseStream.ts`), and reducer (`caseReducer.ts`).

## 4. `ceil(n/2)` cap is not the classifier the plan describes [RESOLVED]
`core/loop.py: load_bearing_cap`

- **Resolution (Option 1):** Dynamic count clamped at ceiling (`ceil(n/2)`).
  - Added `load_bearing_count` to `LoadBearingRanking` schema.
  - Clamped between `0` and `ceil(n/2)`: cases with zero truly load-bearing claims can now legitimately return 0, while high-stakes cases are bounded by the cost-control ceiling.
  - Tested in `tests/core/test_loop.py`.

## 5. `impact` is unvalidated after LLM synthesis [RESOLVED]
`core/loop.py: _synthesize_single_consequence`

- **Fix Applied:**
  - Added whitelist guard: only assign `consequence.impact = result.impact.strip().lower()` if in `{"high", "medium", "low"}`, otherwise preserving the status-derived baseline impact.
  - Tested in `tests/core/test_loop.py`.

## 6. Evidence gate bypass via `_apply_citations` [RESOLVED]
`core/evaluators/receipts.py:88`

- **Fix Applied:**
  - Updated `_apply_citations`: if `kept` is empty, resets all evidence items to `stance="context"`.
  - Updated `run_receipts`: if `response.cited` is empty or no citations matched retrieved sources, forces `contradiction=None`.
  - Tested in `tests/evaluators/test_receipts.py`.

## 7. Claim count unbounded [RESOLVED]
`core/loop.py: extract_claims`

- **Fix Applied:**
  - Clamped `statements[:5]` immediately after extracting statements from `ExtractedClaims`.
  - Tested in `tests/core/test_loop.py`.

## 8. Evaluators receive the full `case`, findings included [RESOLVED]
`core/loop.py: run_evaluators`

- **Fix Applied:**
  - In `run_evaluators`, created `isolated_case = case.model_copy(update={"findings": [], "consequences": [], "case_verdict": None})` and passed it into `dispatch`.
  - Verified that evaluators never receive findings or verdicts from other runs or rehydrated rows in `tests/core/test_loop.py`.
