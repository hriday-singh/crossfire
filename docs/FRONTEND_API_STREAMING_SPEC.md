# Crossfire — Frontend-to-Backend API & Streaming Specification

> **Single Source of Truth for Frontend Integration, REST Endpoints, and Live SSE Streaming**
> **Target Audience:** Frontend Developers, Backend Developers (Dev C), and AI Coding Agents.
> **Full Frontend Technical Specification:** See [crossfire_frontend_spec.md](../frontend/docs/crossfire_frontend_spec.md) for the complete end-to-end component, reducer, design token, and testing architecture.

---

## 1. Agent Directive & "Stop & Ask" Protocols

When an AI agent is given this document and instructed:
> *"Create the latest spec"*, *"Update the spec"*, or *"Implement the API / streaming layer"*

The agent must first inspect the current repository contracts against the rules below.

### Mandatory "Stop & Ask" Triggers
If any implementation or requirement change encounters one of the following scenarios, **the agent MUST HALT immediately and ask the user** before writing code or changing specs:

1. **Model Schema Alteration:** Any attempt to rename, delete, or modify fields in `core/models.py` (which is frozen at Hour 2 per `00-CONTRACTS.md`).
2. **Evaluator Name Leakage:** Any requirement that would render internal backend evaluator names (`devils_advocate`, `receipts`, `builder`, `overthinker`) in the UI, tooltips, or client-facing errors instead of the mapped test names (`Assumption Test`, `Evidence Test`, `Feasibility Test`, `Edge-Case Test`).
3. **Consequence Impact Type:** Any deviation from the strict three-tier enum `Literal["high", "medium", "low"]` for `DecisionConsequence.impact`.
4. **Blocking Confirm Route:** Any suggestion to make `POST /cases/{id}/confirm` await the full evaluation pipeline rather than returning `202 Accepted` immediately.
5. **Unresolved Visual Language:** Any attempt to style `unresolved` claims as gray or disabled, rather than as an active, distinct measured verdict (indigo/violet).

If none of these conflicts exist, the agent may proceed directly to implementing or updating routes, schemas, and client hooks.

---

## 2. System Architecture & Transport Protocol

```
+-----------------------------------------------------------------------------------+
|                                 FRONTEND (React)                                  |
+-----------------------------------------------------------------------------------+
     |                                   |                              ^
     | 1. POST /cases                    | 3. POST /cases/{id}/confirm  | 4. GET /cases/{id}/stream
     |    (prompt, context)              |    (confirmed claims)        |    (SSE live events)
     v                                   v                              |
+-----------------------------------------------------------------------------------+
|                                 BACKEND (FastAPI)                                 |
+-----------------------------------------------------------------------------------+
     |                                   |                              ^
     | 200 OK                            | 202 Accepted                 | reads from
     | Case(awaiting_confirmation)       | (non-blocking)               | asyncio.Queue
     v                                   v                              |
                           spawns background pipeline  -----------------+
                           asyncio.create_task(run_pipeline(id))
```

