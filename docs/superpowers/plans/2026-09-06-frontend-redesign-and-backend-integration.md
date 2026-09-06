# Frontend Redesign & Real Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely replace the mock/terminal UI with an authoritative, production-grade dark theme interface built on Radix UI primitives and directly integrated with the live FastAPI backend.

**Architecture:** A single-store React context architecture (`CaseContext` + `caseReducer`) managing a 3-screen pipeline (`EntryScreen` -> `ConfirmScreen` -> `DashboardScreen`), backed by a race-condition-safe SSE streaming hook (`useCaseStream`) connected to FastAPI `/cases/{id}/stream`. All presentation adheres to strict 4-color verdict tokens, masked evaluator test names, and zero fake telemetry.

**Tech Stack:** React 19, TypeScript (strict mode), Tailwind CSS, `@radix-ui/react-dialog`, Lucide React icons, Vitest, `@testing-library/react`.

**Spec:** [docs/superpowers/specs/2026-09-06-frontend-redesign-and-backend-integration-design.md](file:///C:/Users/clash/OneDrive/Desktop/Codes/Web%20apps/crossfire/docs/superpowers/specs/2026-09-06-frontend-redesign-and-backend-integration-design.md)

---

## Global Constraints

- **No Fake Telemetry:** Eliminate glowing `LiveDot`, fake model selectors (`SettingsModal`), fake `RealityCheckModal`, speed multipliers, and simulated timers.
- **No Mock Interception:** Disable mock mode by default in `CaseContext`; make calls directly to the FastAPI endpoints (`/cases`, `/cases/{id}/confirm`, `/cases/{id}/stream`, `/cases/{id}`).
- **Evaluator Name Masking:** Internal backend agent names (`devils_advocate`, `receipts`, `builder`, `overthinker`) must NEVER appear in the UI. Map strictly to:
  - `assumption` -> **Assumption Test**
  - `evidence` -> **Evidence Test**
  - `feasibility` -> **Feasibility Test**
  - `edge-case` -> **Edge-Case Test**
- **Strict 4-Verdict Colors:**
  - `survived`: Emerald (`#34d399`, `CircleCheck`)
  - `weakened`: Amber (`#fbbf24`, `TriangleAlert`)
  - `broken`: Rose (`#f43f5e`, `CircleX`)
  - `unresolved`: Indigo (`#818cf8`, `CircleHelp`) — NEVER gray or disabled.
- **Race Condition Prevention:** Connect EventSource to `GET /cases/{id}/stream` BEFORE firing `POST /cases/{id}/confirm`.
- **Quality & Testing:** Run `npm run test:all` (`tsc --noEmit && vitest run`) and verify 100% pass rate.
- **Rules Precedence:** Never commit code to git (user commits manually).

---

## User Review Required

> [!IMPORTANT]
> - Obsolete components (`SettingsModal.tsx`, `LiveDot.tsx`, `DebugDock.tsx`, `RealityCheckModal.tsx`) and their failing tests (`SettingsModal.test.tsx`, `LiveDot.test.tsx`) will be safely removed.
> - The mock mode toggle is removed from the Header, defaulting the app directly to live backend communication via Vite proxy (`http://localhost:8000`).

---

## Proposed Changes

### 1. Design Tokens & Styling Primitives

#### [MODIFY] `frontend/src/globals.css`
- Refactor CSS variables for dark mode base:
  - `--background: #09090b`
  - `--foreground: #f4f4f5`
  - `--card: #141417`
  - `--card-foreground: #f4f4f5`
  - `--border: #27272a`
  - `--primary: #fafafa`
  - `--primary-foreground: #09090b`
  - `--muted: #18181b`
  - `--muted-foreground: #a1a1aa`
  - Verdict variables: `--verdict-survived`, `--verdict-weakened`, `--verdict-broken`, `--verdict-unresolved`.

#### [MODIFY] `frontend/tailwind.config.js`
- Ensure color tokens and verdict classes are mapped cleanly to CSS variables.

#### [MODIFY] `frontend/src/components/ui/sheet.tsx`
- Ensure `@radix-ui/react-dialog` primitives are cleanly styled for slide-over drawer behavior without background bleed.

---

### 2. State Management & Real SSE Transport

#### [MODIFY] `frontend/src/context/caseReducer.ts`
- Remove mock-simulation action types (`TOGGLE_MOCK_MODE`, `SET_PLAYBACK_SPEED`).
- Ensure actions for:
  - `START_EXTRACTING` / `EXTRACTING_SUCCESS` / `EXTRACTING_ERROR`
  - `START_CONFIRMING` / `CONFIRMING_SUCCESS`
  - `SET_STREAMING`
  - `SSE_EVENT` (handles `claim_map_ready`, `test_started`, `finding_ready`, `verdict_ready`, `consequence_ready`, `run_complete`, `error`)
  - `SELECT_CLAIM`
  - `UPDATE_CLAIM_STATEMENT` / `REMOVE_CLAIM` / `ADD_CLAIM`
  - `RESET_CASE`

#### [MODIFY] `frontend/src/context/CaseContext.tsx`
- Default `isMockMode: false`. Remove the `setTimeout` mock simulation interceptor in `startExtracting` and `confirmAndRun`.
- In `confirmAndRun`:
  - Dispatch streaming state first so `useCaseStream` initiates the SSE EventSource connection.
  - Then call `confirmCase(state.currentCase.id, state.currentCase.claims)`.

#### [MODIFY] `frontend/src/hooks/useCaseStream.ts`
- Remove simulated timeout loops (`MOCK_STREAM_STEPS`).
- Connect directly to `getStreamUrl(state.currentCase.id)`.
- Listen to SSE event types: `claim_map_ready`, `test_started`, `finding_ready`, `verdict_ready`, `consequence_ready`, `run_complete`, `error`.
- Close EventSource on `run_complete` or error.

---

### 3. Screen & Component Architecture

#### [MODIFY] `frontend/src/components/layout/Header.tsx`
- Minimalist executive header:
  - Brand: `Crossfire` wordmark.
  - Connection indicator: shows "Connected to Backend" / "Testing in progress".
  - "New Decision" CTA button when not on entry screen.
  - Remove `LiveDot`, `SettingsModal` trigger, `RealityCheck` trigger, and `DebugDock` terminal button.

#### [MODIFY] `frontend/src/components/screens/EntryScreen.tsx`
- Clean hero: *"What are you considering?"*.
- Auto-growing textarea with comfortable padding.
- 3 clean 1-click test decision pills for fast manual testing.
- Single `"Test Decision"` primary CTA.
- Loading state: 3 soft pulsing skeleton lines with caption *"Extracting core assumptions..."*.

#### [MODIFY] `frontend/src/components/screens/ConfirmScreen.tsx`
- Echoes the user's decision statement.
- Stack of extracted assumption cards:
  - Clicking allows inline text editing.
  - Delete `(×)` button.
  - `"+ Add assumption"` inline button.
- Primary CTA: `"Confirm and run tests"`.

#### [MODIFY] `frontend/src/components/screens/DashboardScreen.tsx`
- Top summary banner:
  - During testing: *"Testing N claims against web evidence and counterarguments..."*
  - When complete: *"N of M claims tested: X survived, Y weakened, Z broken, W unresolved."*
- Filter pills: All Claims / Load-Bearing Only / Verdict filters.
- Renders list of `ClaimCard`s.
- Embeds `EvidenceDrawer`.

#### [MODIFY] `frontend/src/components/features/ClaimCard.tsx`
- Statement text.
- Load-bearing pill: *"Core foundation"* with anchor icon.
- Verdict badge: Emerald (`survived`), Amber (`weakened`), Rose (`broken`), Indigo (`unresolved`).
- Active test progress rows via `TestRow.tsx`.
- Consequence summary and `"View Evidence & Sources →"` trigger to open `EvidenceDrawer`.

#### [MODIFY] `frontend/src/components/features/TestRow.tsx`
- Evaluator name masking: strictly maps `failure_mode` to human test names.

#### [MODIFY] `frontend/src/components/features/EvidenceDrawer.tsx`
- Right slide-over Radix `Sheet`.
- Hierarchy:
  1. Full Claim statement.
  2. Why it matters (plain-English load-bearing explanation).
  3. Verdict & adjudication reasoning.
  4. Tests run (masked names).
  5. Citations (`EvidenceItem` list: title, clickable source URL, quote snippet, date).
  6. Contradictions surfaced.
  7. Recommended strategic change.
  8. Next concrete validation experiment.

#### [MODIFY] `frontend/src/App.tsx`
- Clean root container:
  - `Header`
  - `ErrorBanner`
  - Active screen view (`EntryScreen` | `ConfirmScreen` | `DashboardScreen`)
  - No fake modal overlays or floating terminal docks.

#### [DELETE] Unneeded files
- `frontend/src/components/features/LiveDot.tsx`
- `frontend/src/components/features/SettingsModal.tsx`
- `frontend/src/components/features/ImpactMeter.tsx`
- `frontend/src/components/screens/RealityCheckModal.tsx`
- `frontend/src/components/layout/DebugDock.tsx`

---

### 4. Verification & Testing

#### [DELETE] Obsolete test files
- `frontend/src/tests/SettingsModal.test.tsx`
- `frontend/src/tests/LiveDot.test.tsx`
- `frontend/src/tests/ImpactMeter.test.tsx`

#### [MODIFY / NEW] Updated test suites
- `frontend/src/tests/CaseContext.test.tsx`: Tests real API dispatching, preset loading, and state management.
- `frontend/src/tests/caseReducer.test.ts`: Covers all SSE events, claim edits, and status transitions.
- `frontend/src/tests/useCaseStream.test.ts`: Verifies real EventSource listeners and clean teardown.
- `frontend/src/tests/Header.test.tsx`: Tests branding, connection state, and reset CTA.
- `frontend/src/tests/screens.test.tsx`: Tests `EntryScreen`, `ConfirmScreen`, and `DashboardScreen` flows.
- `frontend/src/tests/EvidenceDrawer.test.tsx`: Tests citations, drawer opening/closing, and masked test names.
- `frontend/src/tests/ClaimCard.test.tsx`: Tests verdict rendering, load-bearing flag, and drawer opening.

---

## Verification Plan

### Automated Tests
```bash
# In frontend/
npm run test:all
```
Verification criteria:
1. `tsc --noEmit` passes with 0 TypeScript errors.
2. `vitest run` executes all test suites with 100% passing rate.

### Manual Verification
1. Start backend: `uvicorn main:app --reload --port 8000` from `backend/`.
2. Start frontend: `npm run dev` from `frontend/`.
3. Submit a decision on `EntryScreen` (or click a sample test pill).
4. Verify extraction skeleton and smooth transition to `ConfirmScreen`.
5. Edit a claim statement, delete an assumption, and add a new one.
6. Click `"Confirm and run tests"` and verify:
   - EventSource connects without race conditions.
   - Tests run in real time with masked test names.
   - Verdicts update to Emerald, Amber, Rose, or Indigo.
7. Click a claim card to open the slide-over `EvidenceDrawer`. Inspect primary source links, citations, and recommended changes.
