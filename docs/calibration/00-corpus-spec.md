# Crossfire Calibration Corpus — Run Spec

**Audience:** the agent running the corpus. Follow this literally. Do not
improvise cases, do not reword propositions, do not skip the vanilla-Gemini
control run.

**Purpose:** produce the evidence needed to fix three suspected defects that
were identified by code inspection but have never been measured:

1. **Harshness bias.** Devil's Advocate and Builder confidence rubrics have no
   band meaning "no problem found" — the floor is `0.1-0.3: minor friction`.
   Every claim therefore receives four nonzero objections regardless of
   quality. Suspected effect: sound claims cannot reach `survived`.
2. **The `weakened` attractor.** `apply_evidence_gate` blocks `broken` unless a
   finding carries evidence *and* a contradiction; Receipts caps confidence at
   `<=0.35` when it finds nothing. Suspected effect: nearly everything funnels
   into `weakened`, and therefore nearly every case lands on
   `proceed_with_changes`.
3. **Scale collision on `Finding.confidence`.** One float carries four
   incompatible meanings (attack severity for DA/Builder, evidence quality for
   Receipts, a bare `0.7` default for Operator), and `rank_findings` sorts on
   it. Suspected effect: the finding presented as decisive is often not the one
   that decided anything.

The corpus is designed so that each band **would produce a different
distribution if the system were correctly calibrated**. If all five bands
produce the same status mix, the defects are confirmed.

---

## 1. How to run

### 1.1 Preconditions

- `backend/.env` has a working `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`
  (Gemini via the OpenAI-compatible proxy — start it with `run_gemini_proxy.ps1`).
- `SERPAPI_API_KEY` set. If absent, search falls back to DuckDuckGo via
  Scrapling; **record which one was live**, because Receipts' evidence supply is
  the single biggest confound in this whole experiment.
- `DEMO_MODE=false`. A demo-mode run measures fixtures and is worthless here.

### 1.2 Command, per case

```
cd backend
python scripts/run_idea_test.py "<raw_input verbatim>" ../docs/calibration/runs/<case_id>.json
```

The second argument writes the full hydrated `Case` JSON. Everything in the
report must be derived from those JSON files, not from the console prose.

Run cases **sequentially**, not in parallel. Each case is roughly 20 concurrent
LLM calls internally; stacking cases on top of that will trip
`evaluator_timeout_seconds` and you will be measuring timeouts instead of
calibration.

If a case errors (`status: "error"`), retry it **once**. If it fails twice,
record it as failed with the error text and move on — do not substitute a
different proposition.

### 1.3 The control run (do not skip)

For every one of the 15 cases, also ask **plain Gemini** — same model as
`LLM_MODEL`, one turn, no Crossfire — this exact prompt:

```
I'm considering this decision. Give me your honest assessment.

<raw_input verbatim>
```

Save the reply to `../docs/calibration/runs/<case_id>.control.md`.

This control is the whole point of the exercise. The product thesis is that
Crossfire is distinguishable from asking a frontier model directly. If the
Crossfire memo and the vanilla Gemini answer say the same things in a different
layout, that thesis is false and no amount of confidence-rubric tuning fixes
it. Section 4.4 defines how to score the difference.

---

## 2. The corpus

15 cases in 5 bands of 3. Band membership is the hypothesis; the per-case
"expected shape" is what a correctly calibrated system does, **not** an
assertion that the system is wrong if it disagrees. Where the system disagrees
with the expected shape, the report records the disagreement and the reason the
system gave. Some disagreements will be the system being right.

---

### Band A — Should largely survive

These are sound, modest, reversible decisions with public precedent. A
correctly calibrated system reaches `proceed` or a light
`proceed_with_changes`. **If Band A produces the same status mix as Band B, the
harshness bias is confirmed.**

---

#### A1 — `a1-notion-migration`

**raw_input:**

> We're moving our 12-person engineering team's internal docs from Confluence to
> Notion over one weekend, keeping Confluence in read-only mode for six months as
> a fallback before we cancel the licence.

**Property under test:** a decision with an explicit rollback path should not be
penalised for the risk that rollback exists to cover.

**Expected shape:** most claims `survived`. `decision_state` = `proceed` or
`proceed_with_changes`. Any objection should be about migration fidelity
(nested page structure, permissions, macros) — not about "what if the migration
fails", which the fallback already answers.

**Failure signal:** Devil's Advocate raises the failure the fallback covers, and
Steel Man weakens the claim on it anyway. That is the harshness bias in its
purest form — the pre-mortem framing forces a 12-month-post-collapse narrative
even when the proposal names its own escape hatch.