### Protocol Standards
- **REST Endpoints:** JSON over HTTP (`application/json`).
- **Streaming Endpoint:** Server-Sent Events (`text/event-stream; charset=utf-8`), HTTP chunked transfer.
- **SSE Headers Required:**
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no` (disables reverse proxy buffering)
- **Base URL:** `/api/v1` (or root `/` during local hackathon build).

### Critical Race-Condition Prevention Rule
1. Frontend calls `POST /cases` $\rightarrow$ receives `Case` with `status == "awaiting_confirmation"`.
2. When the user confirms, the frontend **MUST attach to `GET /cases/{id}/stream` FIRST**.
3. Backend attaches an `asyncio.Queue` to that `case_id`.
4. Frontend then fires `POST /cases/{id}/confirm`.
5. Backend creates the background task `run_pipeline(case_id)` and returns `202 Accepted` in $<50$ms.
6. The `asyncio.Queue` buffers all pipeline events from step 5. Even if network latency delays the SSE listener attachment, zero events are lost.

---

## 3. Screen-by-Screen Integration Contract

### Screen 1: Entry Screen ("What are you considering?")
The starting interface where the user submits their raw proposal, idea, or decision.

#### UI State & Behavior
- Single prominent auto-growing textarea and a "Test this" primary CTA button.
- Submitting disables the input and displays a skeleton loading state with caption: *"Breaking this into claims..."*.
- No spinner percentages or fake progress bars.

#### Request: Create Case
- **Endpoint:** `POST /cases`
- **Headers:** `Content-Type: application/json`
- **Body Schema:**
```json
{
  "raw_input": "string (min 10 chars, required)",
  "context": "string | null (optional pasted text or URL)"
}
```

#### Response: Case Created (200 OK)
```json
{
  "id": "case_1024_abcd",
  "raw_input": "We should offer a free tier with unlimited AI queries.",
  "context": null,
  "claims": [
    {
      "id": "c1",
      "statement": "Free tier users will convert to paid users at standard SaaS rates.",
      "load_bearing": null,
      "status": null
    },
    {
      "id": "c2",
      "statement": "AI inference unit economics will allow sustainable margins on free accounts.",
      "load_bearing": null,
      "status": null
    }
  ],
  "test_plan": [],
  "findings": [],
  "consequences": [],
  "status": "awaiting_confirmation"
}
```

---

### Screen 2: Claim Map Confirmation
The user reviews the extracted assumptions before tests execute.

#### UI State & Behavior
- Header echoes `raw_input` back to the user in clean formatting.
- Editable list of claim cards:
  - User can edit `statement` text inline.
  - User can remove irrelevant claims (delete icon).
  - User can click "Add a claim" (generates client-side temp id e.g. `c_custom_1`).
- `load_bearing` and `status` are **NOT** rendered on this screen (they do not exist yet).
- Primary CTA: "Confirm and run tests".

#### Outgoing Sequence on Confirm Click
1. **Frontend opens stream:** `GET /cases/{id}/stream`
2. **Frontend fires confirmation request:** `POST /cases/{id}/confirm`

#### Request: Confirm Claims
- **Endpoint:** `POST /cases/{id}/confirm`
- **Body Schema:**
```json
{
  "claims": [
    {
      "id": "c1",
      "statement": "Free tier users will convert to paid users at standard SaaS rates."
    },
    {
      "id": "c2",
      "statement": "AI inference unit economics will allow sustainable margins on free accounts."
    },
    {
      "id": "c_custom_1",
      "statement": "Abuse and bot scraping on the free tier can be mitigated effectively."
    }
  ]
}
```

#### Response: Confirmed (202 Accepted)
Must return in $<100$ms without awaiting the pipeline.
```json
{
  "case_id": "case_1024_abcd",
  "status": "testing",
  "message": "Claims confirmed. Pipeline started."
}
```

---

### Screen 3: Live CI Dashboard (Test Runner)
The active test runner screen that updates in real time from the SSE stream.

#### UI State & Behavior
- Flat, dense, dark CI dashboard layout (GitHub Actions / Vercel style).
- Groups test rows by `target_claim_id`.
- Test names **MUST** be mapped from `failure_mode` (never display evaluator names):

| `failure_mode` | Displayed Test Name |
|---|---|
| `assumption` | **Assumption Test** |
| `evidence` | **Evidence Test** |
| `feasibility` | **Feasibility Test** |
| `edge-case` | **Edge-Case Test** |
| *(unknown / other)* | **Test** |

#### Test Row Lifecycle States:
1. **Queued:** Muted circle-dashed icon, test name, target claim.
2. **Running (`test_started`):** Subtle row background highlight, spinning/pulsing icon.
3. **Finding Attached (`finding_ready`):** Confidence chip and reasoning summary excerpt appear.
4. **Resolved (`verdict_ready`):** Icon transitions to verdict badge with subtle flash ($<300$ms).
5. **Impact Attached (`consequence_ready`):** 3-bar intensity meter chip rendered.

#### 4-Verdict Visual Tokens

| Status | Color Token | Hex | Lucide Icon | Meaning |
|---|---|---|---|---|
| `survived` | `text-emerald-400`, `border-emerald-500/30` | `#34d399` | `circle-check` | Claim validated by tests & evidence |
| `weakened` | `text-amber-400`, `border-amber-500/30` | `#fbbf24` | `triangle-alert` | Partial validity; assumptions contested |
| `broken` | `text-red-400`, `border-red-500/30` | `#f87171` | `circle-x` | Direct contradictions or feasibility fail |
| `unresolved` | `text-indigo-400`, `border-indigo-500/30` | `#818cf8` | `circle-help` | Insufficient evidence found (NOT gray) |

