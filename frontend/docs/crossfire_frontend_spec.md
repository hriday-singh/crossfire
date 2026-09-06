# Crossfire — Frontend Technical Specification

> **The Definitive Engineering Build Spec for the Frontend**  
> **Sibling Document:** `backend/docs/crossfire_backend_spec.md`  
> **Target Audience:** Frontend Engineers, Backend Integration (Dev C), and AI Pair Programmers.  
> **Status:** Locked & Production-Ready.

---

## 1. Executive Summary & Core Philosophy

Crossfire is not a conversational chatbot, an AI roleplaying council, or a creative writing assistant. **Crossfire is a crash-test rig for high-stakes decisions.**

### 1.1 The CI Dashboard Paradigm
Instead of an AI chat window that flatters the user, Crossfire behaves like a **developer CI/CD test runner** (analogous to GitHub Actions, Vercel deployments, or a terminal test suite):
1. **Inputs a proposal or strategy bet** with optional context.
2. **Extracts foundational assumptions** into distinct, testable claims.
3. **Checkpoint alignment:** User reviews and edits claims before any compute runs.
4. **Stress-tests each claim** against live web evidence, counter-arguments, feasibility constraints, and boundary edge cases.
5. **Surfaces authoritative verdicts** (`survived`, `weakened`, `broken`, `unresolved`) alongside concrete, actionable changes and validation steps.

### 1.2 Non-Negotiable Architectural & UI Rules
1. **Internal Evaluator Name Masking (Zero Leakage):** Internal backend evaluator names (`devils_advocate`, `receipts`, `builder`, `overthinker`) **must never appear anywhere in the UI**, tooltips, or client-facing errors. UI displays test names derived strictly from `TestPlanItem.failure_mode`:
   - `assumption` $\rightarrow$ **Assumption Test**
   - `evidence` $\rightarrow$ **Evidence Test**
   - `feasibility` $\rightarrow$ **Feasibility Test**
   - `edge-case` $\rightarrow$ **Edge-Case Test**
2. **Verdict Color Exclusivity:** The four verdict colors are reserved exclusively for claim and test results. They are never reused for form validation, system alerts, or generic badges.
3. **Unresolved is an Active, Measured Outcome:** The status `unresolved` signifies that the system actively searched and found conflicting, thin, or absent evidence. It is styled in **Violet/Indigo (`#4f46e5`)**—never gray or disabled.
4. **Single-Entry Simplicity:** One primary input: *"What are you considering?"*. Zero mode pickers, tabs, or personas.
5. **Evidence Always Accessible:** Every claim card opens a slide-over Evidence Drawer revealing the complete audit trail and primary source citations.
6. **Restraint Over Spectacle (No 3D):** Clean Light-First Decision Memo aesthetic. High-contrast typography, generous whitespace, fast (<150ms) CSS transitions only. Zero fake telemetry (no glowing live dots, no 3D canvas, no impact meters).

---

## 2. Technology Stack & Directory Architecture

### 2.1 Core Stack
- **Framework:** React 19 + TypeScript (Strict Mode) + Vite
- **Styling:** Tailwind CSS (CSS Variables) + Radix UI Primitives (`shadcn/ui`)
- **Icons:** `lucide-react` (exclusive icon set)
- **Networking:** Native `fetch` + Native `EventSource` (SSE streaming)
- **State Management:** React Context + `useReducer` for deterministic SSE event processing

