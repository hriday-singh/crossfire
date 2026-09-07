# Calibration Round 3 — Design

**Date:** 2026-09-07
**Owner:** Dev A
**Baseline:** `docs/calibration/02-round2-report.md` (commit `0e082bf`)
**Corpus spec:** `docs/calibration/00-corpus-spec.md`

---

## 1. Problem

Round 2 fixed the `weakened` attractor and the confidence-scale collisions, but the
two headline numbers did not move:

| Metric | Round 1 | Round 2 | Round 3 target |
| :--- | :---: | :---: | :---: |
| Mean distinguishability vs. vanilla Gemini | 2.07 | 2.07 | **≥ 2.5** |
| `proceed` verdicts | 0 / 15 | 0 / 15 | reachable in Band A |
| `drop` verdicts | 7 / 15 | 0 / 15 | reachable in Band B |
| Claims landing `unresolved` | 14.8% | 40.4% | Band C high, Band A/B low |
| Devil's Advocate minimum confidence | 0.25 | 0.30 | 0.0 reachable |

These are one problem, not five.

The distinguishability rubric scores 2 for "surfaces a specific fact, number, statute
or contradiction the control missed" and 3 for "reaches a materially different,
evidence-backed conclusion." Round 2 scored 2 on 14 of 15 cases and 3 on one. The
mean cannot pass 2.5 while Crossfire out-cites the control but lands on the same
shape of answer — a hedged middle. Vanilla Gemini hedges too. The differentiator is
a decisive call, and both decisive endpoints are currently unreachable by
construction.

So the harshness bias and the score ceiling have the same fix: restore the ends of
the ladder without loosening the guard against Band B overshoot.

### 1.1 Why each endpoint is unreachable

**`proceed`.** `_fallback_decision_state` (`core/synthesis.py:317`) already filters to
load-bearing claims, so this is not a scoping bug. It is the `unresolved` branch:
`any(c.status is UNRESOLVED for c in lb)` returns `hold`, which sits *below*
`proceed_with_changes` in `_STATE_PERMISSIVENESS`. One unresolved claim among several
survived ones is therefore treated as more restrictive than a claim that actively
failed. `a1-notion-migration` landed `survived, unresolved` and was forced to `hold`.

**`drop`.** Steel Man Axiom 3 (`core/reconcile.py:105`) states the judge is "strictly
forbidden from simply rejecting" a failed claim and must always emit a salvage. The
ladder reads `all(salvaged)` as "there is something left to do here" and returns
`proceed_with_changes`. Because the salvage is mandatory, `all(salvaged)` is always
true and the `drop` branch is dead code. `b1-phi-google-drive` (45 CFR § 164.312) and
`b2-14-hour-shifts` (49 CFR § 395.3) both exited as `proceed_with_changes`.

**The `unresolved` pileup.** The Round 2 discriminator prompt
(`core/reconcile.py:96-101`) routes to `unresolved` any "pure counterfactual — doing X
now rather than later will produce Y" and any "claim about how a specific customer
base, market or person will behave when nobody has measured them." Between them these
two clauses cover most forward-looking business claims, which is why Round 1's
`weakened` pileup reappeared as an `unresolved` pileup (14.8% → 40.4%). Band C at 80%
is correct behavior; Band A at 16.7% and Band B at 30.8% are not.

**Devil's Advocate.** The prompt asks for two incompatible things. Temporal Inversion
(`devils_advocate.py:37-40`) fixes the evaluator in "a fixed future state 12 months
post-launch in which the user's proposal has completely and definitively failed" and
asks it to explain the collapse. The ABSTAIN protocol four lines later asks it to
report no objection when the premise holds. The frame wins: minimum confidence 0.30,
median 0.75, 34 of 39 findings at or above 0.70. DA is additionally `_FALLBACK` in
`core/evaluators/__init__.py:60`, so any unrecognised `failure_mode` fires the
harshest evidence-free evaluator in the panel.

---

## 2. Non-goals

- The templated summary opener stays. `CASE_VERDICT_SYSTEM_PROMPT` instructs the model
  to open with "After evaluation, we found that…" and all 15 Round 2 summaries do.
  Flagged, deliberately out of scope for this round.
- No change to search, retrieval, curation, or the cross-examination probe. Probe
  capture was 5.6% in Round 2 and the mechanism is behaving.
- No change to `rank_load_bearing`. `a2-treasury-mmf` marked its cash-buffer claim
  load-bearing and that claim genuinely broke; that is a ranking judgement, not a
  ladder defect, and re-tuning it in the same round would confound the measurement.
- No new evaluator, no new pipeline stage.

---

## 3. Design

Five changes. Four of them fix the *inputs* to the ladder; one changes the ladder.

### 3.1 Tighten the `unresolved` discriminator

**Files:** `core/reconcile.py`, `core/models.py`

Largest single lever: 40.4% of all claims land here and every load-bearing one forces
`hold`.

