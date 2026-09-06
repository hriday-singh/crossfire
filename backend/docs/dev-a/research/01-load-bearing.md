# RESEARCH FIRST — `classify_load_bearing()`

Owner: Dev A. Blocks: nothing at Hour 2-11 (ship a first pass), but the Hour 11-18 hardening pass needs the decision below written down before it's called done.

Question the function answers, per claim: **if this claim turns out false, would the recommended decision materially change?** Yes/no, not a confidence score.

Tweak any feature below and check the listed consumers — this value leaves your file and drives behavior in two other devs' code.

---

## Feature 1 — Question framing (the prompt itself)

What the LLM is actually asked. Must stay a single, explicit, checkable yes/no question — not "rate importance 1-10" reframed as a threshold. A vague framing here is the most likely source of noisy `load_bearing` flags downstream.

**Research before locking:** run 8-10 varied claims through 2-3 phrasings, check for stable yes/no agreement on obvious cases (a load-bearing assumption vs. a cosmetic detail) before picking one.

**If you change this:** re-run the hand-picked obvious-yes/obvious-no test pair from the Hour 2-11 checklist. If either flips, the phrasing regressed — don't ship the new wording without re-checking.

## Feature 2 — Inputs to the question

Currently: `claim` + `case` (for surrounding context). Whether `case.context` (ingested doc text, once that path exists) gets included changes how much the model can reason about materiality vs. judging the claim in isolation.

**If you change what's included:** the extraction pipeline (`extract_claims`) and this function currently run as separate calls — adding case-wide context here means this can no longer run standalone per-claim in a batch/parallel loop without also passing `case` through. Check `core/loop.py` call site isn't assuming claim-only input elsewhere.

## Feature 3 — Output parsing

Must return a plain `bool`, set onto `Claim.load_bearing` per `docs/00-CONTRACTS.md` §1. Use `response_schema` (structured output), not string-matching "yes"/"no" out of free text — that's the exact hand-parsed-JSON pattern `providers/base.py` is designed to avoid.

**If you change the return shape:** `Claim.load_bearing` is a frozen contract field (`bool | None`). Don't repurpose it into an enum or score without a live sync — Dev B's Feature 5 below reads this field directly as a bool.

## Feature 4 — Call site / timing

Runs once per claim, after `extract_claims()`, before `build_test_plan()`. `load_bearing` stays `None` until this runs — `build_test_plan()` and any consumer must not assume it's set earlier in the pipeline.

**If you change when this runs** (e.g., batch all claims in one call instead of per-claim): `run_pipeline()` sequencing in `docs/00-CONTRACTS.md` §4 assumes this completes before test-plan routing. Moving it later breaks that ordering silently — no exception, just claims routed without a load-bearing flag.

## Feature 5 — Downstream consumers (cross-file — check before shipping any tweak)

- **`evidence/fetch.py` (Dev B, hour 11-35):** the adaptive-scrutiny branch triggers a Scrapling deep-fetch *only* when `claim.load_bearing is True` and the Tavily snippet is thin. A change that makes this function return `True` more often directly increases Dev B's API spend (more deep-fetches) — flag any framing change that shifts the yes-rate to Dev B before merging.
- **`build_consequences()` (yours, hour 18-25):** every broken/unresolved claim that is also `load_bearing` must get a concrete `next_validation`. A stricter or looser `load_bearing` definition changes how many consequences carry that requirement.
- **`tests/eval_set/` (yours, hour 38-42):** hand-picked cases assert specific claims land as load-bearing or not. A framing change can silently flip a case's expected outcome — re-run the full eval set, not just the two hand-picked hour-11 cases.

## Rule for this file

Land the final phrasing + input shape here, in writing, before Antigravity implements the Hour 11-18 hardening pass. A vague "improve it" handoff produces a guess, not a decision.