### 2.2 Directory Layout (`frontend/`)
```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── globals.css                # CSS variables & clean design tokens
│   ├── types/
│   │   └── crossfire.ts           # Strict TypeScript contracts mirroring backend
│   ├── context/
│   │   ├── CaseContext.tsx        # Global active case provider
│   │   └── caseReducer.ts         # SSE event reducer & state transitions
│   ├── hooks/
│   │   ├── useCaseStream.ts       # SSE connection, buffer & listener management
│   │   └── useCaseActions.ts      # API call actions (create, confirm, reload)
│   ├── lib/
│   │   ├── api.ts                 # REST client (POST /cases, POST /confirm, GET /cases)
│   │   ├── formatters.ts          # Test name mapper, status labels, confidence fmt
│   │   └── utils.ts               # clsx / tailwind-merge helper
│   ├── components/
│   │   ├── ui/                    # shadcn / Radix primitives
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── sheet.tsx          # Evidence Drawer primitive
│   │   │   ├── textarea.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── alert.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx         # Clean top bar with wordmark & status text
│   │   │   └── ErrorBanner.tsx    # Pipeline-level alert banner
│   │   ├── screens/
│   │   │   ├── EntryScreen.tsx    # Screen 1: "What are you considering?"
│   │   │   ├── ConfirmScreen.tsx  # Screen 2: Claim Map Review & Edit
│   │   │   └── DashboardScreen.tsx# Screen 3: Unified Decision Memo (Live & Done)
│   │   └── features/
│   │       ├── ClaimCard.tsx      # Readable claim card with verdict & consequence
│   │       ├── VerdictBadge.tsx   # Semantic badge (survived, weakened, broken, unresolved)
│   │       ├── EvidenceDrawer.tsx # Slide-over audit sheet
│   │       └── EvidenceSourceItem.tsx # Clean citation link & snippet
│   └── tests/
│       ├── caseReducer.test.ts
│       ├── useCaseStream.test.ts
│       └── ClaimCard.test.tsx
```

---

## 3. Mirrored Data Contracts & TypeScript Definitions

Located at `frontend/src/types/crossfire.ts`. Strictly adheres to `core/models.py`.

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
  failure_mode: FailureMode | string;
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
  evaluator: string; // Internal only — NEVER render in UI
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
export interface SSETestStartedPayload {
  test_id: string;
  target_claim_id: string;
  evaluator: string; // failure_mode or internal evaluator
}

export interface SSEFindingReadyPayload {
  target_claim_id: string;
  finding: Finding;
}

export interface SSEVerdictReadyPayload {
  claim_id: string;
  status: ClaimStatus;
  verdict_reasoning: string;
}

export interface SSEConsequenceReadyPayload {
  consequence: DecisionConsequence;
}

export interface SSERunCompletePayload {
  case_id: string;
}

export interface SSEErrorPayload {
  stage: string;
  message: string;
}
```

---

## 4. API Transport & Live SSE Streaming Protocol

### 4.1 Integration Sequence & Race-Condition Prevention Rule

```
Browser                          FastAPI Backend (Dev C)
   |                                       |
   | 1. POST /cases                        |
   |-------------------------------------->|
   | 2. 200 OK Case(awaiting_confirmation) |
   |<--------------------------------------|
   |                                       |
   | User confirms claims in Screen 2:     |
   | 3. GET /cases/{id}/stream (SSE)       | (Attaches listener FIRST)
   |-------------------------------------->|
   | 4. POST /cases/{id}/confirm           |
   |-------------------------------------->|
   | 5. 202 Accepted (<50ms)               | (Non-blocking response)
   |<--------------------------------------|
   |                                       | Background: run_pipeline(id)
   | 6. SSE: test_started, finding_ready.. | (Buffered via asyncio.Queue)
   |<......................................|
   | 7. SSE: run_complete                  |
   |<......................................|
