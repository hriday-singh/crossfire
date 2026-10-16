# Improvements

Comparison against [Council of High Intelligence](https://github.com/0xNyk/council-of-high-intelligence) (0xNyk, MIT), and what Crossfire should take from it.

## What it is

Council is a prompt protocol, not an app. It installs as a `/council` skill in Claude Code, Codex, Gemini CLI, and OpenCode. A question goes to a panel drawn from 18 analytical personas (Feynman, Taleb, Munger, Kahneman, Torvalds, and others), each paired with a named counterweight. Members answer blind, then cross-examine each other, declare final stances, and a synthesis returns a verdict that keeps dissent and unresolved questions. Modes: Full, Quick, Duo.

Council asks "what do sharp, opposing lenses think about this question?" Crossfire asks "does this specific decision survive testing against evidence?" They overlap but are not the same product.

## Where Crossfire is already stronger

Keep these. They are the reasons Crossfire exists.

- **Guarantees live in code, not in the prompt.** Council's checks for premature agreement and unsupported confidence are instructions the model polices on itself. Crossfire's evidence gate is enforced by the pipeline: no sourced contradiction, no `broken`.
- **Real evidence retrieval.** SerpApi with DuckDuckGo Lite fallback, source-class ranking, deep fetch on thin snippets, a 0.35 confidence cap when nothing public exists, and authority-scoped cross-examination probes. Council's `FACT` label depends on whatever the host model happened to retrieve.
- **No peer debate.** Council's cross-examination round lets members see each other's positions, which is the condition under which LLM agents converge. Crossfire settles disputes with a targeted search, not with rhetoric.
- **Claim decomposition and load-bearing ranking.** Compute goes to the claims the decision actually depends on. Council runs every member on the whole question.
- **Break to rebuild.** Fatal flaw, salvaged claim, trade-off, then the Prompt Fixer rewrites the decision for the next run. Council stops at a verdict.
- **No voting.** Council produces a "weighted tally" without documenting the weights. Crossfire never averages.
- **Operational maturity.** SQLite persistence with crash recovery, replayable SSE, deterministic fallbacks for every synthesis step, per-agent token telemetry, encrypted key pool, and a UI.

## Where Council is stronger

### 1. Model-family diversity across opposing seats

Council splits each persona and its counterweight across different providers so one model family never argues both sides. Crossfire isolates evaluators from each other's output, but if all four run on the same model they share the same training, the same blind spots, and the same failure modes. Isolation stops evaluators from copying each other. It does not stop them from making the same mistake independently.

**Recommendation:** add an optional per-evaluator model assignment ("seat map") on top of the existing fallback chain. Default to the current shared chain. When more than one provider is configured, prefer putting the Devil's Advocate and the Builder on different model families, and the Steel Man on a family different from the majority of the panel. Record which model produced each finding in the evidence drawer so correlated failures are visible after the fact.

### 2. Outcome tracking

Before acting, Council records a prediction, an owner, a review date, and what evidence would prove the call wrong. At the review date the result is marked confirmed, revised, reversed, or inconclusive, and the original rationale is never rewritten.

Crossfire currently has no idea whether its verdicts were right. That is the biggest gap, because real outcomes are the only honest signal for calibrating the engine. The calibration corpus measures the engine against cases we wrote. Outcomes would measure it against reality.

**Recommendation:** on a finished case, let the user record a review date and the observation that would falsify the verdict. At or after that date, prompt for an outcome (`confirmed`, `revised`, `reversed`, `inconclusive`) plus a short note. Store the outcome alongside the case without touching the original verdict. Schema change, so generate a migration under `migrations/`. Later, aggregate outcomes per verdict state and per evaluator to see which tests are over- or under-confident.

### 3. Kill criteria

Council verdicts name the observable signal that means "stop." Crossfire's "smallest next validation" says what to test next, but not which result should end the decision.

**Recommendation:** for every weakened or unresolved load-bearing claim, have the strategic consequences step also emit a kill criterion: one measurable threshold that, if observed during the next validation, flips the case to `drop`. Pair it with the existing smallest next validation so each one reads as "run this, and stop if you see that." The deterministic fallback can derive a generic criterion from the claim text.

### 4. Reversibility and deadline shape the verdict

Council captures reversibility and deadline before deliberation. Crossfire's zero-claim recovery already asks about missing cost and deadline, but reversibility does not influence the final call.

**Recommendation:** during extraction, infer whether the decision is reversible (two-way door) or hard to undo (one-way door), with a deadline if stated, and show both on the confirmation screen so the user can correct them. Feed them into the case verdict rule. An unresolved load-bearing claim on an irreversible decision should lean `hold`. The same claim on a reversible one can lean `proceed with changes` with the next validation attached.

### 5. Unresolved questions and dissent lead the report

Council's verdict opens with what is still unknown and keeps minority positions visible instead of smoothing them into consensus. Crossfire's Steel Man reconciles findings per claim, which is correct, but a strong minority finding can end up buried in the evidence drawer.

**Recommendation:** when the Steel Man rules against a finding that had high confidence, surface that finding in the memo as an explicit dissent with its source, next to the deciding factor. Put unresolved load-bearing claims at the top of the case verdict rather than in the claim list.

### 6. Distribution with zero setup

Council installs with one `/plugin install` and runs inside tools people already use. Crossfire needs a backend and a frontend running.

**Recommendation:** ship a thin MCP server over the existing REST API (`POST /cases`, the SSE stream, case fetch) exposing one tool, roughly `test_decision(text) -> case verdict`. Agents in Claude Code, Codex, and similar tools can then call Crossfire before committing to a plan. The backend stays the source of truth. The MCP layer adds no logic.

### 7. Documented blind spots per test

Each Council persona ships with a list of what it is known to miss. Crossfire's four tests have implicit blind spots (the Devil's Advocate cannot cite sources; the Researcher only sees what is publicly indexed) that the user never sees.