---

### Screen 4: Results Dashboard & Evidence Drawer
The persistent post-run analysis view once `Case.status == "done"`.

#### UI State & Behavior
- Top counter banner: *"N of M claims tested. X survived, Y weakened, Z broken, W unresolved."*
- List of Claim cards sorted load-bearing first, then broken $\rightarrow$ unresolved $\rightarrow$ weakened $\rightarrow$ survived.
- Each claim card shows:
  - Statement text
  - Verdict badge
  - Load-bearing icon/flag (if `load_bearing == true`)
  - Secondary confidence indicator
- **Clicking any claim card opens the Evidence Drawer (Right Slide-over Sheet).**

#### Evidence Drawer Hierarchy (Top to Bottom)
1. **Claim Statement:** Full `Claim.statement`.
2. **Why It Matters:** Synthesized sentence from load-bearing classification (e.g. *"If false, the unit economics fail immediately."*).
3. **Tests Run:** List of tests executed against this claim.
4. **Evidence Found:** Card for each `EvidenceItem` containing:
   - `title` (or domain if title is null)
   - `source_url` (clickable link opening in new tab with `external-link` icon)
   - `snippet` (curated excerpt, max 300 chars)
   - *Note:* If evidence list is empty, render explicit state: *"No external evidence could be retrieved for this claim."* (never blank).
5. **Contradictions:** `Finding.contradiction` (rendered with warning accent only if non-null).
6. **Verdict Status:** Verdict badge repeated for scannability.
7. **Decision Impact:** 3-segment filled bar meter for `high` | `medium` | `low`.
8. **What Changes:** `DecisionConsequence.recommended_change`.
9. **Next Validation:** `DecisionConsequence.next_validation` (mandatory when status is `broken` or `unresolved` and load-bearing).

#### Cold Reload / Snapshot Request
- **Endpoint:** `GET /cases/{id}`
- **Response (200 OK):** Full serialized `Case` object.

---

## 4. SSE Streaming Event Catalog

The SSE stream is accessed via `GET /cases/{id}/stream`. Every message follows standard SSE formatting:
```text
event: <EVENT_NAME>
data: <JSON_PAYLOAD>

```

### Event 1: `claim_map_ready`
- **When:** Claims have been extracted and mapped (buffered for stream consumers).
- **Payload:**
```json
{
  "claims": [
    {
      "id": "c1",
      "statement": "Users will convert at standard SaaS rates.",
      "load_bearing": null,
      "status": null
    }
  ]
}
```

### Event 2: `awaiting_confirmation`
- **When:** Backend is waiting for the user to confirm claims.
- **Payload:**
```json
{}
```

### Event 3: `test_started`
- **When:** A specific test item begins running in the background pipeline.
- **Payload:**
```json
{
  "test_id": "t1_c1",
  "target_claim_id": "c1",
  "failure_mode": "assumption",
  "evaluator": "devils_advocate"
}
```

### Event 4: `finding_ready`
- **When:** An evaluator completes its analysis and returns evidence/reasoning.
- **Payload:**
```json
{
  "target_claim_id": "c1",
  "finding": {
    "claim_id": "c1",
    "test_id": "t1_c1",
    "evaluator": "devils_advocate",
    "result": "Free tier cannibalizes paid conversion by 65%.",
    "evidence": [
      {
        "source_url": "https://example.com/saas-metrics-study",
        "title": "Freemium Conversion Benchmarks 2025",
        "snippet": "Unlimited free tiers reduced paid conversion from 4.2% to 1.1% across 120 B2B apps.",
        "retrieved_at": "2026-09-06T16:00:00Z"
      }
    ],
    "reasoning": "Unlimited utility on the free tier eliminates the core economic incentive to upgrade.",
    "confidence": 0.88,
    "contradiction": "Claims of high conversion directly conflict with benchmark data."
  }
}
```

### Event 5: `verdict_ready`
- **When:** The reconciliation Judge evaluates all findings for a claim and assigns the final verdict.
- **Payload:**
```json
{
  "claim_id": "c1",
  "status": "broken",
  "verdict_reasoning": "Industry benchmark evidence and margin modeling refute the conversion premise."
}
```