```

1. **Attach Stream First:** On clicking "Confirm and run tests", the frontend opens `GET /cases/{id}/stream` before dispatching `POST /cases/{id}/confirm`.
2. **Immediate 202 Accepted:** The backend creates an `asyncio.Task(run_pipeline(id))` and immediately responds with 202. It does not await execution.
3. **Zero Dropped Frames:** `backend/events.py` queues every event. Even with network jitter, all events are streamed in proper sequence.

### 4.2 Endpoint Specifications

#### `POST /cases`
- **Purpose:** Initializes case and triggers claim extraction.
- **Request:** `{ "raw_input": "...", "context": null }`
- **Response (200 OK):** `Case` object with `status: "awaiting_confirmation"`.

#### `GET /cases/{id}/stream`
- **Purpose:** Opens persistent Server-Sent Events channel.
- **Headers:** `Accept: text/event-stream`, `Cache-Control: no-cache`.
- **Frames:** `event: <name>\ndata: <json>\n\n`

#### `POST /cases/{id}/confirm`
- **Purpose:** Submits reviewed claim list and launches evaluation pipeline.
- **Request:** `{ "claims": [{ "id": "c1", "statement": "..." }] }`
- **Response (202 Accepted):** `{ "case_id": "...", "status": "testing", "message": "..." }`

#### `GET /cases/{id}`
- **Purpose:** Snapshot retrieval for cold reload or direct permalink access.
- **Response (200 OK):** Full `Case` object.

---

## 5. Design System Tokens & Visual Consistencies

### 5.1 Color Palette (Clean Light-First, WCAG AA)
The interface uses a clean, breathable light theme with deep slate contrast for effortless reading.

| Token | Hex Value | Semantic Usage |
|---|---|---|
| `--background` | `#fafafa` | Main canvas background (warm off-white) |
| `--card` | `#ffffff` | Cards, memo container, drawer surface |
| `--border` | `#e4e4e7` | Subtle card borders, row separators |
| `--foreground` | `#18181b` | Headlines, claim statements, primary reading text |
| `--muted-foreground` | `#71717a` | Secondary captions, timestamps, queued state, URLs |
| `--primary` | `#18181b` | CTA buttons (`text-white`), active focus rings |

### 5.2 Verdict Visual Tokens (Exclusivity Rule)
Verdict colors are strictly reserved for claim and test results.

| Verdict | Role | Text / Icon Color | Badge Background | Lucide Icon | Meaning |
|---|---|---|---|---|---|
| `survived` | Success | `#059669` (Emerald) | `#ecfdf5` | `circle-check` | Withstood tests and web evidence |
| `weakened` | Caution | `#d97706` (Amber) | `#fffbeb` | `triangle-alert` | Partial validity; assumptions contested |
| `broken` | Destructive | `#e11d48` (Rose) | `#fff1f2` | `circle-x` | Directly refuted by facts/constraints |
| `unresolved` | Uncertainty | `#4f46e5` (Indigo) | `#eef2ff` | `circle-help` | Active outcome: evidence thin/conflicting |

> [!CAUTION]
> **Never render `unresolved` in gray.** Gray indicates inactive/queued elements. `unresolved` is an explicit, measured verdict.

### 5.3 Typography Standards
- **UI & Prose Stack:** System Sans (`Inter`, system-ui, `sans-serif`) with relaxed line-height (`leading-relaxed` / 1.6) for headers, claim statements, and reasoning.
- **Monospace Stack:** System Mono (`JetBrains Mono`, `ui-monospace`, `monospace`) strictly for:
  - Mapped test labels (e.g., `ASSUMPTION TEST`)
  - Case & Claim IDs (`case_1024_abcd`, `c1`)
  - Citation URLs and domains
  - Confidence figures

### 5.4 Test Name Mapping Matrix
Backend evaluator names are masked strictly according to `failure_mode`:

```typescript
export function mapFailureModeToTestName(failureMode: string): string {
  switch (failureMode.toLowerCase()) {
    case "assumption":
      return "Assumption Test";
    case "evidence":
      return "Evidence Test";
    case "feasibility":
    case "constraint":
      return "Feasibility Test";
    case "edge-case":
    case "alternative":
      return "Edge-Case Test";
    default:
      return "Test";
  }
}
```

---

## 6. Screen-by-Screen Implementation Specifications

### Screen 1: Decision Entry View
- **Route / State:** `view == "entry"`, `Case == null`.
- **Layout:** Centered single column (max-width 640px). Minimal "Crossfire" wordmark top-left.
- **Elements:**
  - Label: *"What are you considering?"* (text-xl font-semibold text-zinc-900).
  - Textarea: Auto-growing, min-height 120px, white background, comfortable padding.
  - Primary CTA: *"Test Decision"* button (`bg-zinc-900 text-white`).
- **Loading State:** Upon submit (`POST /cases`), textarea transforms into a 3-bar skeleton loader with caption: *"Extracting core assumptions..."*.