*Prompt.* Remove both over-reaching clauses. A forward-looking claim is not
automatically unresolvable, and neither is a claim about market or customer behavior —
public benchmarks settle many of them, which is the Researcher's entire job. Replace
with a single requirement: `unresolved` means a specific, obtainable input decides the
claim and the user did not supply it.

*Schema.* Add `missing_input: str | None` to `SteelManVerdict`, and the mirror field to
`Claim` in `core/models.py`. When status is `unresolved`, this field names the exact
number, document, or measurement that would settle it. It is null for every other
status, enforced the same way the salvage fields already are in `reconcile()` and
`apply_steelman_gate()`.

*Mechanical enforcement.* In `apply_evidence_gate`, an `unresolved` verdict carrying no
`missing_input` is re-graded:

- to `weakened` if any finding carries a sourced contradiction
  (`has_sourced_contradiction`);
- otherwise through the existing trivial-objection test — `survived` when every active
  finding scored below `TRIVIAL_OBJECTION_CEILING`, else `weakened`.

Guarded on `findings` being non-empty, which the existing upward branch already
requires. The two mechanical `UNRESOLVED` assignments in `core/loop.py:423` (no
findings) and `core/loop.py:456` (reconciliation exception) never reach the gate, so
they are unaffected and stay unresolved.

*Downstream.* `missing_input` is a better `next_validation` than anything the
consequence call currently invents, so `build_consequences` uses it verbatim when
present.

### 3.2 Make `drop` reachable, with the salvage retained

**Files:** `core/reconcile.py`, `core/models.py`, `core/synthesis.py`

*Schema.* Add `salvage_scope: "parameter" | "redesign" | None` to `SteelManVerdict` and
to `Claim`. Definitions given to the judge in the prompt:

- `parameter` — the same decision with a different setting, threshold, scope or
  budget. `a2-treasury-mmf`: hold a 0.5–1 month buffer instead of 3 months.
- `redesign` — the original decision is replaced by a different one. `b1-phi-google-drive`:
  "Google Workspace with a signed BAA" is not consumer Drive with a tweak.

*Ladder.* In `_fallback_decision_state`, a load-bearing `broken` claim resolves as:

| Salvage | Result |
| :--- | :--- |
| absent | `drop` (unchanged) |
| `redesign` | `drop` |
| `parameter` | `proceed_with_changes` |

Mixed load-bearing broken claims take the harsher outcome: any `redesign` or absent
salvage yields `drop`.

*Prompt.* Axiom 3 keeps mandating a salvage — Break to Rebuild is the product — but
stops implying the decision survives. A `drop` verdict renders the salvage underneath
it, so the case reads "do not do this as written; here is what to do instead." The
existing immutable-law exception that leaves salvage fields null is retained.

*Presentation.* `drop` already has a `FALLBACK_HEADLINES` entry and the consequence
rendering already surfaces `salvaged_claim` and `tradeoff_acknowledged`, so nothing new
is needed in the API or frontend. Verified against `core/synthesis.py:47-60`.

Expected: `b1`, `b2`, `e3` land `drop`; `a2`, `a3` stay `proceed_with_changes`.

### 3.3 Severity-weight the `unresolved` branch of the ladder

**File:** `core/synthesis.py`

Replace `any(unresolved)` → `hold` with a proportion test over load-bearing claims:

- `hold` when unresolved load-bearing claims are a majority of the load-bearing set,
  or when no load-bearing claim survived. Band C keeps landing `hold`, which is
  correct — those cases have nothing to proceed on.
- A minority of unresolved claims alongside at least one survived load-bearing claim
  falls through to the existing weakened test, so the floor is `proceed_with_changes`
  or `proceed`. The `missing_input` from §3.1 becomes a `next_action`.

*Clamp.* `clamp_decision_state` allows two rungs of upward movement when the derived
floor was set by `unresolved` alone, and stays at one rung when a `broken` load-bearing
claim set it. This asymmetry is the guard against Band B overshoot and must not be
loosened. The function therefore needs to know which branch produced the floor;
`_fallback_decision_state` returns the state plus that reason, and the existing
single-return signature is kept as a thin wrapper so the current call sites and tests
in `tests/core/test_synthesis.py` keep working.

### 3.4 Devil's Advocate: conditional frame plus a mechanical cap

**Files:** `core/evaluators/devils_advocate.py`, `core/evaluators/_reasoning.py`

*Prompt.* Temporal Inversion becomes conditional. Instead of "you evaluate from a fixed
future state in which the proposal has completely and definitively failed," it reads as
a hypothetical: if this failed 12 months out, what unstated premise caused it — and if
the premise holds under that test, report that and score in the 0.0–0.1 band. This
removes the contradiction between the frame and the ABSTAIN protocol rather than
stacking another instruction on top of it. Stakeholder Incentive Mapping and the strict
role exclusions are unchanged; they are working.