### Event 6: `consequence_ready`
- **When:** Actionable recommendations and impact are synthesized for a claim.
- **Payload:**
```json
{
  "consequence": {
    "claim_id": "c1",
    "impact": "high",
    "recommended_change": "Cap free tier at 10 queries/month or introduce a time-limited 14-day trial.",
    "next_validation": "Test a 10-query limit with 50 pilot users and measure upgrade velocity.",
    "verdict_reasoning": "Industry benchmark evidence and margin modeling refute the conversion premise."
  }
}
```

### Event 7: `run_complete`
- **When:** All tests in the test plan have finished, all claims have verdicts, and the case status is `done`.
- **Payload:**
```json
{
  "case_id": "case_1024_abcd"
}
```
*Action:* Frontend marks stream as finished and closes EventSource/reader cleanly.

### Event 8: `error`
- **When:** An error occurs during execution.
- **Payload:**
```json
{
  "stage": "search_evidence",
  "message": "DuckDuckGo search rate limit reached. Proceeding with heuristic fallback."
}
```
*Handling:*
- If `stage` is test-specific: test row shows localized warning.
- If `stage` is pipeline-level: display top alert banner.

---

## 5. Mirrored TypeScript & Pydantic Contracts

### TypeScript Definitions (`frontend/src/types/crossfire.ts`)

```typescript
export type ClaimStatus = "survived" | "weakened" | "broken" | "unresolved";

export type FailureMode = "assumption" | "evidence" | "feasibility" | "edge-case";

export type ConsequenceImpact = "high" | "medium" | "low";

export type CaseStatus =
  | "extracting"
  | "awaiting_confirmation"
  | "testing"
  | "done"
  | "error";

export interface Claim {
  id: string;
  statement: string;
  load_bearing: boolean | null;
  status: ClaimStatus | null;
}

export interface TestPlanItem {
  id: string;
  target_claim: string;
  failure_mode: FailureMode;
  objective: string;
}

export interface EvidenceItem {
  source_url: string;
  title: string | null;
  snippet: string;
  retrieved_at: string;
}

export interface Finding {
  claim_id: string;
  test_id: string;
  evaluator: string; // internal only - do not render in UI
  result: string;
  evidence: EvidenceItem[];
  reasoning: string;
  confidence: number;
  contradiction: string | null;
}

export interface DecisionConsequence {
  claim_id: string;
  impact: ConsequenceImpact;
  recommended_change: string;
  next_validation: string | null;
  verdict_reasoning: string;
}

export interface Case {
  id: string;
  raw_input: string;
  context: string | null;
  claims: Claim[];
  test_plan: TestPlanItem[];
  findings: Finding[];
  consequences: DecisionConsequence[];
  status: CaseStatus;
}

// SSE Event Payloads
export interface SSETestStartedData {
  test_id: string;
  target_claim_id: string;
  failure_mode?: FailureMode;
  evaluator?: string;
}

export interface SSEFindingReadyData {
  target_claim_id: string;
  finding: Finding;
}

export interface SSEVerdictReadyData {
  claim_id: string;
  status: ClaimStatus;
  verdict_reasoning: string;
}

export interface SSEConsequenceReadyData {
  consequence: DecisionConsequence;
}

export interface SSERunCompleteData {
  case_id: string;
}

export interface SSEErrorData {
  stage: string;
  message: string;
}
```

---

### Pydantic v2 Models (`backend/api/schemas.py`)

```python
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field
from core.models import Case, Claim, ClaimStatus, DecisionConsequence, EvidenceItem, Finding, TestPlanItem


class CreateCaseRequest(BaseModel):
    raw_input: str = Field(..., min_length=5, description="Decision or idea text")
    context: str | None = Field(default=None, description="Optional extra context or URL")


class ConfirmedClaimItem(BaseModel):
    id: str
    statement: str


class ConfirmCaseRequest(BaseModel):
    claims: list[ConfirmedClaimItem] = Field(..., min_items=1)


class ConfirmCaseResponse(BaseModel):
    case_id: str
    status: Literal["testing"] = "testing"
    message: str = "Claims confirmed. Pipeline started."


class SSETestStartedPayload(BaseModel):
    test_id: str
    target_claim_id: str
    failure_mode: str
    evaluator: str


class SSEFindingReadyPayload(BaseModel):
    target_claim_id: str
    finding: Finding


class SSEVerdictReadyPayload(BaseModel):
    claim_id: str
    status: ClaimStatus
    verdict_reasoning: str


class SSEConsequenceReadyPayload(BaseModel):
    consequence: DecisionConsequence


class SSERunCompletePayload(BaseModel):
    case_id: str


class SSEErrorPayload(BaseModel):
    stage: str
    message: str
```

