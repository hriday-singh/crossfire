# Handoff Tags — Antigravity vs Research-First

Cross-reference for `docs/02-dev-A-core-loop-providers.md`, `docs/03-dev-B-evidence-receipts.md`, `docs/04-dev-C-api-sse-evaluators.md`. Two states only, per checklist section:

- **ANTIGRAVITY** — spec is fully mechanical. Dev says: *"Go to planet Antigravity and implement it."* No open design question left; agent builds straight from the doc + `docs/00-CONTRACTS.md`.
- **RESEARCH FIRST** — spec has an open design question that needs a real decision before an agent should touch code. Dev researches/decides first, writes the decision back into the doc, *then* sends it to Antigravity.

---

## Dev A — [`dev-a/`](dev-a/README.md) (spec still at `02-dev-A-core-loop-providers.md`)

**RESEARCH FIRST**, detailed feature by feature in [`dev-a/research/`](dev-a/research/):

- [`01-load-bearing.md`](dev-a/research/01-load-bearing.md) — `classify_load_bearing()` (Hour 2-11 + hardening at Hour 11-18). No fixed algorithm given, only the yes/no question shape.
- [`02-reconcile.md`](dev-a/research/02-reconcile.md) — `reconcile()` (Hour 18-25). Explicitly "never a vote," resolution by evidence quality + traceability + criticality — that weighting isn't specified.

**ANTIGRAVITY (everything else):** `core/models.py`, `providers/base.py`, `providers/gemini.py` (schema shape is frozen, Gemini structured-output mode is a known API), `providers/anthropic.py`/`openai_compat.py` stubs, `store.py`, `config.py`, `build_test_plan()` routing table, `build_consequences()`, full `run_pipeline()` wiring, second-provider integration, `tests/eval_set/` harness.

## Dev B — [`dev-b/`](dev-b/README.md) (spec still at `03-dev-B-evidence-receipts.md`)

**RESEARCH FIRST:** none. Every task has a concrete algorithm or API call named (DuckDuckGo Lite search shape, curation heuristic, Scrapling trigger condition, demo-fixture switch, failure-degradation rule).

**ANTIGRAVITY:** all of it, in order — `evidence/search.py`, `evidence/curate.py`, `core/evaluators/receipts.py`, `evidence/fetch.py`, adaptive-scrutiny branch, demo fallback switch, failure handling, stretch `ingestion/pdf.py`.

## Dev C — [`dev-c/`](dev-c/README.md) (spec still at `04-dev-C-api-sse-evaluators.md`)

**RESEARCH FIRST:** none. Routes, SSE re-emission, and `devils_advocate.py` all follow `docs/00-CONTRACTS.md` §3/§4 exactly — no undecided behavior.

**ANTIGRAVITY:** all of it — `api/schemas.py`, `POST /cases`, `GET /cases/{id}/stream`, `run_devils_advocate()`, `POST /cases/{id}/confirm`, `GET /cases/{id}`, `dispatch()` wiring, stretch `overthinker.py`.

---

## Rule

A RESEARCH FIRST item that gets sent to Antigravity before the decision is written down just produces code implementing a guess. Decide, write the decision into the dev doc (replace the open question with the actual rule), then hand off.
