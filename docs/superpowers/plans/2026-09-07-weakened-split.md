# Plan — Split `weakened` into `qualified` and `contested`

**Date:** 2026-09-07
**Owner:** Dev A
**Scope:** backend `core/` + frontend claim/verdict surfaces + corpus round 3 spec
**Non-goals:** no change to the `unresolved` path, no new LLM calls, no prompt rewrite,
no corpus run (user runs it).

---

## 0. Why, and what the data actually says

The complaint is that `weakened` is a bucket wide enough to be meaningless: it covers
"true, but only inside a boundary the panel named" and "a source was found pointing the
other way" with one word, one colour and one confidence band (0.40-0.60). A user reading
it learns nothing about what to do next, which is the one thing section 10 of the
direction doc says the product exists to deliver.

Correction on the premise, since it changes what to measure in round 3: as of the
Round 2 report (`docs/calibration/02-round2-report.md`), `weakened` is **21.1%** of
claims, down from 40.7%. The pile-up moved to `unresolved` (40.4%). So this split is not
a fix for an attractor that still exists at the claim level — it is a legibility fix, and
it is worth doing anyway because `weakened` plus `proceed_with_changes` (53.3% of cases)
is still the most common thing a user sees, and the least informative.

**The `unresolved` pile-up is out of scope here and stays an open item.** It is the
bigger calibration problem; splitting `weakened` does not touch it.

## 1. The design decision

**Keep `ClaimStatus` at four members. Add a derived discriminator on `weakened` only.**

Rejected: adding two new members to `ClaimStatus`. `models.py` is marked FROZEN, and
three modules index dicts by status (`_IMPACT_BY_STATUS`, `_RECOMMENDED_CHANGE_BY_STATUS`,
`_STATUS_SEVERITY`) — a new member is a `KeyError` in each, plus a break in every
serialized corpus artefact and both calibration reports. The four-state contract in
sections 5/7 of the direction doc also survives untouched this way, so nothing in the
pitch has to be re-argued.

Rejected: asking Steel Man to emit the sub-kind. It is another schema field on the one
prompt the whole ladder rests on, days before the hackathon. Every signal needed is
already computed locally.

**Chosen:** `Claim.weakened_kind`, derived programmatically from findings the panel
already produced, null for every status except `weakened`.

### The two kinds

| Kind | Means | What the user does |
|---|---|---|
| `qualified` | The claim holds, but only inside a boundary the panel named. Ordinary friction, no source pushing the other way. | Adopt it with the constraint attached. |
| `contested` | Something the panel can cite pushes against the claim, or the only fix is a different decision. | Resolve it before committing. |

### Classification rule (deterministic, in `reconcile.py`)

`contested` if **any** of:

1. `has_sourced_contradiction(findings)` — a finding carries both evidence and a contradiction;
2. `salvage_scope == "redesign"` — the only salvage replaces the decision;
3. `max_objection >= CONTESTED_OBJECTION_FLOOR` (0.4, the `substantive` line in `OBJECTION_SCALE`).

Otherwise `qualified`.

0.4 is deliberately the same threshold `_blocking_weakened` already uses, so the decision
ladder's permissiveness does not move as a side effect of a labelling change. The one
intentional delta: a `weakened` carrying a sourced contradiction or a `redesign` salvage
but scoring under 0.4 is now `contested` and now blocks `proceed`. That is the correct
direction — a cited contradiction is exactly the thing that should block — and it is a
narrow edge, but it must be called out in the round 3 report rather than discovered.

---

## Task 1 — Backend: the field and the classifier

**`backend/core/models.py`**

- Add `class WeakenedKind(str, Enum): QUALIFIED = "qualified"; CONTESTED = "contested"`.
- Add to `Claim`: `weakened_kind: WeakenedKind | None = None`, with the comment that it is
  set only when `status is WEAKENED` and is derived, not generated.
- No other model changes. `CaseVerdict.weakened` stays the superset list — the UI reads the
  kind off the claim, so the SSE/API shape gains one optional field and breaks nothing.

**`backend/core/reconcile.py`**

- Add `CONTESTED_OBJECTION_FLOOR = 0.4` beside `TRIVIAL_OBJECTION_CEILING`, with a docstring
  noting it is the same line `_blocking_weakened` uses and that they must stay equal.
- Add `classify_weakened(findings: list[Finding], salvage_scope: str | None) -> WeakenedKind`
  implementing the three-clause rule above. Pure, no I/O, no provider.
- Do **not** call it from `apply_steelman_gate` — that returns a `SteelManVerdict`, and the
  kind belongs on the `Claim`. Call site is Task 2.

**Tests (`backend/tests/core/test_reconcile.py`, new cases):**

- sourced contradiction plus objection 0.1 gives `contested`
- `salvage_scope="redesign"` plus objection 0.1 gives `contested`
- objection exactly 0.4 gives `contested` (boundary)
- objection 0.39, no contradiction, `parameter` salvage gives `qualified`
- empty findings gives `qualified` (nothing was raised)

## Task 2 — Backend: assignment and confidence bands

**`backend/core/loop.py`**

- In `_reconcile_single`, after `apply_steelman_gate` sets the final status: when the gated
  status is `WEAKENED`, set
  `clm.weakened_kind = classify_weakened(claim_findings, verdict.salvage_scope)`;
  otherwise leave it `None`. Both branches that currently assign `clm.status` need this
  (lines ~451 and ~458).
- `calculate_claim_confidence` takes a third parameter
  `weakened_kind: WeakenedKind | None = None` and splits the old 0.40-0.60 band:
  - `qualified`: 0.60-0.75, scaled down by objection strength
  - `contested`: 0.35-0.55, scaled down by objection strength
  - `weakened` with no kind (defensive): keep today's 0.40-0.60

  Ordering stays monotone: survived (0.90-0.98) > qualified > contested > broken (0.05-0.15).
  `unresolved` stays a flat 0.50 and now overlaps `contested` numerically — intended, it is
  an orthogonal state; say so in the docstring so nobody "fixes" it.