---

#### A2 — `a2-treasury-mmf`

**raw_input:**

> I'm moving my savings out of a 0.5% APY checking account into a US Treasury
> money market fund yielding about 4.5%, keeping three months of expenses liquid
> in checking.

**Property under test:** Receipts against abundant, high-quality, primary-source
evidence. Treasury MMF yields are published and trivially verifiable.

**Expected shape:** `survived`, `decision_state` = `proceed`. Receipts should
return `source_class: primary` or `institutional` evidence with
`stance: supports`.

**Failure signal:** two distinct ones, record both.
(a) Receipts finds strong supporting evidence and returns a *high* confidence —
which `rank_findings` then sorts to the top of the pile as if it were the most
damaging finding. That is the scale collision, visible.
(b) The claim still lands `weakened` because DA and Builder each contributed a
`0.1-0.3` "minor friction" objection they had no way to decline to make.

---

#### A3 — `a3-soc2`

**raw_input:**

> Our SaaS will get SOC 2 Type II certified before we chase enterprise deals. We
> have budgeted nine months and about $45,000 including the auditor.

**Property under test:** whether the panel checks the *specific numbers* given
(9 months, $45k) against public benchmarks, or produces generic compliance
commentary.

**Expected shape:** `survived` or `weakened` on a **numeric** basis — e.g. the
observation window alone is typically 3-12 months and $45k is at the low end
once the readiness phase and the auditor are both counted. The reasoning must
name a number.

**Failure signal:** the memo discusses SOC 2 in the abstract without engaging
the two figures the user supplied. If Crossfire cannot beat vanilla Gemini on a
proposition containing two checkable numbers, it will not beat it anywhere.

---

### Band B — Should break on hard public evidence

Each of these violates a specific, published, citable rule. There is a real
source with a real number or statute. **This band exists to find out whether
`broken` is reachable at all.**

---

#### B1 — `b1-phi-google-drive`

**raw_input:**

> We'll cut our cloud bill by 90% by moving all patient records out of our
> hosted EHR and into a shared Google Drive folder that staff access by link.

**Property under test:** the `broken` path against a statutory wall (HIPAA
Security Rule, 45 CFR §164.312; link-sharing defeats access control and there
is no BAA on a personal Drive).

**Expected shape:** at least one `broken` claim, `decision_state` = `drop`.
Salvage fields must be `null` per the Steel Man immutable-law exception, or
carry a genuine compliant alternative (Google Workspace with a signed BAA and
per-user access) — **not** a hedge like "add a security review".

**Failure signal — the most important single measurement in this corpus:** the
claim lands `weakened` because `apply_evidence_gate` fired. If Receipts fails to
retrieve a citation for a statute this well documented, the gate downgrades a
statutory violation to "weakened", and the memo tells a healthcare operator to
proceed with changes. Record whether the downgrade note
(`"Downgraded from broken to weakened..."`) is present in `verdict_reasoning`.

---

#### B2 — `b2-14-hour-shifts`

**raw_input:**

> Our delivery drivers will run 14-hour continuous driving shifts so we can offer
> next-day delivery in every state in the lower 48.

**Property under test:** contradiction detection against a hard numeric federal
rule — FMCSA §395.3 caps property-carrying drivers at 11 hours driving after 10
consecutive hours off, inside a 14-hour on-duty window.

**Expected shape:** `broken`. The `contradiction` field on the Receipts finding
should contain the actual number (11 hours), and `evidence[].source_url` should
point at fmcsa.dot.gov or an equivalent primary source.

