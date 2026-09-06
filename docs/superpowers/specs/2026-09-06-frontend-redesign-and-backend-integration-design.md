# Crossfire — Frontend Redesign & Real Backend Integration Design Specification

- **Date:** 2026-09-06
- **Status:** Approved
- **Author:** Dev A

---

## 1. Executive Summary & Philosophy

Crossfire is an authoritative decision testing memo, designed to stress-test business propositions, technical bets, and strategic assumptions against live web evidence and adversarial analysis.

This specification redesigns the frontend to:
1. Rebuild the UI using accessible Radix UI primitives and a cohesive dark-mode design system.
2. Strip out all mock data, simulated timeouts, and fake telemetry (`LiveDot`, `DebugDock`, `SettingsModal`, `RealityCheckModal`).
3. Connect cleanly and reliably to the real FastAPI backend (`POST /cases`, `POST /cases/{id}/confirm`, `GET /cases/{id}/stream`, and `GET /cases/{id}`), preventing race conditions on SSE stream attachment.
4. Mask all internal evaluator names into human test names (`Assumption Test`, `Evidence Test`, `Feasibility Test`, `Edge-Case Test`).
5. Guarantee WCAG AA accessibility, strict 4-verdict color exclusivity, and full test suite coverage (`npm run test:all`).

---

## 2. Design Tokens & UI Primitives

### 2.1 Color Tokens (Dark Theme Base)

| Token | CSS Variable | Value | Role |
|---|---|---|---|
| Background | `--background` | `#09090b` (Zinc 950) | Page canvas |
| Surface / Card | `--card` | `#141417` | Card surfaces & slide-over sheet |
| Surface Border | `--border` | `#27272a` (Zinc 800) | Card borders, dividers |
| Primary Text | `--foreground` | `#f4f4f5` (Zinc 100) | High-contrast headlines & statements |
| Muted Text | `--muted-foreground` | `#a1a1aa` (Zinc 400) | Supporting labels, confidence numbers |
| Action Button | `--primary` | `#fafafa` | Primary action background with `#09090b` text |
| Subordinate Surface | `--secondary` | `#27272a` | Secondary buttons and badges |

### 2.2 Verdict Colors (Strict Exclusivity)
*These colors are strictly reserved for verdicts and test outcomes. Never used for form inputs or general badges.*

| Verdict | Color Token | Hex | Badge Background | Lucide Icon | Meaning |
|---|---|---|---|---|---|
| `survived` | `text-emerald-400` | `#34d399` | `bg-emerald-950/40 border-emerald-500/30` | `CircleCheck` | Validated by evidence & tests |
| `weakened` | `text-amber-400` | `#fbbf24` | `bg-amber-950/40 border-amber-500/30` | `TriangleAlert` | Partially valid; contested |
| `broken` | `text-rose-400` | `#f43f5e` | `bg-rose-950/40 border-rose-500/30` | `CircleX` | Refuted or failed feasibility |
| `unresolved` | `text-indigo-400` | `#818cf8` | `bg-indigo-950/40 border-indigo-500/30` | `CircleHelp` | Insufficient / conflicting evidence (never gray) |

### 2.3 UI Primitives
* **Sheet (`@radix-ui/react-dialog`)**: Right-anchored slide-over sheet (480px) for the Evidence Drawer.
* **Textarea**: Auto-expanding textarea with focus ring and comfortable padding.
* **Button**: Accessible button variants (`default`, `ghost`, `secondary`, `destructive`).
* **Badge**: Pill badges for verdicts, load-bearing flags, and test tags.
* **Alert**: Pipeline error and test-level warning banners.
* **Skeleton**: Soft pulsing skeleton lines during claim extraction.

---

## 3. Screen Specifications & User Flow

### Screen 1: Decision Entry View (`POST /cases`)
* **Prompt**: *"What are you considering?"*
* **Textarea**: Multi-line auto-expanding input for user's proposal or idea.
* **Test Decision Pills**: 3 subtle 1-click preset pills for quick testing convenience.
* **Primary Action**: Single high-contrast button: `"Test Decision"`.
* **Loading State**: Disables input, renders 3 soft pulsing skeleton lines with caption: *"Extracting core assumptions..."*.

### Screen 2: Claim Alignment View (`Case.status == "awaiting_confirmation"`)
* **Header**: Echoes the user's decision statement.
* **Claim Stack**: Stack of cards representing extracted assumptions.
  * Inline editing of statement text.
  * Delete `(×)` button.
  * `"+ Add assumption"` affordance for missing claims.
* **Primary Action**: `"Confirm and run tests"`.

### Screen 3: Decision Memo & Live Audit (`GET /cases/{id}/stream` -> `Case.status == "done"`)
* **Status Bar**:
  * *During testing*: *"Testing N claims against web evidence and counterarguments..."*
  * *When complete*: *"N of M claims tested: X survived, Y weakened, Z broken, W unresolved."*
* **Filter Pills**: All Claims / Load-Bearing Only / Verdict filters.
* **Claim Cards**:
  * Load-bearing badge: *"Core foundation"* if `load_bearing == true`.
  * Statement text.
  * Verdict badge (Strict 4-color palette).
  * Running test progress rows (when active).
  * Consequence summary and `"View Evidence & Sources →"` trigger.
* **Slide-Over Evidence Drawer (`Sheet`)**:
  * Claim statement.
  * Plain-language explanation of why it matters.
  * Verdict and adjudication reasoning.
  * Tests run (formatted with masked names).
  * Evidence citations: Title, source URL with external link icon, curated snippet, retrieval date.
  * Contradictions and counter-evidence.
  * Recommended change to strategy.
  * Next concrete validation experiment.

---

## 4. API Transport & Streaming Integration

### Race-Condition Safe Confirm Flow
1. User clicks `"Confirm and run tests"` on Screen 2.
2. Frontend opens `EventSource` to `GET /cases/{id}/stream` FIRST.
3. Backend attaches an `asyncio.Queue` to that `case_id`.
4. Frontend dispatches `POST /cases/{id}/confirm` to the backend.
5. Backend spawns the pipeline in the background and responds `202 Accepted` immediately.
6. The SSE stream yields events into the frontend reducer without dropping any frames.

### Event Handling in Reducer
* `claim_map_ready`: Populates initial claims list.
* `test_started`: Marks test as running for the target claim.
* `finding_ready`: Appends finding, evidence items, and confidence.
* `verdict_ready`: Updates claim verdict to `survived | weakened | broken | unresolved`.
* `consequence_ready`: Attaches decision impact, recommended change, and next validation.
* `run_complete`: Closes EventSource cleanly, marks case status as `done`.
* `error`: Displays non-destructive pipeline error banner or localized test warning.

---

## 5. Deprecations & Cleanups

* **Remove**:
  * `components/features/LiveDot.tsx`
  * `components/features/SettingsModal.tsx`
  * `components/features/ImpactMeter.tsx`
  * `components/layout/DebugDock.tsx`
  * `components/screens/RealityCheckModal.tsx`
  * Mock timeout simulation logic in `context/CaseContext.tsx` and `hooks/useCaseStream.ts`
* **Clean up Tests**:
  * Remove `SettingsModal.test.tsx` and `LiveDot.test.tsx`.
  * Update `CaseContext.test.tsx`, `Header.test.tsx`, `EvidenceDrawer.test.tsx`, `ClaimCard.test.tsx`, and screen tests to test real component behaviors.
