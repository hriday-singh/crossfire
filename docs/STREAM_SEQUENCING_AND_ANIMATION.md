# Live Run: Stream Contract & Bullpen Animation

Owner: Dev A. Scope: the SSE stream `GET /cases/{id}/stream` and the animation it drives
(`DiscussionApp` + `useBackendLiveBridge`).

Two problems this document closes:

1. Runs ended **mid-test**, before the pipeline finished (premature `done`).
2. The stream did not describe the run as *"claim 1 and its agents, then claim 2 and its
   agents, then Steelman consolidates, then done"*, so the animation could not follow it.

---

## 1. Wire format

Every frame is standard SSE:

```
event: <name>
data: <json>

```

* Keepalive: `: ping` frame every 15s (`SSE_PING_INTERVAL_SECONDS`).
* Terminator: `event: done` with data `[DONE]` — the payload is that literal string,
  **not** JSON. Parse defensively.
* History is replayed on reconnect (`events.subscribe`), so a refresh mid-run rebuilds
  the whole sequence from the first frame.

## 2. Event sequence (authoritative order)

| # | Event | Payload | Cardinality |
|---|-------|---------|-------------|
| 1 | `claim_map_ready` | `claims` | once, at `POST /cases` |
| 2 | `awaiting_confirmation` | `{}` | once |
| 3 | `load_bearing_ready` | `claim_id, load_bearing, reason` | one per claim, streamed |
| 4 | `claim_started` | `claim_id, claim_index, total_claims, claim_statement, agents[], test_ids[]` | **one per claim, in claim order** |
| 5 | `test_started` | `test_id, target_claim_id, failure_mode, evaluator, claim_statement` | one per agent, **when that agent actually begins** |
| 6 | `finding_ready` | `finding, target_claim_id` | one per agent, **the moment that agent returns** |
| 7 | `claim_complete` | `claim_id, finding_count` | one per claim, after its last `finding_ready` |
| 8 | `finding_ready` | probe findings | 0..n, cross-examination phase |
| 9 | `verdict_ready` | `claim_id, status, weakened_kind, confidence, verdict_reasoning, fatal_flaw, salvaged_claim, tradeoff_acknowledged, missing_input, salvage_scope` | one per claim, streamed as each reconcile lands |
| 10 | `consequence_ready` | `consequence` | one per claim |
| 11 | `case_verdict` | `case_verdict` | once |
| 12 | `run_complete` | `case_id` | **once, terminal** |
| 13 | `done` | `[DONE]` | **once, only after `run_complete` or `error`** |

`activity` frames (`tag, message, claim_id, action, evaluator`) interleave throughout as
telemetry for the side feed. They are never terminal.

### Guarantees

* `done` is emitted **only** after `run_complete` or `error` — never mid-run.
* `claim_started` frames arrive in `case.claims` order, each carrying `claim_index` and
  `total_claims`, so the frontend knows the full shape of the run up front.
* For any test id: `test_started` precedes its `finding_ready`.
* For any claim: every `finding_ready` for that claim precedes its `claim_complete`.

### Deliberate non-guarantee: execution is still concurrent

Claim groups run in parallel (bounded by `evaluator_concurrency`, default 8). Serializing
them would multiply run latency by the claim count. So `finding_ready` frames from
different claims **can interleave**. The ordering the user sees is the frontend's job: the
backend hands over `claim_index`, `total_claims` and `agents[]` so the animation can be
paced deterministically without slowing the pipeline.

*If strictly sequential execution is ever wanted:* in `run_evaluators`, replace the final
`asyncio.gather(*(_run_group(cid) ...))` with `for cid in ordered_claim_ids: await
_run_group(cid)`. Two lines. Costs claim-count × round-trip latency.

## 3. What changed (backend, `core/loop.py::run_evaluators`)

* **A** — `finding_ready` moved inside `_run_one`, published as each evaluator returns.
  Previously all findings were published in one burst after `asyncio.gather`, so no agent
  ever appeared to "come back with a result" live.
* **B** — `test_started` moved inside `_run_one` (after acquiring the semaphore), so it
  marks the agent actually starting rather than a queued intention.
* **C** — plan grouped by claim in `case.claims` order; new `claim_started` and
  `claim_complete` frames bracket each group.

Frontend plumbing: `claim_started` / `claim_complete` added to `SSEEventName` and to the
`useCaseStream` subscription list. **EventSource only delivers named events that are
explicitly subscribed** — any new event name must be added there or it is silently dropped.

