# Crossfire Output Quality — Design

**Date:** 2026-09-08
**Status:** Approved for planning
**Owner:** Dev A

---

## 1. Why

Crossfire's memo was run head-to-head against a deep-research answer on the same
prompt (an IRCTC Tatkal booking bot). Crossfire lost. The critique was specific
and reproducible, and every point maps to a stage in our pipeline:

| Observed failure | Stage | Root cause |
|---|---|---|
| `news.csraid.com` cited as a news outlet; domain is not one | `evidence/search.py:126` `classify_source` | Source class derived from URL shape alone. No outlet-existence check, no snippet-on-page verification. The underlying statistic was true; the citation was fabricated. |
| "Akamai edge bot protection" asserted by name, unsourced | evaluators | Named specifics live in `Finding.reasoning` / `Finding.contradiction` as free model prose with no binding to evidence. |
| "Violates Section 143 of the Railways Act" — statute is about touts reselling, not personal-use automation | evaluators + `core/reconcile.py` | Objections are never themselves verified. The evidence gate audits user claims, not panel assertions. |
| Claim 2 carried two counter-evidence bullets and zero sources | `core/loop.py` `run_evaluators` | Nothing requires evidence-backing before a claim is downgraded. |
| "Holiday quotas" never unpacked into Tatkal / 10:00 AC / 11:00 non-AC | `core/loop.py` `extract_claims` | Domain jargon imported as an opaque token. Searches were phrased in the user's words, so they reached generic press instead of the IRCTC T&C PDF. |
| Idea killed wholesale; a survivable mechanism existed inside it | `extract_claims`, `rank_load_bearing` | Three flat claims. The idea was three separable mechanisms of which one survives. |
| Same objection recycled across all three claims | `core/reconcile.py` | No cross-claim deduplication. |
| "Strategic Importance" read identically for every claim | `frontend/src/lib/exportMemo.ts:132-137` | Hardcoded boilerplate string keyed only on `load_bearing`. |
| "What to change" was a bullet, not a design | `core/synthesis.py` + `exportMemo.ts` | `salvaged_claim` is one line per claim, generic and repeated. No case-level buildable artifact. |
| Verdict "drop completely" with 2 of 3 claims only WEAKENED | `core/reconcile.py` | No reachable PIVOT path; nothing names the surviving core. |

Two of these are trust-killers. A fabricated citation voids the credibility of
the entire memo no matter how sound the rest is. The remainder are quality gaps
that cost the comparison on usefulness.

The evidence gate at `core/reconcile.py:292` already exists and already blocks
`broken` without evidence. It failed here because it checks that an
`EvidenceItem` **exists**, not that it is **real**. `news.csraid.com` arrived as
a well-formed object with a URL and a snippet, so it passed.

## 2. Goals

1. No specific — vendor, statute, product, number — appears in a memo unless it
   is traceable to a verified source or explicitly marked unverified.
2. No source is presented as authoritative unless its page was fetched and the
   quoted snippet was found in it.
3. An idea composed of separable mechanisms is judged mechanism by mechanism, so
   a survivable core is not killed along with a fatal one.
4. Every memo ends with a buildable artifact: the salvaged version specified
   concretely enough to start, plus its cheapest validation experiment.
5. The memo reads as one argument, not N repetitions of a template.

## 3. Non-goals

- Changing providers, routing, or the agent panel composition.
- Adding new evaluator personas.
- Reworking ingestion, auth, or the live-run SSE contract.
- Introducing a new visual language on the frontend. Section 9 constrains this.

## 4. Budget constraint

**Ceiling: ~1.5x current LLM calls.** Every feature below is one of:

- **Code / HTTP only** — zero LLM calls (F1, F5, F6, and the frontend work)
- **Prompt extension on a call that already runs** — zero new calls, more tokens
  (F2, F3, F4, F7)

Net new LLM calls: approximately zero. Token count rises an estimated 1.2-1.3x
from longer prompts and richer structured output. Wall-clock rises from parallel
page fetches in F1. This lands inside the ceiling with room to spare.

---

## 5. Trust arm

### F1 — Citation integrity gate

**Where:** `backend/evidence/` (new `verify.py`), called from the search/curate
path in `core/loop.py` before evidence reaches evaluators.
**Cost:** 0 LLM calls. N parallel HTTP fetches.