---

## 6. Implementation Guide

### For Backend Engineers (Dev C — `backend/api/routes.py`)
1. Implement `POST /cases`:
   - Calls `core.loop.extract_claims(payload.raw_input, payload.context)`.
   - Stores new `Case` in `store.py`.
   - Returns `Case` with `status == "awaiting_confirmation"`.
2. Implement `GET /cases/{id}/stream`:
   - Retrieves case from `store.py`.
   - Returns `StreamingResponse(event_generator(case_id), media_type="text/event-stream")`.
   - Generator reads from `core.loop.get_case_queue(case_id)`.
3. Implement `POST /cases/{id}/confirm`:
   - Validates claim list.
   - Updates `case.claims` with user modifications.
   - Sets `case.status = "testing"`.
   - Triggers `asyncio.create_task(core.loop.run_pipeline(case_id))`.
   - Returns `ConfirmCaseResponse(case_id=id)` with HTTP status `202 Accepted`.
4. Implement `GET /cases/{id}`:
   - Returns existing `Case` from `store.py` or 404 if not found.

### For Frontend Engineers (React Hook — `useCaseStream.ts`)
```typescript
import { useEffect, useState } from "react";
import { Case, Claim, ClaimStatus, Finding, DecisionConsequence } from "@/types/crossfire";

export function useCaseStream(caseId: string | null) {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [activeTests, setActiveTests] = useState<Record<string, "queued" | "running" | "done">>({});
  const [isLive, setIsLive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    const es = new EventSource(`/api/v1/cases/${caseId}/stream`);

    es.onopen = () => setIsLive(true);
    es.onerror = () => setIsLive(false);

    es.addEventListener("test_started", (e) => {
      const data = JSON.parse(e.data);
      setActiveTests((prev) => ({ ...prev, [data.test_id]: "running" }));
    });

    es.addEventListener("finding_ready", (e) => {
      const data = JSON.parse(e.data);
      setCaseData((prev) => prev ? {
        ...prev,
        findings: [...prev.findings, data.finding]
      } : prev);
      setActiveTests((prev) => ({ ...prev, [data.finding.test_id]: "done" }));
    });

    es.addEventListener("verdict_ready", (e) => {
      const data = JSON.parse(e.data);
      setCaseData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          claims: prev.claims.map((c) =>
            c.id === data.claim_id ? { ...c, status: data.status } : c
          ),
        };
      });
    });

    es.addEventListener("consequence_ready", (e) => {
      const data = JSON.parse(e.data);
      setCaseData((prev) => prev ? {
        ...prev,
        consequences: [...prev.consequences, data.consequence]
      } : prev);
    });

    es.addEventListener("run_complete", () => {
      setIsFinished(true);
      es.close();
    });

    return () => es.close();
  }, [caseId]);

  return { caseData, activeTests, isLive, isFinished };
}
```

---

## 7. Verification Checklist

Before considering an integration build complete, run through this checklist:

- [ ] `POST /cases` returns a `Case` object with `status: "awaiting_confirmation"` in under 3 seconds.
- [ ] Inline claim additions or edits on Screen 2 correctly serialize into the `POST /cases/{id}/confirm` body.
- [ ] `POST /cases/{id}/confirm` responds with HTTP 202 in under 100 milliseconds.
- [ ] Opening `GET /cases/{id}/stream` before calling `/confirm` receives every buffered SSE event in proper sequence.
- [ ] No evaluator identifier (`devils_advocate`, `receipts`, etc.) appears in rendered test runner row names or tooltips.
- [ ] `unresolved` claims render with the purple/indigo badge token, never gray.
- [ ] Clicking any claim row opens the right-hand evidence drawer with the complete 9-level hierarchy.
- [ ] Claims with empty evidence render the explicit placeholder message rather than a blank box.