**Failure signal:** `contradiction` is prose without the number ("this may
violate hours-of-service regulations"). A vague contradiction is what a
summariser produces; the number is what makes Crossfire worth using. Compare
directly against the control run, which will almost certainly mention
hours-of-service in general terms.

---

#### B3 — `b3-prepayment-crypto`

**raw_input:**

> We'll fund year one by taking twelve months of customer prepayments up front
> and holding them in crypto, and we'll guarantee customers an 8% return on the
> balance if they leave the money with us.

**Property under test:** whether the panel identifies the *category* error (this
is an unregistered security and likely an unlicensed deposit-taking business),
rather than critiquing crypto volatility, which is the obvious surface read.

**Expected shape:** `broken`, `decision_state` = `drop`. The deciding reasoning
should name the securities/deposit issue, not the volatility.

**Failure signal:** the entire panel converges on "crypto is volatile". That is
four evaluators producing one thought, which is precisely the groupthink the
adversarial-isolation architecture claims to prevent. Record how many of the
four findings are semantically the same objection — this metric applies to every
case, see §4.2.

---

### Band C — Genuinely uncertain

No amount of public evidence settles these. They depend on private data or the
future. A correctly calibrated system says so and does not manufacture
confidence. **This band tests whether `unresolved` is used honestly or as a
dumping ground.**

---

#### C1 — `c1-japan-before-korea`

**raw_input:**

> We should launch our B2B analytics product in Japan before Korea, because
> Japanese mid-market firms will adopt AI tooling faster over the next 18 months.

**Property under test:** a forward-looking claim with real but non-decisive
evidence on both sides.

**Expected shape:** `unresolved` on the adoption-rate claim; `decision_state` =
`hold`. `next_actions` should propose something that would actually settle it
within weeks (e.g. 20 discovery calls split across both markets), not "conduct
market research".

**Failure signal:** `weakened` with a confident-sounding reason. `weakened`
means "damaged but standing"; using it for "we cannot tell" destroys the
distinction between the two states and is a direct cause of every verdict
reading the same.

---

#### C2 — `c2-usage-based-pricing`

**raw_input:**

> Switching our pricing from per-seat to usage-based will increase net revenue
> retention for our customer mix.

**Property under test:** whether the panel recognises that the answer lives in
data the user did not supply, and asks for it.

**Expected shape:** `unresolved`. The strongest possible output names the
specific missing input — the distribution of usage across the existing base —
and says which way the answer goes depending on it.

**Failure signal:** the memo lists generic pros and cons of usage-based pricing.
That is a blog post. The control run will produce exactly that; if Crossfire
matches it, score the case 0 on distinguishability (§4.4).

---

#### C3 — `c3-head-of-sales-timing`

**raw_input:**

> Hiring a Head of Sales now rather than in six months will shorten our
> enterprise sales cycle.

**Property under test:** a pure counterfactual. There is no fact that settles
it.

**Expected shape:** `unresolved`, `decision_state` = `hold`. Honest handling
looks like reframing to a decidable proxy question.

**Failure signal:** any `survived` or `broken` verdict. Both are epistemically
unavailable here, and either indicates the pipeline is producing a status
because it must produce one, not because the evidence supports it.

---

### Band D — Non-business domains

Every evaluator prompt says "never assume a domain" and "never substitute
business advice for the actual subject". This band tests whether that
instruction holds under pressure. **These cases are also where a wrong answer
does real-world harm, so the report treats domain leakage as a severity-1
finding.**

---

#### D1 — `d1-spinal-fusion`

**raw_input:**

> I've had lower back pain for four months. I'm going to skip physical therapy
> and book a spinal fusion consult now.

**Property under test:** medical-domain handling against established clinical
guidance (conservative management first for non-specific low back pain absent
red flags).

**Expected shape:** `weakened` or `broken` on the skip-PT claim, cited to
clinical guidance. Language must stay clinical.

**Failure signal:** Builder discusses "implementation friction", Operator
discusses "operational burden", or any finding uses business vocabulary. Quote
the exact sentence in the report. Also flag if the memo fails to note that
"four months of pain" is itself the load-bearing fact a clinician would need.

---

#### D2 — `d2-pro-se-custody`

**raw_input:**

> I'm going to represent myself at a contested child custody hearing to save the
> $12,000 in attorney fees.

**Property under test:** legal-domain handling, and whether the panel weighs an
asymmetric, irreversible downside against a quantified upside. The $12,000 is
certain; the cost of losing custody is not denominated in dollars.

**Expected shape:** the deciding reasoning engages the asymmetry directly.
Status is likely `weakened` with a real salvage (limited-scope representation /
unbundled legal services is the genuine minimal-viable fix here, and is a good
test of whether Break-to-Rebuild produces something specific).

**Failure signal:** the salvage is "consult an attorney", which restates the
thing the user is trying to avoid and is not a fix.

---

#### D3 — `d3-tenure-vs-startup`

**raw_input:**

> I should turn down a tenure-track offer at a state university to join a
> seed-stage startup as employee number four, taking 0.8% equity and a 30% pay
> cut.

**Property under test:** a personal decision where the correct answer depends on
the person's risk tolerance, which was not supplied. Tests whether the panel
distinguishes "unknowable by anyone" from "unknown to us but knowable from the
user".

**Expected shape:** `unresolved` on the overall call, with the 0.8% equity claim
itself testable — expected value of 0.8% at seed stage after dilution is
publicly modellable, and that arithmetic is the thing worth showing.

**Failure signal:** the memo does the risk-tolerance moralising instead of the
dilution arithmetic. The arithmetic is the differentiated output.

---

### Band E — Mixed verdicts and salvage quality

These decompose into claims that should land on *different* statuses within one
case. **This band tests verdict differentiation and Break-to-Rebuild output
quality.**

---

#### E1 — `e1-ai-support-team`

**raw_input:**

> We should replace our entire customer support team with an autonomous AI agent
> to reduce support department operating costs to zero.

**Property under test:** the existing `DEFAULT_PROPOSITION` in
`run_idea_test.py`, kept deliberately as the continuity baseline against every
previous manual run. Contains one claim that is straightforwardly false ("to
zero" — inference, tooling and escalation costs are never zero) and one that is
genuinely arguable (tier-1 deflection).

**Expected shape:** mixed statuses inside one case. `decision_state` =
`proceed_with_changes` with a **specific** salvage — deflect tier-1 volume with
a human escalation path and a named coverage target — plus a stated trade-off.

**Failure signal:** a uniform status across all claims, or a salvage reading
"implement AI support gradually with human oversight". Generic salvage text is
the single most visible symptom of the templated `build_consequences` path
leaking into the final memo.

---

#### E2 — `e2-pwa-instead-of-native`

**raw_input:**

> We'll ship our mobile app as a PWA instead of native to halve build time, and
> still list it on the iOS App Store.

**Property under test:** a proposition that is genuinely half-right. The build
time claim is defensible; the App Store listing claim runs into Apple's
guidelines on minimum functionality for web wrappers.

**Expected shape:** one `survived` claim and one `broken`/`weakened` claim in
the same case, cited to Apple's App Review Guidelines §4.2. This is the cleanest
available test of whether Steel Man adjudicates per claim or lets one status
bleed across the case.

**Failure signal:** both claims receive the same status. Also check whether the
`decision_state` reflects only the failed claim and discards the survived one —
the current `_fallback_decision_state` is a pure severity ladder, so a single
`broken` claim drives the whole case to `drop` regardless of what survived.

---

#### E3 — `e3-van-conversion`

**raw_input:**

> I'm buying a 2015 diesel van for $18,000, converting it to a camper for $8,000
> over three months of weekends, and living in it full-time in Denver to save
> $2,000 a month on rent.

**Property under test:** the widest claim spread in the corpus — mechanical
(2015 diesel emissions systems and their failure costs), financial (the $2,000
saving net of insurance, parking, storage, gym, laundry, higher fuel),
regulatory (Denver overnight-parking ordinances), and climate (Denver winter
without shore power). Four claims that should reach four different conclusions.

**Expected shape:** maximum status diversity. This is the case that most
directly answers "do all verdicts come out the same".

**Failure signal:** uniform statuses, or a memo that reasons about only one of
the four dimensions. Also record whether the load-bearing classifier picks the
right claim — the $2,000 net saving is the load-bearing one, because if the true
saving is $600 the entire decision changes.

---

## 3. What to capture, per case

From `<case_id>.json`:

| Field | Why |
|---|---|
| `claims[].status` | status distribution — the core measurement |
| `claims[].load_bearing` + `load_bearing_reason` | is the classifier picking the right claim |
| `claims[].fatal_flaw` / `salvaged_claim` / `tradeoff_acknowledged` | Break-to-Rebuild quality |
| `findings[].evaluator` + `confidence` | per-evaluator confidence histogram |
| `findings[].evidence[]` length, `source_class`, `stance` | Receipts evidence supply |
| `findings[].contradiction` | present? does it contain a number or citation? |
| `consequences[].verdict_reasoning` | does it contain the evidence-gate downgrade note |
| `consequences[].impact` / `recommended_change` | templated or genuinely synthesised |
| `case_verdict.decision_state` | verdict distribution |
| `case_verdict.summary` | length, and whether sentence 1 names a specific fact |
| `case_verdict.next_actions[]` | count, anchored claim ids, near-duplicates |
| wall-clock runtime | timeouts confound everything else |

Also record, once for the whole run: `LLM_MODEL`, whether SerpApi or DuckDuckGo
served search, `USE_LLM_CURATION`, and the date.

---

## 4. The report

Write to `docs/calibration/01-baseline-report.md`. Detailed — this report is
the sole input to the fixes, so an ambiguous report costs a whole extra run
cycle. Every claim in it cites a case id and a field. No summarising away the
raw numbers; include them.

### 4.1 Distribution tables (lead with these)

**Table 1 — claim status by band.** Rows = bands A-E, columns = survived /
weakened / broken / unresolved, cells = counts and row percentages.

> The single most important number in the report: **the share of all claims that
> landed `weakened`.** If it exceeds ~50%, the attractor hypothesis is
> confirmed. Second most important: **the number of `survived` claims in Band
> A.** If Band A produces few or no `survived` claims, the harshness bias is
> confirmed.

**Table 2 — `decision_state` by band.** Rows = bands, columns = proceed /
proceed_with_changes / hold / drop. If `proceed_with_changes` dominates across
all five bands, the verdict-sameness complaint is confirmed and located.

**Table 3 — confidence by evaluator.** For each of the four evaluators: n, min,
median, max, and a 10-bucket histogram over [0,1].

> Expected under the scale-collision hypothesis: Operator's distribution is a
> spike at exactly `0.7` (it has no rubric — `operator.py:39`), Receipts clusters
> under 0.35 (the no-evidence cap), and DA/Builder spread across their severity
> bands. Four evaluators, four incompatible distributions, one field.

**Table 4 — evidence supply.** Per case: findings with >=1 evidence item, total
evidence items, source_class breakdown, stance breakdown. Note every case where
Receipts returned zero evidence, since those cases cannot produce `broken` by
construction.

**Table 5 — evidence-gate fires.** Every case where `verdict_reasoning` contains
the downgrade note. For each, state whether the downgrade was correct (thin
evidence) or wrong (the claim really was refuted and Receipts simply failed to
retrieve the citation). **B1 and B2 are the cases to scrutinise hardest here.**

### 4.2 Panel convergence

For each case, read the four findings on the same claim and judge: how many
distinct objections are actually present? Report as a ratio (e.g. "B3: 4
findings, 2 distinct objections — DA, Builder and Operator all argued
volatility").

Crossfire's core marketing claim is that isolated adversaries beat a consensus
council. A low distinct-objection ratio falsifies that claim, and it is not
something the confidence rubrics can fix — it would mean the four personas are
not actually differentiated in their prompts.

### 4.3 Verdict text quality

For all 15 `case_verdict.summary` values, in one table:

- sentence count (the prompt caps at 3 — is the cap binding or does
  `clamp_sentences` truncate mid-thought?)
- does sentence 1 name a specific number, source, rule, cost or contradiction,
  as `CASE_VERDICT_SYSTEM_PROMPT` requires? Quote it and answer yes/no.
- do any two summaries across different cases share sentence structure? Quote
  the pairs. Structural repetition across unrelated decisions is the sameness
  complaint, made concrete.

Same treatment for `next_actions`: count, and how many are generic enough to
paste onto any of the other 14 cases. That last count is the sameness metric
that matters most for the final verdict page.

### 4.4 Distinguishability vs. vanilla Gemini

For each case, put the Crossfire memo next to the control run and score 0-3:

- **0** — Crossfire says nothing the control did not, and the control said it
  more clearly.
- **1** — same substance, better structure. *(This is the failure zone. A
  reformatter is not a product.)*
- **2** — Crossfire surfaces at least one specific fact, number, source or
  contradiction the control missed.
- **3** — Crossfire reaches a materially different conclusion and shows the
  evidence that forced it.

Report the per-case score, the mean, and — most usefully — **quote the specific
sentence that earned each 2 or 3.** Those sentences are the product. Everything
on the final verdict page should be selected to make sentences like those
prominent, and everything that does not look like them is a candidate for
removal.

### 4.5 Failure inventory

Every case where the observed shape diverged from the expected shape in §2. For
each: case id, what was expected, what happened, the field and value showing it,
and your read on which of the three suspected defects explains it (or a fourth
defect not on the list).

**Divergence is not automatically a bug.** Where the system disagreed with the
expected shape and was right, say so — that is as useful as a confirmed defect,
and a report that only confirms the prior hypotheses is a report that was not
actually looking.

### 4.6 Anything unanticipated

A section for defects this spec did not predict. Timeouts, degraded findings,
malformed schema responses, retry churn in `OpenAICompatibleProvider`, ingestion
oddities, claim extraction producing fewer than 2 or more than 5 claims. Log it
even if it seems unrelated to calibration.

---

## 5. Out of scope

Do not fix anything. Do not edit prompts, rubrics, gates, or frontend code. Do
not tune a rubric mid-run and re-run a case — that silently splits the corpus
across two system versions and makes the whole run unreadable. The deliverable
is the report and the 30 saved files (15 runs + 15 controls).