### Screen 2: Claim Alignment View
- **Route / State:** `view == "confirm"`, `Case.status == "awaiting_confirmation"`.
- **Layout:** Centered single column (max-width 720px).
- **Elements:**
  - Header Echo: Paraphrase of user's decision in readable prose to verify understanding.
  - Claim Stack: Clean white cards. Clicking allows inline text edits. Small `(×)` button to delete.
  - Action Link: `"+ Add assumption"` allows adding an assumption.
  - Primary CTA: *"Confirm and test assumptions"* $\rightarrow$ `POST /cases/{id}/confirm`.
- **Constraint:** `load_bearing` flag and `status` badges are **NOT** displayed on this screen.

### Screen 3: Decision Memo & Live Audit (Testing $\rightarrow$ Completed)
- **Route / State:** `view == "dashboard"`, `Case.status == "testing"` or `"done"`.
- **Layout:** Centered container (max-width 840px).
- **Live Summary Bar:**
  - *During testing:* Truthful status: *"Testing 4 claims against web evidence and counterarguments..."*
  - *When done:* Clean summary banner: *"4 claims tested: 1 survived, 1 weakened, 1 broken, 1 unresolved."*
  - *Zero fake telemetry:* No glowing blue "LIVE STREAM" dots, no pulsing radar beacons, no simulated meters.
- **Claim Card Elements:**
  - Load-bearing tag (*"Core foundation"*) rendered when `load_bearing == true`.
  - Full claim statement in large, readable text (`text-lg font-medium text-zinc-900`).
  - Semantic verdict pill badge (`Survived`, `Weakened`, `Broken`, `Unresolved`).
  - Plain-English decision consequence impact excerpt.
  - Primary action: `"View Evidence & Sources →"` button opening the slide-over Evidence Drawer.

### Screen 4: Evidence & Source Audit Drawer
- **Component:** Radix / shadcn `Sheet` slide-over from right edge (480px width, white background, border-l border-zinc-200).
- **Content Hierarchy (Top to Bottom):**
  1. **CLAIM:** Full `Claim.statement` + Verdict Badge.
  2. **WHY IT MATTERS:** Synthesized load-bearing statement (*"Core foundation. If false, the unit economics fail immediately."*).
  3. **TESTS RUN:** Mapped test name pills (e.g., `Evidence Test`, `Feasibility Test`).
  4. **EVIDENCE FOUND:** Clean citation cards:
     - Domain link with clean pill (`target="_blank"`, `rel="noreferrer"`).
     - Source title.
     - Curated excerpt snippet quote.
     - *Fallback:* If evidence is empty, display: *"No public evidence could be retrieved for this claim."*
  5. **CONTRADICTIONS:** Rendered with caution styling only when non-null.
  6. **RECOMMENDED CHANGE:** `DecisionConsequence.recommended_change` in plain English.
  7. **NEXT VALIDATION ACTION:** Smallest concrete verification experiment to perform tomorrow.

---

## 7. State Management & Hook Implementations

### 7.1 Case Reducer (`frontend/src/context/caseReducer.ts`)