*Cap.* In `run_reasoning_evaluator`, a finding with no evidence and no `contradiction`
is capped at 0.35 — the top of the `minor` band in `OBJECTION_SCALE`. An evaluator that
cannot name what is wrong has not raised a substantive objection, whatever float it
returned. `_reasoning.py` serves only Devil's Advocate and Overthinker, so Researcher,
Builder and Operator are untouched.

The cap is the guarantee. DA has been prompted into the zero band once already, in
Round 2, and did not go.

### 3.5 Route unknown failure modes to the Researcher

**File:** `core/evaluators/__init__.py`

`_FALLBACK = run_devils_advocate` becomes `run_researcher`. Confirmed safe: every
return path in `run_researcher` produces a `Finding`, and the zero-evidence paths
(`researcher.py:411`, `researcher.py:450`, `researcher.py:492`) set `confidence=0.0`
with `result="Abstain: No external empirical evidence found"`. An unrecognised
`failure_mode` therefore degrades to an abstention with a search attempt rather than to
the harshest evidence-free objection in the panel.

The module docstring explaining why DA was the fallback is updated to match.

---

## 4. Data flow and persistence

Two new fields travel the same route the salvage fields already travel:

```
reconcile()  →  apply_steelman_gate()  →  core/loop.py:_reconcile_single
                                       →  core/retest.py:132
                                       →  Claim.missing_input / Claim.salvage_scope
                                       →  store  →  API  →  frontend
```

Both `core/loop.py:441-445` and `core/retest.py:132-136` copy gated verdict fields onto
the claim and both need the two new assignments. The `verdict_ready` event payload in
`core/loop.py:470` gains both fields. `retest.py:62-67` clears `salvaged_claim` when
re-testing a salvaged claim and must clear `salvage_scope` alongside it, or a re-tested
claim carries a stale scope into the ladder.

Persistence is a pydantic model dump, so optional fields flow without a migration.
To be verified during implementation: if `store.py` writes an explicit column list
rather than a dump, a migration file is generated and left unapplied per project rules.

---

## 5. Testing

Existing homes, no new test directories:

| File | Cases |
| :--- | :--- |
| `tests/core/test_synthesis.py` | `unresolved` minority → not `hold`, mirroring `a1`; Band C majority-unresolved → still `hold`, mirroring `c1`/`c3`; `parameter` salvage → `proceed_with_changes`, mirroring `a2`; `redesign` salvage → `drop`, mirroring `b1`; mixed salvage scopes take the harsher outcome |
| `tests/core/test_synthesis.py` | `clamp_decision_state` two rungs from an `unresolved` floor, one rung from a `broken` floor, never downward |
| `tests/core/test_steelman.py` | `missing_input` required for `unresolved` and nulled for every other status; `salvage_scope` nulled on `survived`/`unresolved` |
| `tests/core/test_calibration_fixes.py` | gate re-grades `unresolved` with no `missing_input`; a sourced contradiction sends it to `weakened`, a trivial panel to `survived`; no-findings and evaluator-error unresolved are left alone |
| `tests/evaluators/test_devils_advocate.py` | evidence-free finding with no contradiction capped at 0.35; a finding with a contradiction is not capped |
| `tests/evaluators/test_dispatch.py` | unknown `failure_mode` routes to Researcher |

`pytest` must pass before the change is complete. The 15-case live corpus is run by the
user, not by the agent — Round 3 numbers come from that run.

---

## 6. Risks

**Band B overshoot is the one that matters.** §3.1 and §3.3 both push cases toward
`proceed`; §3.2 pushes toward `drop`. Opening both ends at once is the point — a 2.5
mean needs decisive calls in both directions — but a Band B case reaching `proceed`
would be a worse regression than the harshness bias it replaced. The guard is the
one-rung clamp on a `broken`-derived floor (§3.3). If Round 3 shows any Band B
`proceed`, that clamp is the first thing to tighten, before anything else is touched.

**`drop` over-firing.** If Steel Man labels most salvages `redesign`, `drop` swings from
0/15 back toward Round 1's 7/15. The Round 3 report should record the
`parameter`/`redesign` split per case so the definitions can be sharpened against real
output rather than guessed at again.

**The DA cap is blunt.** Capping at 0.35 on a missing `contradiction` field means a
genuinely severe objection that forgot to populate the field gets demoted. Accepted:
the field is required by the schema, and an objection that cannot name what is wrong is
not one the judge should weight heavily.

**Measurement confound.** Five changes ship together, so a Round 3 regression will not
attribute cleanly to one of them. Accepted deliberately — they interact, and shipping
them separately would need five corpus runs.

---

## 7. Success criteria for Round 3

- Mean distinguishability ≥ 2.5, driven by cases scoring 3 rather than by more
  citations on cases scoring 2.
- At least one Band A case reaches `proceed`.
- At least one Band B case reaches `drop`, with its salvage still rendered.
- Band C keeps a high `unresolved` share and stays on `hold`; Band A and Band B
  `unresolved` shares both fall.
- Devil's Advocate records at least one finding below 0.10.
- No Band B case reaches `proceed`.