`evidence/fetch.py` already provides `fetch_page(url, timeout=5.0)` with SSRF
guards, SERP rejection, and a hard timeout returning `""` rather than raising.
Reuse it; do not write a second fetcher.

For each `EvidenceItem`, fetch the page and test whether the curated snippet
actually appears in the page text under normalization (case-fold, collapse
whitespace, strip punctuation), using a token-set overlap ratio rather than a
substring test — curation rewrites sentences, so exact matching would reject
honest snippets.

New fields on `EvidenceItem`:

```
verified: bool = False
verification: str = "unchecked"   # snippet_matched | snippet_absent
                                  # | unreachable | unchecked
```

**The distinction that matters:** `unreachable` is not `fabricated`. IRCTC's own
PDFs, paywalled outlets, and bot-walled sites will fail to fetch, and treating
those as fabrication would discard our best primary sources. Therefore:

- `snippet_matched` — full standing. Can satisfy the `broken` gate, can be a
  `deciding_factor`.
- `unreachable` — usable as supporting context. Cannot satisfy the `broken`
  gate, cannot be a `deciding_factor`. Rendered with its status visible.
- `snippet_absent` — hard fail. Stripped from evidence entirely and logged.
- `unchecked` — verification did not run (feature disabled, or budget guard
  tripped). Treated as `unreachable` for gating purposes.

**Domain plausibility**, same module: `classify_source` currently assigns
`press` on URL shape. A host that is a subdomain of a root domain about which we
have no independent signal must never be classed `press` — it falls to
`unranked`. Outlet identity is earned by the root domain, not inferred from the
string "news" appearing in a hostname. This is the specific rule that would have
caught `news.csraid.com`.

**Calibration:** the snippet-match threshold and the fetch timeout are config
values in `backend/config.py`, not constants in the verifier. Real pages differ
from ideal ones and this will need tuning against the corpus.

### F2 — Objection grounding

**Where:** evaluator prompts in `backend/core/evaluators/`, plus a post-check in
`core/reconcile.py`.
**Cost:** 0 new LLM calls. Prompt extension only.

The Akamai invention and the Section 143 overreach are one bug: the panel
produces authoritative-sounding specifics with nothing behind them, because
sounding rigorous is rewarded and being checkable is not.

Two layers, belt and braces, because the prompt layer alone will leak:

**Prompt layer.** Every evaluator prompt gains a rule: any named specific — a
vendor, a statute, a product, a named system, a quantity — must carry either a
reference to an attached evidence item or the literal marker `[unverified]`.
Reasoning without specifics is still permitted; that is what the non-researcher
personas are for.

**Code layer.** After findings return, scan `reasoning` and `contradiction` for
capitalized multi-word proper nouns, statute-shaped references (`Section \d+`,
`Article \d+`), and bare numerics with units or percentages. Any such token
absent from every attached evidence snippet is force-marked `[unverified]`, and
that finding is barred from becoming the `deciding_factor`.

The code layer is deliberately crude. It will produce some false positives on
ordinary capitalized prose. That is the correct trade: a specific wrongly marked
`[unverified]` costs a little confidence; a fabricated specific presented as
fact costs the whole memo.

### F5 — PIVOT verdict and surviving core

**Where:** `backend/core/reconcile.py`.
**Cost:** 0 LLM calls. Pure code.

`CaseVerdict.decision_state` already admits `proceed_with_changes`. It simply
was not reachable in practice — the run that produced "Drop automated ticketing
bot completely" had two of three claims merely WEAKENED, each with a salvage.

Hard rule, enforced in code rather than requested in a prompt:

- `drop` requires **every** load-bearing claim to be `broken`.
- Any load-bearing claim that is `weakened` **and** carries a `salvaged_claim`
  forces `proceed_with_changes`.

New field:

```
CaseVerdict.surviving_core: str = ""
```

One sentence naming the part of the idea that lives. On a `drop` this is
legitimately empty. On anything else it must be populated, and the memo leads
with it.

---

## 6. Constructive arm

### F3 — Term resolution

