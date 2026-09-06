# RESEARCH FIRST — `reconcile()`

Owner: Dev A. Signature: `reconcile(claim, findings: list[Finding]) -> tuple[ClaimStatus, str]`. The **only** place a `ClaimStatus` gets decided — no evaluator sets its own claim's status, and it is never a vote.

Tweak any feature below and check the listed consumers — this is a single-file function but its output is consumed by every other module's field.

---

## Feature 1 — Evidence quality signal

What makes one `Finding`'s evidence "strong" vs. "thin"? Candidates: number of `EvidenceItem`s, whether `evidence` is empty (Dev B's failure-handling path deliberately produces empty-evidence `Finding`s rather than raising), source diversity, or the evaluator's own `confidence` float.

**Research before locking:** decide whether `confidence` (set independently by each evaluator — Receipts, Devil's Advocate, Builder) is trustworthy as a cross-evaluator quality signal, or whether it needs to be normalized/ignored in favor of raw evidence count. Evaluators calibrate `confidence` on their own scale right now — nothing forces them to agree on what `0.7` means.

**If you change this:** an evidence-count-based rule and a confidence-based rule can disagree on the same `Finding` set. Re-run against a hand-built case with (a) unanimous strong evidence, (b) conflicting evidence, (c) thin/empty evidence — the three states the Hour 18-25 test checklist requires — every time this changes.

## Feature 2 — Criticality weighting (`claim.load_bearing`)

Spec says resolution is evidence quality + traceability + **how critical the claim is**. `load_bearing` is the only criticality signal available (see `research/01-load-bearing.md`). Open question: does a load-bearing claim need *stronger* evidence to resolve confidently (higher bar before `SURVIVED`/`BROKEN`), or does criticality only affect what happens *after* the verdict (i.e., `build_consequences()`'s `next_validation` requirement, not `reconcile()` itself)?

**If you fold criticality into `reconcile()` directly:** a claim's status now depends on two upstream decisions (load-bearing classification + evidence quality) compounding — a marginal load-bearing call becomes harder to debug when a verdict looks wrong, because you have two candidate causes instead of one. Document which one this function actually checks so a wrong verdict is traceable to a specific input, not "somewhere in the reconciliation logic."

## Feature 3 — Conflict detection → `UNRESOLVED`

Genuinely conflicting or thin evidence must produce `UNRESOLVED`, never a forced winner. Needs an actual definition of "conflicting" (e.g., findings assert opposite `result` values with comparable evidence quality) vs. "thin" (evidence quality too low to hang any verdict on, regardless of agreement).

**If you change the threshold:** this is the one most likely to visibly change demo behavior — a threshold that's too loose pushes everything to `UNRESOLVED` (looks indecisive), too strict forces confident verdicts on weak evidence (the exact failure the architecture exists to prevent, per Dev B's file). Sanity-check against the internal eval set's mixed-evidence case specifically before treating this as done.

## Feature 4 — Output: `verdict_reasoning`

Free text, persisted onto `DecisionConsequence.verdict_reasoning` (contract note: "not just riding along on the SSE event" — it has to actually get written to the stored object, not only streamed once and dropped). Must explain *why* this status, referencing which findings drove it.

**If you change the format** (e.g., structured reasoning instead of free text): `docs/00-CONTRACTS.md` §1 has this typed as `str`. That's a frozen-file change — needs the live sync described in `docs/05-PARALLEL-WORKFLOW.md`, not a silent edit, because Dev C's SSE `verdict_ready` event and the frontend evidence drawer both read this field expecting prose.

## Feature 5 — Downstream consumers (cross-file — check before shipping any tweak)

- **`build_consequences()` (yours, same Hour 18-25 block):** reads `ClaimStatus` directly to decide whether `next_validation` is mandatory (broken/unresolved + load-bearing). A change to Feature 3's threshold changes how many claims hit this branch.
- **SSE `verdict_ready` event (Dev C, `api/routes.py`):** fires with `{"claim_id", "status", "verdict_reasoning"}` per `docs/00-CONTRACTS.md` §3 the moment this function returns. Any latency added here (e.g., an extra LLM call for reasoning generation) delays that event live, mid-demo.
- **Evaluators' `confidence` semantics (Dev B's `receipts.py`, Dev C's `devils_advocate.py`, your `builder.py`):** if Feature 1 ends up weighting `confidence` numerically, all three evaluator authors need to calibrate their own `confidence` output consistently — flag this in the group sync, don't just start reading the field differently in `reconcile()` and assume it already means what you now need it to mean.

## Rule for this file

Work the three-state example (unanimous / conflicting / thin) by hand before writing code. If you can't produce the right `ClaimStatus` on paper for all three, the rule isn't ready for Antigravity yet.