- Update the three call sites to pass the kind.

**Tests (`backend/tests/core/test_loop.py`, extend the existing confidence tests):**

- band bounds for both kinds
- monotonicity across all labels
- legacy two-argument call still returns the old band

## Task 3 — Backend: consequence and ladder read the kind

**`backend/core/synthesis.py`**

- `build_consequences`: replace the flat `_IMPACT_BY_STATUS[WEAKENED] = "medium"` and
  `_RECOMMENDED_CHANGE_BY_STATUS[WEAKENED]` lookups with a branch on `claim.weakened_kind`:
  - `qualified`: impact `low`, change `"Keep it, bounded: {statement}"`
  - `contested`: impact `medium`, change `"Resolve before committing: {statement}"`
  - `None`: today's strings unchanged.

  Keep the salvage branch ahead of both, as it is now.
- `_blocking_weakened(case, claim)` becomes
  `claim.weakened_kind is not WeakenedKind.QUALIFIED` (no findings still returns `True`).
  The 0.4 max-objection scan moves into `classify_weakened` and must not be duplicated
  here — one threshold, one place.
- `_STATUS_SEVERITY` picks the deciding factor. Add a secondary sort key so a `contested`
  claim outranks a `qualified` one at equal status; do not renumber the existing values,
  other code reads them.
- `CONSEQUENCE_SYSTEM_PROMPT` line 1 currently says `'medium' if weakened`. Change to
  `'low' if the claim holds within a named boundary, 'medium' if a source pushes against it`.
  This is the only prompt text touched in the whole change.

**Tests (`backend/tests/core/test_synthesis.py`):**

- qualified-only load-bearing weakened claims give `_derive_decision_state` = `proceed`
  (the path that makes `proceed` reachable at all — 0/15 in both corpus rounds)
- one contested load-bearing claim gives `proceed_with_changes`
- consequence impact and recommended_change per kind
- deciding factor prefers contested over qualified

## Task 4 — Frontend: two labels, two colours

**`frontend/src/types/crossfire.ts`**

- `export type WeakenedKind = "qualified" | "contested";`
- `weakened_kind?: WeakenedKind | null;` on the claim type (line ~29) and on the verdict
  payload's claim shape (line ~243).

**`frontend/src/lib/formatters.ts`**

- `getVerdictConfig(status, weakenedKind?)` — optional second argument, so every existing
  caller compiles unchanged. On `weakened`:
  - `qualified`: label `"Holds, with limits"`, amber token set (today's weakened colours)
  - `contested`: label `"Challenged"`, orange token set
  - unset: today's `"Weakened"` amber, kept as the floor.
- Colours come from the badge palette; add one `contested` variant in `badge.tsx` rather
  than inlining classes at any call site.

**`frontend/src/components/ui/badge.tsx`** — add the `contested` variant beside `weakened`.

**`frontend/src/components/features/ClaimCard.tsx`** — `getStatusBadge` and
`FINDING_HEADLINES` both branch on the kind:

- qualified: `"Held up, within limits"`, icon `warning`, `text-tertiary`
- contested: `"Challenged by a source"`, icon `error`, muted `text-error`

Keep the existing `weakened` entries as the fallback when the field is absent.

**Also read the kind, same fallback pattern:** `VerdictBlock.tsx`, `EvidenceDrawer.tsx`,
`HistoryModal.tsx`, `DashboardScreen.tsx`, `lib/exportMemo.ts` (the memo text names the
kind), `lib/faqData.ts` (the FAQ explains the states — it now explains the split),
`lib/mockPreviewData.ts` and `lib/presets.ts` (fixtures gain one of each kind so the
preview shows both).

**Tests:** extend `ClaimCard.test.tsx`, `VerdictBlock.test.tsx`, `formatters.test.ts`,
`telemetryAndHistory.test.tsx`, `cubicleSimulation.test.tsx` — one case per kind plus one
with the field absent (an old payload still renders). Per `CLAUDE.md` and
`frontend/TESTING.md`, `npm run test:all` must pass before this is done.

## Task 5 — Corpus round 3 (spec only, not run)

- `backend/scripts/run_corpus.py`: `extract_summary` adds
  `"weakened_kind": c.get("weakened_kind")` to each claim dict. One line. Nothing else in
  the runner changes.
- `docs/calibration/00-corpus-spec.md`: add a Round 3 section stating
  - **the same 15 cases, 5 bands of 3 — no cases added, none reworded**;
  - Table 1 gains a `weakened` breakdown column (`qualified` / `contested`) rather than a
    new status column, so the Round 1 and Round 2 rows stay directly comparable;
  - two things to check: (a) does Band A now reach `proceed` at all, given qualified-only
    claims stop blocking it, and (b) does any Band B or D case reach `proceed` — that is
    the overshoot regression and is a fail;
  - the narrow deliberate delta from section 1 (a sub-0.4 sourced contradiction now blocks)
    is listed as expected, not as a finding.
- No `02-round2-report.md` edits. No run. The user runs the corpus.

---

## Sequence

Task 1, then 2, then 3 (backend, each with its tests green before the next), then Task 4
(frontend), then Task 5 (one runner line plus spec text). Task 5 can land any time after
Task 1.

## Risk

The only behavioural risk is Task 3 making `proceed` reachable. That is the intended
outcome, and a Band B or D case reaching `proceed` in round 3 is the tripwire that says it
went too far. Everything else is labelling over signals the system already computed.
