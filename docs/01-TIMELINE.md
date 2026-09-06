# Timeline — Backend

Your two real deliverables are the hour-11 progress review and the hour-35 prototype evaluation. This maps the build to both, using the hour-by-hour shape from the direction docs (which already lines up with your actual checkpoints almost exactly).

## Hour 0-2 — Lock the contracts

All three of you, together: freeze `core/models.py` and `providers/base.py` (`docs/00-CONTRACTS.md`). Nobody branches off until this is agreed. Dev A authors it, Dev B and Dev C read it and flag anything that won't fit their piece *now*, not at hour 20.

## Hour 2-11 — Build the smallest complete loop → CHECKPOINT 1

Target for hour 11, straight from the direction docs: **input in, claim extraction, at least two genuinely different tests, real evidence, one real four-state verdict out the other end — even if it's ugly.** An ugly real result beats a polished screen wrapping fake orchestration.

- Dev A: `GeminiProvider` wired end to end, `extract_claims()`, first pass at `classify_load_bearing()`, `store.py`
- Dev B: Tavily search wrapper + basic curation, `receipts.py` producing a real `Finding`
- Dev C: `POST /cases`, `GET /cases/{id}/stream`, `devils_advocate.py` producing a real `Finding`

**→ Update `PROGRESS.md`. This is Checkpoint 1.**

## Hour 11-35 (24h, including sleep) — Generalize, harden, add depth → CHECKPOINT 2

This is the long stretch. Sleep in here — don't burn it all on hour 11-20.

- **Hour 11-18:** generalize claim extraction across varied inputs, land the load-bearing question properly, build real test-plan routing so different claims hit different tests (not the same three every time).
- **Hour 18-25:** decision consequence + next-validation as mandatory core, `unresolved` handled properly (not just theoretically reachable). Add `builder.py` here *only if* the loop and evidence path are already solid — skip it without guilt otherwise.
- **Hour 25-30:** loop is stable — add the second provider (Anthropic or OpenAI-compatible). Spend remaining slack hardening evidence pipeline reliability (Scrapling failure handling, demo fixture switch) while there's still runway to react if it's flaky.
- **Hour 30-35:** integration hardening, not new features. Run the loop against several different inputs, not just the one it was built on. Wire the claim-confirmation checkpoint and evidence-drawer data end to end (ugly is fine, the content has to be there). This is where the seams between three people's code actually break — reserve real time for it.

Target for hour 35: **loop runs cleanly on multiple inputs, claim-confirmation gate is real (not faked client-side), every Finding/DecisionConsequence carries the fields the evidence drawer needs.**

**→ Update `PROGRESS.md`. This is Checkpoint 2 — Prototype Evaluation.**

## Hour 35-48 — Demo prep

- **Hour 35-38:** side-by-side demo mechanism ready (should already be running informally as an internal check since ~hour 18-20).
- **Hour 38-42:** run the 5-10 case internal eval set (`tests/eval_set/`), fix the worst false negatives / worst unsupported-criticism cases.
- **Hour 42-46:** final polish, two rehearsals on the provider the demo will actually run on, prepared fallback evidence locked in.
- **Hour 46-48:** buffer.

Third provider, Overthinker, document/URL ingestion: only if hour 38 shows real slack, in that order — cheapest first.
