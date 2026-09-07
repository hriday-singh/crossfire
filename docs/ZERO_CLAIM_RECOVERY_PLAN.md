# Zero-Claim Recovery — Implementation Plan

**Scope:** what happens when claim extraction returns **0 claims**. Nothing else changes.

**Precision rule (non-negotiable):** every relaxation described here lives inside the
zero-claim branch. A run that extracted ≥1 claim never touches this code, never makes the
extra LLM call, never sees a provisional claim. Ranking, evaluation, cross-exam, steelman,
consequences and verdict are untouched — by the time anything reaches them, claims are
ordinary confirmed claims with no uncertainty marker.

**Same case throughout.** Clarification mutates the existing case id. No new case is
created, no history is lost.

---

## 1. Current behavior

`backend/core/loop.py:108` — when `result.testable is False` or `statements` is empty:

```python
return Case(id=uuid4(), status="needs_input", gate_message=one_line(result.redirect or "Name the specific decision..."), claims=[])
```

`routes.py:100` publishes `needs_input` and returns. Frontend (`ConfirmScreen.tsx:97`)
shows an amber banner and tells the user to hand-type claims via "+ Add an assumption".

That is the dead end. The user gets a one-line scold and an empty list.

---

## 2. Target behavior

On 0 claims:

1. A **recovery pass** runs (one extra LLM call, this branch only). It returns:
   - a clarifying question that sounds like a person, not a form;
   - 2–3 bullets naming exactly what is missing;
   - 0–3 **provisional claims** inferred only from words the user actually wrote.
2. The user either:
   - **types more detail** → `POST /cases/{id}/clarify` → same case, re-extract, and if
     claims come back the pipeline **starts immediately**, no confirmation screen; or
   - **accepts/edits the provisional claims** → normal confirm → pipeline.
3. If clarification still yields 0 claims, round 2 recovery asks a *different*, more
   concrete question. Never repeats the previous wording.

---

## 3. Backend

### 3.1 `backend/core/models.py`

```python
class Claim(BaseModel):
    ...
    provisional: bool = False   # inferred during zero-claim recovery; must be
                                # human-accepted before it can enter the pipeline

class Case(BaseModel):
    ...
    gate_message: str | None = None        # reused: holds the clarifying question
    clarify_missing: list[str] = []        # what is absent, 2-3 short bullets
    clarify_interpretation: str | None = None  # "Reading it as: ..." or None
    clarify_round: int = 0                 # 0 = first extraction, 1+ = after clarify
```

`status` comment gains nothing new — `needs_input` still covers this state.

### 3.2 New `backend/core/recovery.py`

```python
class RecoveryResult(BaseModel):
    clarifying_question: str
    missing: list[str] = []
    interpretation: str | None = None
    provisional_claims: list[str] = []

RECOVERY_SYSTEM_PROMPT = ...

async def run_recovery(
    raw_input: str,
    context: str | None,
    provider: LLMProvider,
    clarify_round: int = 0,
    previous_question: str | None = None,
) -> RecoveryResult | None
```

Prompt rules, verbatim intent:

- A first extraction pass found nothing testable in this input. Do not manufacture
  confidence and do not invent a decision the user did not describe.
- Write **one** clarifying question a curious colleague would ask out loud. Reference
  something the user actually said. Examples of the register: *"What's the actual call
  you're weighing here — and what would going wrong look like?"*, *"Which part of this are
  you closest to committing to?"* Never "Please rephrase", "Repeat that", "Invalid input".
- `missing`: 2–3 fragments naming the concrete absent pieces (the option being chosen, the
  cost, the deadline, the alternative). Not advice.
- `provisional_claims`: at most 3, each traceable to words in the input. **No invented
  numbers, dates, prices, vendors, jurisdictions or statistics.** If nothing is inferable,
  return an empty list — an honest empty list beats a fabricated claim.
- `clarify_round >= 1`: the user already answered once. Ask about something *different*
  and more concrete. `previous_question` is supplied so it can be avoided.

`run_recovery` catches every exception and returns `None`. Recovery failing must never
break extraction.

### 3.3 `backend/core/loop.py`

`extract_claims` gains `case_id: str | None = None` (so clarification reuses the id) and
`clarify_round: int = 0`, `previous_question: str | None = None`.

The zero-claim branch becomes:

