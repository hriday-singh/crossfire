# Contracts — FROZEN at Hour 2

Everything in this file is locked by end of hour 2, by whoever's building `core/models.py` and `providers/base.py` (Dev A), with a quick look from the other two before anyone branches off. **After that point, nobody edits this file's shape without a live sync** — all three modules import directly from it, so a silent rename breaks two other people's code at once.

Field names can still move if the team agrees; the *shape* — what objects exist, what they contain — doesn't.

---

## 1. Data Models (`core/models.py`)

```python
from enum import Enum
from pydantic import BaseModel

class ClaimStatus(str, Enum):
    SURVIVED = "survived"
    WEAKENED = "weakened"
    BROKEN = "broken"
    UNRESOLVED = "unresolved"

class Claim(BaseModel):
    id: str
    statement: str
    load_bearing: bool | None = None       # set after the load-bearing question runs
    status: ClaimStatus | None = None

class TestPlanItem(BaseModel):
    id: str
    target_claim: str                       # Claim.id
    failure_mode: str                       # what kind of failure this test is built to catch
    objective: str

class EvidenceItem(BaseModel):
    source_url: str
    title: str | None = None
    snippet: str                            # curated, not the full page
    retrieved_at: str

class Finding(BaseModel):
    claim_id: str
    test_id: str
    evaluator: str                          # "devils_advocate" | "receipts" | "builder" | "overthinker"
    result: str
    evidence: list[EvidenceItem] = []
    reasoning: str
    confidence: float
    contradiction: str | None = None

class DecisionConsequence(BaseModel):
    claim_id: str
    impact: str                             # high | medium | low, or a short phrase
    recommended_change: str
    next_validation: str | None = None      # required when status is broken/unresolved and load-bearing
    verdict_reasoning: str = ""             # why Judge reconciled to this status — persisted here,
                                             # not just riding along on the SSE event

class Case(BaseModel):
    id: str
    raw_input: str
    context: str | None = None              # from an ingested doc/URL, once that path exists
    claims: list[Claim] = []
    test_plan: list[TestPlanItem] = []
    findings: list[Finding] = []
    consequences: list[DecisionConsequence] = []
    status: str = "extracting"              # extracting | awaiting_confirmation | testing | done | error
```

`Case` is the one object the whole backend passes around. Every module either reads it, appends to it, or streams a diff of it.

## 2. Provider Interface (`providers/base.py`)

```python
from typing import Protocol
from pydantic import BaseModel

class LLMProvider(Protocol):
    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel: ...
```

Deliberately text/structured-output only — no `tools=[...]`. Search and fetch are handled by `evidence/` (Tavily/Scrapling), never by provider-native tool calls. This is what makes swapping providers later purely mechanical.

`GeminiProvider` is the only concrete implementation built for the hackathon. `AnthropicProvider` and `OpenAICompatibleProvider` are empty classes implementing the same protocol — stubs, not built out.

**Everything calls through this interface.** Nothing outside `providers/` talks to `google-genai` directly.

## 3. SSE Event Schema

One endpoint, one stream per case:

```
event: claim_map_ready       data: {"claims": [...]}
event: awaiting_confirmation data: {}
event: test_started          data: {"test_id": "...", "target_claim_id": "...", "evaluator": "devils_advocate"}
event: finding_ready         data: {"finding": {...}, "target_claim_id": "..."}
event: verdict_ready         data: {"claim_id": "...", "status": "...", "verdict_reasoning": "..."}
event: consequence_ready     data: {"consequence": {...}}
event: run_complete          data: {"case_id": "..."}
event: error                 data: {"stage": "...", "message": "..."}
```

`target_claim_id` / `evaluator` are top-level even though they're nested inside `Finding`/`TestPlanItem` too — that's deliberate, so the frontend doesn't have to unpack a nested object to animate the right claim card.

## 4. Call Sequence (who calls what, in order)

```
POST /cases                     -> extract_claims()            -> Case(status=awaiting_confirmation)

GET  /cases/{id}/stream         -> opens immediately, reads from an asyncio.Queue keyed by case_id
                                    (frontend should open this before firing confirm; the queue
                                     buffers regardless of when a consumer attaches)

POST /cases/{id}/confirm        -> validates claims, asyncio.create_task(run_pipeline(case_id)),
                                    returns 202 Accepted immediately — does NOT await the pipeline

run_pipeline() [background task] -> classify_load_bearing()
                                  -> build_test_plan()
                                  -> run_evaluators()  [asyncio.gather, independent]
                                  -> reconcile()        [Judge, sees all findings at once]
                                  -> build_consequences()
                                  -> Case(status=done), queue closed and discarded

GET  /cases/{id}                -> full Case, for the evidence drawer, any time after status=done
```

**Why `/confirm` returns 202 immediately:** if it awaited the whole pipeline before responding, and the frontend only opened its SSE connection after that response came back, every event fired during the 15-30 second run would already be gone. The queue exists precisely so the HTTP response and the actual work are decoupled.

`run_evaluators()` is the independence-critical part — each evaluator sees only its own claim + context, never another evaluator's output:

```python
async def run_evaluators(case: Case, plan: list[TestPlanItem]) -> list[Finding]:
    tasks = [dispatch(item, case) for item in plan]   # each evaluator sees only its own claim + context
    return await asyncio.gather(*tasks, return_exceptions=True)
```

`dispatch()` routes each `TestPlanItem` to an evaluator by `failure_mode` (assumption / evidence / feasibility / edge-case) — never by "which agent is free."

`reconcile()` is a single call that receives every `Finding` for a claim at once and returns the `ClaimStatus`. This is the **only** place a status gets decided — no evaluator sets its own claim's status. Resolution is evidence quality + how critical the claim is, never a vote.