```typescript
import { Case, Claim, Finding, DecisionConsequence, ClaimStatus } from "@/types/crossfire";

export type CaseAction =
  | { type: "SET_CASE"; payload: Case }
  | { type: "TEST_STARTED"; payload: { test_id: string; target_claim_id: string } }
  | { type: "FINDING_READY"; payload: { target_claim_id: string; finding: Finding } }
  | { type: "VERDICT_READY"; payload: { claim_id: string; status: ClaimStatus } }
  | { type: "CONSEQUENCE_READY"; payload: { consequence: DecisionConsequence } }
  | { type: "RUN_COMPLETE" }
  | { type: "SET_ERROR"; payload: { stage: string; message: string } };

export interface CaseState {
  caseData: Case | null;
  activeTests: Record<string, "queued" | "running" | "done">;
  error: { stage: string; message: string } | null;
}

export function caseReducer(state: CaseState, action: CaseAction): CaseState {
  switch (action.type) {
    case "SET_CASE":
      return { ...state, caseData: action.payload, error: null };

    case "TEST_STARTED":
      return {
        ...state,
        activeTests: { ...state.activeTests, [action.payload.test_id]: "running" },
      };

    case "FINDING_READY": {
      if (!state.caseData) return state;
      const exists = state.caseData.findings.some(
        (f) => f.test_id === action.payload.finding.test_id
      );
      const findings = exists
        ? state.caseData.findings.map((f) =>
            f.test_id === action.payload.finding.test_id ? action.payload.finding : f
          )
        : [...state.caseData.findings, action.payload.finding];

      return {
        ...state,
        caseData: { ...state.caseData, findings },
        activeTests: { ...state.activeTests, [action.payload.finding.test_id]: "done" },
      };
    }

    case "VERDICT_READY": {
      if (!state.caseData) return state;
      const claims = state.caseData.claims.map((c) =>
        c.id === action.payload.claim_id ? { ...c, status: action.payload.status } : c
      );
      return { ...state, caseData: { ...state.caseData, claims } };
    }

    case "CONSEQUENCE_READY": {
      if (!state.caseData) return state;
      const consequences = [...state.caseData.consequences, action.payload.consequence];
      return { ...state, caseData: { ...state.caseData, consequences } };
    }

    case "RUN_COMPLETE":
      if (!state.caseData) return state;
      return { ...state, caseData: { ...state.caseData, status: "done" } };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    default:
      return state;
  }
}
```

### 7.2 SSE Streaming Hook (`frontend/src/hooks/useCaseStream.ts`)

```typescript
import { useEffect, useState, useRef } from "react";
import { useCase } from "@/context/CaseContext";

export function useCaseStream(caseId: string | null) {
  const { dispatch } = useCase();
  const [isLive, setIsLive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!caseId) return;

    const es = new EventSource(`/cases/${caseId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setIsLive(true);
    es.onerror = () => {
      setIsLive(false);
      // Auto-recovery handled by native EventSource reconnection
    };

    es.addEventListener("test_started", (e) => {
      dispatch({ type: "TEST_STARTED", payload: JSON.parse(e.data) });
    });

    es.addEventListener("finding_ready", (e) => {
      dispatch({ type: "FINDING_READY", payload: JSON.parse(e.data) });
    });

    es.addEventListener("verdict_ready", (e) => {
      dispatch({ type: "VERDICT_READY", payload: JSON.parse(e.data) });
    });

    es.addEventListener("consequence_ready", (e) => {
      dispatch({ type: "CONSEQUENCE_READY", payload: JSON.parse(e.data) });
    });

    es.addEventListener("run_complete", () => {
      dispatch({ type: "RUN_COMPLETE" });
      setIsFinished(true);
      setIsLive(false);
      es.close();
    });

    es.addEventListener("error", (e) => {
      if (e.data) {
        dispatch({ type: "SET_ERROR", payload: JSON.parse(e.data) });
      }
    });

    return () => {
      es.close();
    };
  }, [caseId, dispatch]);

  return { isLive, isFinished };
}
```

---

## 8. Verification Checklist & Definition of Done

Prior to marking frontend components or full integration complete:

- [ ] **Contract Integrity:** `frontend/src/types/crossfire.ts` exactly mirrors `backend/core/models.py`.
- [ ] **Zero Evaluator Name Leakage:** No instance of `devils_advocate`, `receipts`, `builder`, or `overthinker` rendered anywhere in UI or tooltips.
- [ ] **Unresolved Visual Distinction:** `unresolved` claims render with `#a78bfa` (Violet) badge and `circle-help` icon, never muted gray.
- [ ] **Race Condition Prevented:** SSE connection attaches before `POST /cases/{id}/confirm` is dispatched.
- [ ] **Non-Blocking Confirm:** `POST /confirm` returns 202 Accepted in <100ms.
- [ ] **Impact Meter Representation:** 3-bar intensity meter correctly reflects `high`, `medium`, or `low`.
- [ ] **Audit Drawer Completeness:** All 9 hierarchy levels render; missing evidence displays the explicit empty fallback string.
- [ ] **Restrained Motion:** Opacity cross-fades only; zero 3D components or unapproved animations.
- [ ] **Responsive & Accessible:** Keyboard navigable with visible focus rings and WCAG AA contrast against `#09090b`.