**Where:** `extract_claims` in `backend/core/loop.py`, feeding `build_query` in
`backend/evidence/search.py`.
**Cost:** 0 new LLM calls. Extraction prompt extension, larger structured output.

Extraction gains a second output: the domain terms in the input, each resolved
to what it concretely denotes and to a phrasing suited for search.

```
class ResolvedTerm(BaseModel):
    term: str          # as the user wrote it, e.g. "holiday quotas"
    resolved: str      # what it concretely means, e.g. "Tatkal quota;
                       # opens 10:00 IST AC, 11:00 IST non-AC, T-1 day"
    search_phrasing: str
```

Added to `Claim` as `terms: list[ResolvedTerm] = []`.

`build_query` prefers `search_phrasing` over raw claim text when a term matches.
This is what puts the IRCTC Terms and Conditions PDF in reach instead of general
bot-panic coverage — the exact ground the competing answer stood on and we never
touched.

When the model cannot resolve a term confidently it emits nothing for it. An
unresolved term is fine; a wrongly resolved one poisons the search.

### F4 — Mechanism decomposition

**Where:** `extract_claims` in `backend/core/loop.py`.
**Cost:** 0 new LLM calls. Extraction prompt extension.

The structural cause of the wholesale kill. The proposal was one sentence
containing several independently-testable mechanisms:

1. Fire at the exact second the quota opens (survivable)
2. Solve the CAPTCHA automatically (fatal)
3. Guarantee a confirmed ticket (fatal, and independently so)

Extraction produced three flat assertions instead and the verdict collapsed all
of them together. Extraction gains a rule: a claim bundling mechanisms that
could fail independently must be split, one claim per mechanism.

```
Claim.mechanism_of: str | None = None   # parent idea label shared by siblings
```

This lets the memo say "mechanism A survives, B and C die" — which is the
finding — rather than "drop", which is not.

### F6 — Cross-claim deduplication

**Where:** `backend/core/reconcile.py`.
**Cost:** 0 LLM calls. Pure code.

`rank_findings` already orders findings. Add near-duplicate suppression across
claims by normalized token overlap: keep the strongest instance, and have the
others reference it rather than restate it. Cheap, and it removes the single
most visible symptom of padding.

### F7 — The version I'd build

**Where:** `backend/core/synthesis.py`, extending a call that already runs.
**Cost:** 0 new LLM calls. Prompt extension, larger structured output.

Replace the per-claim one-line `salvaged_claim` in the memo's closing position
with one case-level artifact:

```
class BuildSpec(BaseModel):
    what_it_does: str        # the salvaged product, concretely
    what_it_omits: str       # the removed mechanism, named, and why
    demo_path: str           # how to show it working without the fatal part
    cheapest_experiment: str # the smallest real test that would settle it
```

Added as `CaseVerdict.build_spec: BuildSpec | None = None`.

**Constrained input, not free invention.** The spec is constructed from the
surviving mechanisms identified in F4 and the isolated fatal flaws from the
Steel Man pass. The prompt receives those as its material and is told to
assemble, not to imagine. An unconstrained "what would you build" prompt is
exactly how we get another Akamai.

This is the largest single value gap in the comparison. The competing answer
handed over something buildable; we handed over a bullet.

---

## 7. Data model changes

`backend/core/models.py` carries a FROZEN banner referencing a Dev B/C sync
requirement. Every change below is **additive with a default**, so existing
consumers deserialize unchanged and no migration is required. The freeze note
should still be honored procedurally — flag the change rather than assume the
banner is stale.

| Model | Field | Type | Default |
|---|---|---|---|
| `EvidenceItem` | `verified` | `bool` | `False` |
| `EvidenceItem` | `verification` | `str` | `"unchecked"` |
| `Claim` | `terms` | `list[ResolvedTerm]` | `[]` |
| `Claim` | `mechanism_of` | `str \| None` | `None` |
| `CaseVerdict` | `surviving_core` | `str` | `""` |
| `CaseVerdict` | `build_spec` | `BuildSpec \| None` | `None` |

New models: `ResolvedTerm`, `BuildSpec`.

No database migration. `backend/crossfire.db` stores cases as serialized JSON via
`store.py`; additive optional fields load cleanly against old rows.

`frontend/src/types/crossfire.ts` mirrors these as optional fields.

---