```python
if not getattr(result, "testable", True) or not statements:
    recovery = await run_recovery(raw_input, context, provider, clarify_round, previous_question)
    provisional = [
        Claim(id=str(uuid4()), statement=s, provisional=True)
        for s in (recovery.provisional_claims if recovery else [])[:3]
    ]
    return Case(
        id=case_id or str(uuid4()),
        raw_input=raw_input,
        context=context,
        claims=provisional,
        status="needs_input",
        gate_message=one_line(
            (recovery.clarifying_question if recovery else None)
            or getattr(result, "redirect", None)
            or "Name the specific decision you are weighing, and what you would do if it went wrong.",
            240,
        ),
        clarify_missing=(recovery.missing[:3] if recovery else []),
        clarify_interpretation=(recovery.interpretation if recovery else None),
        clarify_round=clarify_round,
        agent_mode=final_mode,
        selected_agents=active_agents,
        agent_rationales=rationales,
    )
```

The success path also accepts `case_id or str(uuid4())` — the only change to it.

### 3.4 `backend/api/routes.py`

**New endpoint** `POST /cases/{case_id}/clarify`:

```python
class ClarifyCaseRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)

class ClarifyCaseResponse(BaseModel):
    case: Case
    auto_started: bool
```

Flow:

1. `case = store.get(case_id)`; 404 if missing.
2. 400 unless `case.status == "needs_input"` — clarify is only for the dead end.
3. Merge: `merged = f"{case.raw_input}\n\n{answer.strip()}"`. The answer is appended to
   `raw_input`, so the case reads as one decision, not a transcript.
4. Re-run `extract_claims(merged, provider, context=case.context, case_id=case.id,
   agent_mode=case.agent_mode, selected_agents=case.selected_agents,
   clarify_round=case.clarify_round + 1, previous_question=case.gate_message)`.
   Same error mapping as `create_case` (504 / 429 / 424).
5. `store.set(updated)`.
6. **If claims came back** (`status != "needs_input"`): clear `gate_message`,
   `clarify_missing`, set `status = "testing"`, `store.set`, publish `claim_map_ready`,
   then `await handle_confirm(case.id)`. Return `auto_started=True`. No confirmation
   screen — the user already told us twice what they want.
7. **If still 0**: publish `needs_input` with the new question, return `auto_started=False`.

**Confirm guard** in `confirm_case`, after claims are resolved:

```python
if any(getattr(c, "provisional", False) for c in case.claims):
    raise HTTPException(400, "Confirm or remove the inferred claims before running tests.")
```

This is the server-side enforcement of the precision rule: an inferred claim cannot reach
the pipeline without a human accepting it.

`CreateCaseRequest` is unchanged — `clarify_round` only ever moves through `/clarify`.

---

## 4. Frontend

### 4.1 `src/types/crossfire.ts`

`Claim.provisional?: boolean`; `Case.clarify_missing?: string[]`,
`Case.clarify_interpretation?: string | null`, `Case.clarify_round?: number`.

### 4.2 `src/lib/api.ts`

```ts
export async function clarifyCase(caseId: string, answer: string):
  Promise<{ case: Case; auto_started: boolean }>
```

### 4.3 `src/context/caseTypes.ts` + `caseReducer.ts`

- `ACCEPT_PROVISIONAL_CLAIM { claimId }` → sets `provisional: false`.
- `UPDATE_CLAIM_STATEMENT` also clears `provisional` (editing is accepting).
- `CLARIFY_SUCCESS { case, autoStarted }` → replaces `currentCase`; when `autoStarted`,
  sets `isStreaming: true` and `activeScreen: "dashboard"`.

### 4.4 `src/context/CaseContext.tsx`

```ts
const clarify = async (answer: string) => { ... }
```

Mirrors `confirmAndRun`'s race handling: dispatch the streaming-on state, yield one tick
(`setTimeout 50`) so `useCaseStream` mounts the `EventSource` **before** the pipeline
starts emitting, then call `clarifyCase`. Guarded by an `isClarifyingRef` so a double
submit cannot start two runs on the same case.

Note: `/clarify` is a single request that both re-extracts and launches. Extraction takes
seconds, so the stream connection is comfortably up before the first pipeline event — but
the ordering above is still the contract, matching `confirmAndRun`.

### 4.5 `src/components/screens/ConfirmScreen.tsx`

When `currentCase.status === "needs_input"`:

- Headline becomes `gate_message` (the question), replacing "We identified 0 claims to
  test". Sub-line: `clarify_interpretation` when present.
