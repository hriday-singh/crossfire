# Crossfire Backend Refinement Plan

Written after a live end-to-end assessment (2 real runs against the local proxy, 174 tests).
Baseline measured, not assumed:

| Run | Time | Claims | Findings | Verdicts |
|---|---|---|---|---|
| College-application AI (autonomous submit) | 62s | 5 | 20 | 5 broken |
| Stripe Checkout vs custom form | 35s | 4 | 16 | 2 survived, 2 unresolved |

Evidence retrieval is real (4 URLs + curated snippets per claim, live DuckDuckGo).
Verdict spread is honest — `survived` is reachable. The skeleton runs.

What follows is what stands between "it runs" and "it is usable and defensible".

Decisions locked with the product owner before this plan was written:
1. No-evidence findings can never break a claim. Only a sourced contradiction breaks.
2. Load-bearing is a **ranking** across claims, not an independent yes/no per claim.
3. The run ends with a case-level verdict and deduped actions, not N repeated ones.
4. Output must be readable and specific. Not truncated, not redacted — shorter and more concrete *at generation*.

---

## Stage 0 — Stop destroying data (blocking)

**Bug:** `store.CaseDict.clear()` calls `_clear_db()`, which runs `DELETE FROM cases`
against the real `backend/crossfire.db`. `tests/conftest.py:77,81` calls it in an
autouse fixture — twice per test, ~174 tests. Every `pytest` run wipes production data.

- `store.py`: resolve `SQLITE_DB_PATH` lazily per connection instead of at import.
- `tests/conftest.py`: session-scoped autouse fixture pointing `SQLITE_DB_PATH` at a tmp file.

Touches: `store.py`, `tests/conftest.py`. No contract change.

---

## Stage 1 — Make verdicts defensible

### 1a. Evidence gate on `broken`
Direction doc §13: *a claim's status should only move because of evidence traceable to
an actual source.* Today 3 of 4 evaluators emit `evidence=[]` by design, and the college
run went 5/5 `broken` while every Receipts finding said "unsupported" — absence of
evidence read as refutation.

Deterministic post-reconcile gate: `broken` requires at least one finding carrying both
non-empty `evidence` **and** a `contradiction`. Otherwise downgrade to `weakened`, and say
so in the verdict reasoning. Reasoning-only evaluators can weaken; they cannot break.

### 1b. Load-bearing becomes a ranking
Measured: 9 of 9 claims across both runs came back `load_bearing=True`. The classifier
never says no, so `build_test_plan` runs all four evaluators on everything and adaptive
scrutiny does not exist in the running system.

Replace the per-claim boolean call with one ranking call over the whole claim set, capped
at `ceil(n/2)` load-bearing (minimum 1). Then `build_test_plan` actually differentiates:
load-bearing claims get the full four-evaluator panel, secondary claims get a single
evidence pass. That is the real answer to "why wait longer than a prompt".

### 1c. No silent evaluator loss
`run_evaluators` drops exceptions with `isinstance(r, Finding)` — no log, no event.
Observed live: the PII claim emitted `test_started` for Receipts and no finding ever
arrived; the frontend row stays pinned open forever.

Emit a degraded `Finding` (confidence 0, result names the failure) instead of dropping it,
and log at warning. Not an `error` SSE event — `routes.py` terminates the stream on
`error`, which would kill the whole run for one failed test.

Touches: `core/loop.py`, tests. No contract change.

---

## Stage 2 — Make the evidence worth reading

- **Query construction.** `search_evidence` posts `claim.statement` verbatim. Full-sentence
  predictions are poor search queries; this is why Receipts lands on "inconclusive" so often.
  Derive a short keyword query per claim.
- **Source quality.** `ryter.pro`, `oreateai.com`, `spiderhunts.com` currently sit next to
  `docs.stripe.com` and `commonapp.org` at equal weight. Rank by domain class
  (primary/official > institutional/press > blog) and surface the class in the drawer.
- **Cite what was used.** All four search hits are attached to the finding whether the
  evaluator referenced them or not. Have Receipts name the sources it relied on; keep those.

Touches: `evidence/search.py`, `core/evaluators/receipts.py`, tests.

---

## Stage 3 — Readability and relevance (Screen 3 + evidence drawer)

The complaint: too much information, and it reads like generic AI advice.
The fix belongs at generation, not at display. Nothing gets hidden or truncated.

- **Bound the schemas.** `result` is one line. `reasoning` is capped at three sentences.
  Prompts require a named specific — a platform, a number, a policy, a source — and
  explicitly forbid advisor filler ("consider", "it is important to note", "stakeholders").
- **Rank findings inside a claim.** The drawer leads with the finding that actually moved
  the verdict, not with whichever evaluator returned first.
- **Evidence items carry a stance.** `supports` / `contradicts` / `context`, so the drawer
  can group instead of listing four undifferentiated links.
- **Group the live screen by claim.** `test_started` fires 16–20 times per run. Every event
  already carries `target_claim_id`; the dashboard should collapse to one row per claim with
  a test counter rather than 20 flat rows. Frontend change, backend already supplies the key.

Touches: evaluator schemas + prompts, `core/models.py` (additive), frontend Screen 3.
**Contract change** — additive fields only, needs a Dev B / Dev C sync.

---

## Stage 4 — Case-level synthesis

Today the run ends with N claim cards and N near-identical consequences (the college run
produced five separate "pivot to human-in-the-loop, run a 14-day pilot").

One final call producing: the overall decision state, what survived / broke / is unproven,
and two to three merged next actions. New `Case` field + a `case_verdict` SSE event.

Touches: `core/loop.py`, `core/models.py`, `api/routes.py`, frontend. **Contract change.**

---

## Stage 5 — Input gating and cleanup

- **Input boundary** (direction doc §3): pure ideation ("build something cool for students")
  and open-ended life advice must be redirected toward naming a concrete decision, not
  silently turned into invented claims. Currently unimplemented.
- **Dead code:** `_FAILURE_MODE_WEIGHTS` in `core/loop.py` — 85 lines computed and then
  discarded in panel mode; the real routing lives in two hardcoded keyword lists below it.
- **Signature drift:** `receipts`, `devils_advocate` and `overthinker` each `isinstance`-sniff
  three different argument orders, violating frozen contract §4, and `dispatch()` carries a
  compensating branch for it. Collapse to the one contract signature.
- **Runaway fan-out:** ~35 LLM calls dispatch at once with a 120s per-call httpx timeout.
  Add a concurrency cap and a per-call timeout.

---

## Stage 6 — The baseline

Direction doc §10 is the whole "better than a good prompt" argument and has no backend
support today. Add an endpoint that runs one plain, un-engineered model call on the same
raw input and returns it alongside the case, so the contrast is demonstrable rather than
asserted. The plain call is not to be sandbagged.

Touches: new route, `core/loop.py`. **Contract change.**