## 8. Memo restructure

The current memo is header, executive summary, scoreboard, then N near-identical
claim blocks. The repetition is structural: the template emits the same eight
labeled subsections per claim whether or not each has anything to say.

New section order:

1. **Verdict** — decision state, headline, and `surviving_core` in the lead
2. **What the idea actually is** — mechanisms from F4, terms from F3
3. **What survives, what dies** — one deduped table across all claims
4. **The load-bearing kills** — only verdict-moving claims, at full depth, every
   specific either sourced or visibly marked `[unverified]`
5. **The version I'd build** — `build_spec`
6. **Cheapest next experiment**
7. **Sources** — each tagged verified / unreachable

Claims that did not move the verdict collapse into the section 3 table instead of
each getting a full block. That is where the padding went.

**Boilerplate removal:** `exportMemo.ts:132-137` emits one of two fixed
"Strategic Importance" strings based on `load_bearing`. Replace with
`claim.load_bearing_reason`, which already exists on the model and is already
generated per claim. Omit the subsection when it is empty rather than
substituting filler.

---

## 9. Frontend presentation constraints

The restructure changes **which blocks appear and in what order**. It does not
introduce new visual vocabulary. Specifically preserved:

- The memo meta header — `# EXECUTIVE DECISION MEMO`, Date, Subject, Context
- `##` numbered top-level sections separated by `---` rules
- `>` blockquotes for the verdict and for callout content
- `###` subsections with bold inline labels
- Claim-anchor suffixes in the established `_(claim 1, 3)_` form
- Bullet lists for the scoreboard
- The generated-by footer line
- Existing `components/ui/` primitives and `globals.css` tokens throughout. No
  new hex values, no new spacing values, no one-off components.

Screen-side, `VerdictBlock.tsx` gains `surviving_core` and the `build_spec`
block; `ClaimCard.tsx` gains mechanism grouping and the verification badge on
evidence. Both use existing `badge.tsx` and `card.tsx` primitives with existing
token classes.

The intent of the restructure is legibility — spacing, grouping, and removing
repetition — not a redesign.

---

## 10. Testing

Backend, per `backend/pytest.ini` conventions in `backend/tests/`:

- `tests/evidence/test_verify.py` — snippet matched, snippet absent, unreachable,
  fetch timeout, threshold boundary, and the `news.csraid.com` subdomain case
  specifically as a regression test
- `tests/core/test_reconcile.py` — extend for: `drop` blocked when any
  load-bearing claim is merely weakened; `surviving_core` populated on
  `proceed_with_changes`; unverified specifics barred from `deciding_factor`;
  cross-claim dedupe
- `tests/core/test_loop.py` — extend for term resolution and mechanism splitting
- `tests/core/test_synthesis.py` — `build_spec` assembly from constrained input

Frontend, per `frontend/TESTING.md` — mandatory, same pass, no deferral:

- `src/tests/exportMemo.test.ts` — extend for new section order, boilerplate
  removal, verification tags, `build_spec` rendering, and collapse of
  non-verdict-moving claims
- `src/tests/VerdictBlock.test.tsx` — `surviving_core` and `build_spec`
- `src/tests/ClaimCard.test.tsx` — mechanism grouping, evidence verification
  badges
- `npm run test:all` must pass with zero failures before the change is done

---

## 11. Risks

**Fetch failures on the best sources.** Primary documents are exactly the ones
most likely to be PDFs or bot-walled. Mitigated by the three-way
verified/unreachable/absent distinction in F1 — but if `unreachable` turns out to
dominate in practice, the gate is doing little and the thresholds need revisiting
against the corpus.

**F2 false positives.** The proper-noun scan will mark some legitimate prose
`[unverified]`. Accepted deliberately; the asymmetry favors over-marking.

**Latency.** N parallel fetches at up to 5s each, on top of an already
rate-limited pipeline. Fetches must be bounded and concurrent, never serial.

**Extraction prompt load.** F3 and F4 both extend the same call. If output quality
degrades from asking one call to do too much, F3 splits out first — it is the more
separable of the two.

**Corpus regression.** Calibration numbers live with the user, who runs the
corpus. Threshold tuning in F1 needs a corpus run to settle and should not be
guessed at in isolation.