- `clarify_missing` renders as a short bullet list under the question.
- **Answer box**: textarea + "Add this detail" button → `clarify(answer)`. Disabled while
  in flight; shows the same spinner language the confirm button uses.
- Provisional claims render in the existing claim list with an "inferred" chip, a
  **"Use this"** button (`ACCEPT_PROVISIONAL_CLAIM`) and the existing edit/delete.
- Run button disabled while any claim has `provisional === true`; helper text: *"Confirm
  or remove the inferred claims first."*
- `clarify_round >= 1` and still 0 claims: keep the answer box, and surface the
  "+ Add an assumption" path more prominently as the manual escape hatch.

Existing amber banner block is replaced by this state, not stacked on top of it.

---

## 5. Tests

### Backend (`backend/tests/`)

`test_recovery.py` (new):
1. 0 statements → recovery is called once; case has the question, ≤3 claims all
   `provisional=True`, `clarify_missing` populated.
2. Recovery returns empty `provisional_claims` → question only, `claims == []`.
3. Recovery provider raises → falls back to today's `gate_message`, status still
   `needs_input`, no exception escapes.
4. Recovery returns >3 claims → truncated to 3.
5. **Precision guard:** extraction returning ≥1 statement → `run_recovery` never called
   (assert call count 0), no claim carries `provisional`.

`test_routes.py` additions:
6. `POST /clarify` on a `needs_input` case whose re-extraction yields claims → 200,
   `auto_started=True`, case status `testing`, `handle_confirm` called once, `case.id`
   unchanged, `raw_input` contains both the original and the answer.
7. `POST /clarify` yielding 0 claims again → `auto_started=False`, status `needs_input`,
   `clarify_round == 1`, new question differs from the stored previous one.
8. `POST /clarify` on a case not in `needs_input` → 400.
9. `POST /clarify` on unknown id → 404.
10. `confirm` with a `provisional=True` claim → 400.
11. `confirm` after the flag is cleared → 202 as usual.

### Frontend (`frontend/src/tests/`, per `frontend/TESTING.md`)

12. ConfirmScreen renders the question as headline + missing bullets when
    `status === "needs_input"`.
13. Provisional claim shows the "inferred" chip; Run is disabled.
14. `ACCEPT_PROVISIONAL_CLAIM` clears the flag and enables Run.
15. `UPDATE_CLAIM_STATEMENT` on a provisional claim clears the flag.
16. Answer box submit calls `clarifyCase` with the case id and the typed text.
17. `CLARIFY_SUCCESS` with `autoStarted: true` sets `isStreaming` and navigates to
    dashboard; with `false` stays on confirm and shows the new question.

`npm run test:all` in `frontend/` before the task is considered done.

---

## 6. Files touched

| File | Change |
|---|---|
| `backend/core/models.py` | `Claim.provisional`, 4 `Case` clarify fields |
| `backend/core/recovery.py` | **new** — schema, prompt, `run_recovery` |
| `backend/core/loop.py` | zero-claim branch calls recovery; `case_id` passthrough |
| `backend/api/routes.py` | `/clarify` endpoint; provisional guard on confirm |
| `backend/tests/core/test_recovery.py` | **new** |
| `backend/tests/api/test_routes.py` | clarify + guard cases |
| `frontend/src/types/crossfire.ts` | new fields |
| `frontend/src/lib/api.ts` | `clarifyCase` |
| `frontend/src/context/caseTypes.ts`, `caseReducer.ts` | 2 actions + edit-clears-flag |
| `frontend/src/context/CaseContext.tsx` | `clarify()` |
| `frontend/src/components/screens/ConfirmScreen.tsx` | needs_input state rework |
| `frontend/src/tests/*` | items 12–17 |

No migration — `store` is in-memory/SQLite-backed `Case` documents, and every new field
has a default, so existing cases deserialize unchanged.

---

## 7. Deliberately not built

- **No separate `suggested_claims` field.** Provisional claims live in `case.claims`
  behind a boolean; ConfirmScreen's list already renders and edits them.
- **No retry cap on clarify rounds.** Each round requires a human to type, so it cannot
  loop on its own.
- **No amend-history / transcript model.** The answer is appended to `raw_input`; the case
  reads as one decision.
- **No confidence score on provisional claims.** They are either accepted by a human or
  they never run. A number between those two states would be decoration.
