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

---

## 1. Restart mid-run leaves a zombie case and a stream that never ends
`events.py`, `api/routes.py:107`

Cases persist to SQLite; event history is in-memory only. If the process
restarts while a case is `testing`, the DB row stays `testing` forever, and
`stream_case` fast-paths only `done`/`error` — so a reconnect falls into
`events.subscribe()` and emits `: ping` every 15s indefinitely. No reaper, no
resume.

**Fix:** on startup, mark any case still in `testing` as `error` with a
"run interrupted" message. In `stream_case`, if status is `testing` and
`events.get_history()` is empty, emit `error` and close instead of subscribing.

## 2. `Finding.evaluator` uses two different vocabularies
`core/loop.py` `_degraded_finding`

Contract: `devils_advocate | receipts | builder | overthinker`. Real findings
comply. `_degraded_finding` writes `evaluator=item.failure_mode` — `"assumption"`.
A timed-out or failed test therefore maps to no known test name in the UI.

**Fix:** invert `AGENT_FAILURE_MODE` and write the agent id in
`_degraded_finding`. One lookup.

## 3. Load-bearing has no rationale and no SSE event
`core/loop.py` `rank_load_bearing`

Returns bare booleans. `DESIGN.md` promises the drawer explains *why* a claim is
load-bearing — nothing stores that. And no event fires between
`claim_map_ready` and `verdict_ready`, so the frontend cannot badge core
assumptions until the final `GET /cases/{id}`.

**Fix:** add one `reason` string per ranked claim to `LoadBearingRanking`,
persist it (new `Claim.load_bearing_reason`, additive), and publish a
`load_bearing_ready` event carrying `{claim_id, load_bearing, reason}`.

## 4. `ceil(n/2)` cap is not the classifier the plan describes — decide
`core/loop.py` `load_bearing_cap`

Plan asks: "if this claim turns out false, does the decision materially change?"
Code forces exactly half of the claims load-bearing regardless of the answer.
Five genuinely critical claims → two flagged. Five trivial ones → two flagged
anyway. Adaptive scrutiny becomes fixed scrutiny.

**Options:** keep the cap as declared cost control and say so in the doc; or
let the model return a count and clamp only at the ceiling (`ceil(n/2)`) so a
low-stakes case can legitimately return zero. Needs a call, not a patch.

## 5. `impact` is unvalidated after LLM synthesis
`core/loop.py` `_synthesize_single_consequence`

`consequence.impact = result.impact.lower()` — no whitelist. The model can emit
`"critical"` or `"medium-high"` and it reaches the frontend, which colors on
`high|medium|low` only.

**Fix:** one guard — assign only if in `{"high","medium","low"}`, else keep the
status-derived value.

## 6. Evidence gate bypass via `_apply_citations`
`core/evaluators/receipts.py:88`

Returns `kept or items`: when the model cites nothing, all search hits attach as
evidence anyway. Combined with `contradiction if evidence else None`, a
contradiction the model never tied to any source passes
`has_sourced_contradiction()` and can break a claim — exactly what the Stage-1a
gate exists to prevent.

**Fix:** when `cited` is empty, keep the items as unstanced context but force
`contradiction=None`. A break should require a source the evaluator named.

## 7. Claim count unbounded
`core/loop.py` `extract_claims`

Prompt asks for 2–5; code clamps nothing. Fan-out is claims × 4 evaluators, so a
12-claim extraction is 48 LLM calls.

**Fix:** `statements[:5]` at the mapping step.

## 8. Evaluators receive the full `case`, findings included
`core/loop.py` `run_evaluators`

Empty on a first run, so isolation holds today. But a re-run, or a case rehydrated
from SQLite, would put other evaluators' findings inside every evaluator prompt —
structurally breaking the ground rule in `CROSSFIRE_PROJECT_SUMMARY.md` §9.1.

**Fix:** pass `case.model_copy(update={"findings": [], "consequences": [], "case_verdict": None})`
into `dispatch`.

---

## Suggested order
6 → 2 → 5 → 7 (small, contained, each with a test), then 1 (needs a startup
hook), then 3 (touches the model + frontend contract). 4 is a decision.