## 4. Premature-`done` fixes (frontend)

Three independent causes, all fixed:

1. **Scripted mock scenario playing over a live run.** `useSocketSimulation` auto-played
   `MOCK_SCENARIOS` whenever `connectionStatus === 'mock_mode'` (the default), including
   during a real run. The scenario ends with a steelman `right_door` packet carrying
   `isSynthesisDone: true, isLoadingDone: true, progress: 100`, which tripped the exit
   animation and navigated to the dashboard mid-test. Fixed with a `mockEnabled` option,
   passed as `!isRealRun` from `DiscussionApp`.
2. **Packet-derived completion.** `DiscussionApp` accepted `isSynthesisDone` or
   `stage.includes('Synthesis')` from *any* packet as proof the run was over. Now, when a
   real (non-preview) case is loaded, completion comes only from the case itself:
   `status === 'done' || case_verdict` (`isRealRun` / `caseIsDone`). Mock packets still
   drive the preview and demo paths.
3. **EventSource's native `error` event.** `useCaseStream` subscribed to `"error"`, which
   collides with the transport-level error EventSource fires on any dropped connection. A
   network blip was treated as a pipeline error: stream closed, `isStreaming` false, run
   abandoned mid-test. Transport errors (no string `data`) are now ignored and left to
   EventSource's built-in reconnect; only a real backend `error` frame ends the run.

## 5. How the animation should now work

Drive the bullpen entirely off the event sequence. One claim on stage at a time.

**Per claim, in `claim_index` order:**

1. `claim_started` — highlight the claim card, show `claim_index + 1` of `total_claims`,
   and wake exactly the agents in `agents[]` (leave unlisted agents seated). Progress
   floor for the testing phase: `25 + (claim_index / total_claims) * 50`.
2. `test_started` — that agent types at its own cubicle (`AGENT_HOME_DESKS`), tagged with
   its `COGNITIVE_TAGS` label (`[Feasibility Test]`, `[Citation Audit]`, and so on).
3. `finding_ready` — that agent walks to `podium_approach`, reports (`dialogue` = the
   finding's headline/reasoning, `verdict` = its result), then walks back and sits.
   Because findings now stream individually, each agent's round trip plays as it happens.
4. `claim_complete` — all of that claim's agents seated; advance to the next
   `claim_started`. Frames belonging to a later claim that arrive early are **queued**,
   not played: the backend runs claims in parallel, the stage does not.

**Then, once per run:**

5. `verdict_ready` (per claim) — Steelman at `steelman_chair` marks that claim's verdict
   on the board. Still mid-run: no exit, no progress at 100.
6. `case_verdict` — Steelman stands and delivers the consolidated verdict
   (`Crucible Synthesis: <decision_state>`). This is the consolidation beat.
7. `run_complete` — remaining evaluators return to standby seats.
8. `done` — **only now** does Steelman walk to `right_door`; when the sprite passes
   x >= 840 the page transition fires and the app navigates to the decision memo.

**Invariants for the animation layer:**

* Nothing may set `progress = 100`, latch `isSynthesisDone`, or trigger the door exit
  unless the real case says so (`status === 'done' || case_verdict`). Packet flags alone
  are not proof.
* Progress is monotonic (`maxProgressRef`); replayed history on reconnect must not rewind it.
* Every event is keyed by id and processed once (`processedEventIdsRef`); a reconnect
  replays history, and dedupe is what keeps the animation from restarting.

## 6. Regression tests

Backend — `backend/tests/core/test_stream_sequencing.py`:
* ordered `claim_started` per claim with agent roster and index/total;
* `test_started` precedes its own `finding_ready` for every test id;
* `claim_complete` follows that claim's last finding;
* no terminal frame is emitted by the evaluator stage.

Frontend — `frontend/src/tests/doneSignalGating.test.tsx`:
* no scripted packets dispatch while a real run is live (`mockEnabled: false`);
* mock autoplay still works with no real case (preview/demo unaffected);
* native EventSource `error` is ignored, a real backend `error` frame still ends the run;
* `DiscussionApp` never shows "Evaluation Complete" or navigates before the done signal.

## 7. Remaining work

`useBackendLiveBridge` still animates events in arrival order and does not yet consume
`claim_started` / `claim_complete`. The frames are on the wire and subscribed; the
per-claim queueing described in section 5 is the next change.