**Recommendation:** add a one-line known-limits note per evaluator in the agent selector and in the evidence drawer. Static copy, no model call.

### 8. Per-statement evidence labels

Council tags statements as `FACT`, `INFERENCE`, `ASSUMPTION`, or `UNKNOWN`. Crossfire already distinguishes sourced from unsourced findings at the gate, but the user reading a finding cannot tell which sentences are backed.

**Recommendation:** low priority. If evaluator output gets restructured anyway, add a label per key point. Not worth a dedicated change on its own.

## Check in Crossfire itself

**The evidence gate only works in one direction.** It stops a claim from being broken without a source. Verify in code whether anything stops a load-bearing claim from being marked `survived` on reasoning alone with no supporting evidence. The case verdict has an `unproven` bucket, so this may already be covered. If it is not, apply a mirror rule: a load-bearing claim with no sourced support caps at `weakened` or `unresolved`.

**Checked (2026-10-16): not covered, and kept that way on purpose.** Nothing requires sourced support for `survived`. `apply_evidence_gate` goes the other direction: it upgrades `weakened` to `survived` when every finding scores in the no-objection band, with no source needed. That upward gate came from calibration round 2 ("survived has to be reachable"), and a mirror rule would partly undo it. Decision: leave as is. Revisit only if outcome data (item 2) shows unsourced survivals failing in practice.

## Not worth copying

- **18 personas.** They suit open-ended philosophical and strategic questions. In Crossfire they would dilute the four tests, which are scoped to how decisions actually fail.
- **Weighted tally or voting.** Contradicts the no-averaging principle.
- **Peer cross-examination between evaluators.** Reintroduces the convergence that blind isolation exists to prevent. The search-based probe already does the job better.

## Priority

| # | Change | Effort | Payoff | Status |
|---|---|---|---|---|
| 1 | Model-family diversity per evaluator | Medium | Removes correlated blind spots | Open |
| 2 | Outcome tracking | Medium, needs a migration | Closes the loop; real-world calibration | Open |
| 3 | Kill criteria | Small | Sharper next steps | Done |
| 4 | Reversibility and deadline in the verdict | Small to medium | Verdict strictness matches stakes | Done |
| 5 | Verify the survive-side gate | Small | Fewer confident false positives | Checked, kept as is |
| 6 | Surface dissent and unresolved first | Small | Nothing important buried | Done |
| 7 | MCP server over the REST API | Medium | Agents can call Crossfire | Open |
| 8 | Blind-spot notes per test | Trivial | Honest framing | Done |
| 9 | Per-statement evidence labels | Medium | Low; only alongside other output changes | Open |

## What shipped (2026-10-16)

- **Kill criteria (3).** `DecisionConsequence.kill_criterion` is set for weakened or unresolved load-bearing claims. The consequence call writes a measurable threshold; if that call fails, a generic line built from the claim text is used. Shown as "Stop if" on the claim card and in the exported memo.
- **Reversibility and deadline (4).** `Case.reversibility` (`one_way` | `two_way` | null) and `Case.deadline` are inferred at extraction and can be corrected on the confirm screen (`POST /cases/{id}/confirm` accepts both). On a one-way door, any unresolved load-bearing claim makes the decision `hold`, with floor reason `irreversible` and zero clamp headroom, so the synthesis call cannot lift it. Broken claims and two-way or unknown doors are unchanged. Deliberate departure from the recommendation above: the one-way side is a hard lock rather than a lean, and the two-way side does not gain a `proceed_with_changes` lean.
- **Dissent and still open (6).** `CaseVerdict.dissents` lists findings with objection ≥ 0.7 on claims that survived anyway (max 3, strongest first, with source), built by `build_dissents`. The verdict now leads with "Still open" (unresolved load-bearing claims and what each needs), and those claims no longer repeat in the failed-claims list.
- **Known limits (8).** Each test has a static `knownLimit` line in `frontend/src/lib/agents.ts`, shown in the agent selector, the assigned-agents card and the evidence drawer.

No migration was needed, because cases are stored as JSON and older cases load with the new fields empty. The extraction and consequence prompts changed, so re-run the calibration corpus before comparing against the round-2 baseline. Tests: `backend/tests/core/test_decision_shape.py`, `frontend/src/tests/decisionShape.test.tsx`.
