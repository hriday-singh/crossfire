# Crossfire — UI/UX Design System & Screen Specification

> **Target Audience:** Frontend Developers, UI Engineers, and AI Pair Programmers.  
> **Purpose:** Single source of truth for design tokens, visual consistency, component primitives, layout structure, and view specifications across all Crossfire screens.  
> **Status:** Grounded strictly on the active, working backend API (`POST /cases`, `POST /cases/{id}/confirm`, `GET /cases/{id}/stream`, `GET /cases/{id}`).

---

## 1. Product & UI Philosophy

Crossfire is an **authoritative decision testing memo**, not an AI chatbot, a simulated hacker terminal, or an arcade dashboard. 

### Core UI Principles:
1. **The Executive Decision Memo:** Think Linear, Stripe, or Notion for decision testing. Crisp typography, generous whitespace, and absolute legibility.
2. **Zero Fake Telemetry:** No glowing blue "LIVE STREAM" dots, no radar beacons, no simulated counters, and no unbuilt widgets (e.g. model dropdowns, fake dropzones, impact meters).
3. **Internal Evaluator Name Masking (Mandatory Rule):** Internal backend agent names (`devils_advocate`, `receipts`, `builder`, `overthinker`) **must never appear anywhere in the UI**. They are strictly mapped to test names derived from failure modes:
   - `assumption` $\rightarrow$ **Assumption Test**
   - `evidence` $\rightarrow$ **Evidence Test**
   - `feasibility` $\rightarrow$ **Feasibility Test**
   - `edge-case` $\rightarrow$ **Edge-Case Test**
4. **Color Carries Verdict, Nothing Else:** The four verdict colors are reserved exclusively for claim and test results. Never use red or amber for regular form validation or general badges.
5. **Unresolved is a Measured Outcome:** The status `unresolved` means the system actively investigated and found conflicting or thin evidence. It is styled in **Violet/Indigo (`#4f46e5`)**—never gray or disabled.
6. **One Input, Zero Mode Menus:** The entry view has exactly one primary question: *"What are you considering?"*. No tabs, no mode selectors.
7. **Evidence Always One Click Away:** Every claim card opens a dedicated slide-over sheet (Drawer) revealing the full audit trail and primary source citations.

---

## 2. Design System Tokens & Consistencies

### 2.1 Color Palette (Clean Light-First, WCAG AA)
The interface uses a clean, breathable light theme with deep slate contrast for effortless reading.

| Token | CSS Variable / Tailwind | Hex Value | Semantic Usage |
|---|---|---|---|
| **Background** | `--background` / `bg-zinc-50` | `#fafafa` | Page root canvas (warm off-white) |
| **Card / Surface** | `--card` / `bg-white` | `#ffffff` | Cards, memo container, drawer surface |
| **Border / Divider** | `--border` / `border-zinc-200` | `#e4e4e7` | Card borders, dividers, subtle row separators |
| **Primary Text** | `--foreground` / `text-zinc-900` | `#18181b` | Headlines, claim statements, primary body text |
| **Secondary Text** | `--muted-foreground` / `text-zinc-500` | `#71717a` | Captions, metadata, confidence values, queued state |
| **Primary / Action** | `--primary` / `bg-zinc-900` | `#18181b` | Primary action buttons (`text-white`), focus rings |
| **Primary Foreground** | `--primary-foreground` | `#ffffff` | Text on primary buttons |

### 2.2 Verdict Colors (Strict Exclusivity)
*These colors are strictly reserved for claim verdicts and test outcomes.*

| Verdict | Semantic Role | Text / Icon Color | Badge Background | Lucide Icon | Visual Meaning |
|---|---|---|---|---|---|
| `survived` | Success | `#059669` (Emerald) | `#ecfdf5` | `circle-check` | Claim withstood tests & scrutiny |
| `weakened` | Caution | `#d97706` (Amber) | `#fffbeb` | `triangle-alert` | Still standing, but damaged or disputed |
| `broken` | Destructive | `#e11d48` (Rose) | `#fff1f2` | `circle-x` | Critical assumption invalidated by evidence |
| `unresolved` | Measured Uncertainty | `#4f46e5` (Indigo) | `#eef2ff` | `circle-help` | Active outcome: evidence was thin or conflicting |

> [!CAUTION]
> Do NOT use gray for `unresolved`. Gray is reserved exclusively for inactive or queued UI elements. Reusing gray undermines the core principle that `unresolved` is an active, measured finding.

### 2.3 Typography
* **UI & Body Stack:** `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  * Applied to: Headlines, prompts, claim statements, descriptions, recommendations, and source snippets.
  * Line height is generous (`leading-relaxed` / 1.6) to guarantee reading comfort.
* **Monospace Stack:** `ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace`
  * Narrowly reserved for: Test type labels (e.g. `EVIDENCE TEST`), Case IDs, and source URLs.

### 2.4 Spacing, Radii & Elevation
* **Base Grid:** 8px spacing cadence (`gap-2`, `gap-4`, `gap-6`, `p-4`, `p-6`, `p-8`).
* **Corner Radii:**
  * Cards / Drawers: `8px` (`rounded-lg`)
  * Buttons / Inputs: `6px` (`rounded-md`)
  * Badges / Tags: `9999px` (`rounded-full`)
* **Shadows:** Soft, subtle elevation (`shadow-sm`, `shadow` using soft neutral values). No bright glows or saturated dropshadows.
* **Transitions:** 150ms ease-out on background and opacity. Fast, functional, and smooth.

---

## 3. UI Component Inventory (Radix / shadcn/ui Mapping)

| UI Element | Base Primitive | Custom Styling / Behavior |
|---|---|---|
| **Entry Textarea** | `Textarea` (shadcn) | Auto-expanding, min-height 120px, white background, border `#e4e4e7`, focus ring `#18181b` |
| **Primary CTA** | `Button` (shadcn) | Background `#18181b`, text `#ffffff`, hover opacity-90, font-medium, rounded-md |
| **Claim Card** | `Card` (shadcn) | `#ffffff` background, 1px border `#e4e4e7`, hover border-zinc-300, cursor-pointer |
| **Verdict Badge** | `Badge` (shadcn) | Rounded-full pill, tint background + semantic text color + matching Lucide icon |
| **Load-Bearing Flag** | `Badge` (shadcn) | Muted neutral pill (`bg-zinc-100 text-zinc-700`), text: *"Core foundation"* |
| **Evidence Drawer** | `Sheet` (shadcn) | Right slide-over, 480px width, white background, border-l `#e4e4e7`, generous padding |
| **Status Bar** | `div` | Clean single-line header summary displaying progress or final counts |
| **Error Banner** | `Alert` (shadcn) | Soft rose background (`bg-rose-50`), border `#fecdd3`, dark red text (`#9f1239`) |

---

## 4. Per-Screen Specifications

### Screen 1: Decision Entry View

#### Purpose:
The distraction-free starting point. Accepts the user's proposal or strategy dilemma. Strictly one input, zero distractions.

#### Layout Skeleton:
- **Header:** Clean `"Crossfire"` wordmark at top-left.
- **Main Canvas:** Centered column, max-width `640px`, generous top margin.
- **Form Elements:**
  - Label: `"What are you considering?"` (20px, font-semibold, `text-zinc-900`).
  - Textarea: Auto-growing, ~120px height, white background, border `#e4e4e7`, comfortable padding.
  - Action Row: Right-aligned primary button: `"Test Decision"` (`bg-zinc-900 text-white font-medium`).
- **Loading State:** On submission (`POST /cases`), swaps textarea to 3 soft pulsing skeleton lines with caption: *"Extracting core assumptions..."*.

### Screen 2: Claim Alignment View

#### Purpose:
The critical alignment gate (`Case.status == "awaiting_confirmation"`). Displays the extracted assumptions before any tests or searches run, allowing the user to verify, edit, or remove claims.

#### Layout Skeleton:
- **Placement:** Single column, max-width `720px`, centered.
- **Header:**
  - Subtitle: `"Review assumptions before testing:"` in `text-zinc-500`.
  - Echo: User's decision statement in `text-zinc-900 font-medium`.
- **Claim Stack:** Vertical stack of white cards (`#ffffff`, border `#e4e4e7`, p-4, rounded-lg).
  - Left: Claim statement text.
  - Right: Clean `×` delete button (`text-zinc-400`, hover `text-rose-600`).
  - Interaction: Clicking card allows inline text editing.
- Right: Badge with circle-help icon "Unresolved" in violet #a78bfa, confidence "0.40".
- Bottom: 3 of 3 bars (High Impact) + "FEASIBILITY TEST" + excerpt: "No public format standard; technical spike needed."

Card 4 (Survived, Non-load-bearing):
- Left: No flag icon. "The onboarding screen should use a dark theme."
- Right: Badge with circle-check icon "Survived" in emerald #34d399, confidence "0.90".
- Bottom: 1 of 3 bars (Low Impact) + "ASSUMPTION TEST" + excerpt: "Survives basic scrutiny."

Design: Dense, scannable, authoritative. Looks like a crash-test safety rating card set.
```

---

### Screen 5: Evidence & Audit Slide-Over Drawer (Sheet)

#### Screen Purpose:
The complete transparency layer. Slides over from the right viewport edge when a claim card is clicked, presenting the end-to-end chain from claim to concrete real-world next step.

#### Layout Skeleton:
- **Panel Specs:** 460px width, right-anchored, full viewport height, background `#18181b`, left border `#27272a`, internal vertical scrolling.
- **Header:** Close `(x)` top-right, followed by Section Header `CLAIM` in uppercase monospace (`text-xs text-zinc-400`).
- **Content Flow (Top to Bottom with 24px Spacing):**
  1. `CLAIM`: Full statement.
  2. `WHY IT MATTERS`: Rationale sentence explaining load-bearing status.
  3. `TESTS RUN`: Monospace badges for tests executed (e.g. `[Evidence Test]`).
  4. `EVIDENCE FOUND`: Curated source cards with clickable URL title (`text-blue-400`), retrieval timestamp, and exact snippet. If empty, explicit callout: *"No public evidence could be retrieved."*
  5. `CONTRADICTIONS`: Nuances pushing the other way.
  6. `STATUS`: Reconciled verdict badge repeated.
  7. `DECISION IMPACT`: 3-segment meter (High / Medium / Low).
  8. `WHAT CHANGES`: Specific recommended modification to the user's strategy.
  9. `NEXT VALIDATION`: The concrete smallest experiment to perform tomorrow.

#### Evidence Drawer Hierarchy (Top to Bottom):
1. **Header & Verdict:**
   - Section label: `"AUDIT TRAIL & EVIDENCE"` (text-xs font-mono text-zinc-400).
   - Claim statement (`text-base font-semibold text-zinc-900 mt-1`).
   - Reconciled Verdict Badge (`Survived`, `Weakened`, `Broken`, `Unresolved`).
2. **Why It Matters:**
   - Plain-English sentence on why this assumption is load-bearing: *"Core foundation. If false, the unit economics of the decision collapse."*
3. **Tests Executed:**
   - Clean test label pills: `[ EVIDENCE TEST ]`, `[ FEASIBILITY TEST ]`.
4. **Primary Source Citations (`EvidenceItem`):**
   - Clean citation card (`bg-zinc-50 border border-zinc-200 rounded-md p-4`):
     - Clickable primary source URL with clean domain label (`text-xs font-mono text-zinc-600 hover:underline`).
     - Article / document title (`text-sm font-medium text-zinc-900`).
     - Curated quote snippet (`text-sm text-zinc-600 leading-relaxed mt-1`).
   - *Honest Empty State:* If no public evidence was indexed by Tavily/Scrapling: *"No public evidence could be retrieved for this claim"*.
5. **Contradictions Surfaced:**
   - Subtle alert box highlighting counter-evidence or conflicting market facts found during evaluation.
6. **Recommended Plan Adjustment:**
   - Actionable, direct advice: *"Differentiate on manual review instead of claiming full autonomy."*
7. **Next Validation Step:**
   - One concrete real-world test to perform: *"Interview 5 target customers on willingness to delegate."*

---

### Screen 5: Error Handling & Degradation

#### Purpose:
Clear, honest, non-destructive error states matching the backend's `error` SSE event (`{"stage": "...", "message": "..."}`).

#### Specifications:
1. **Pipeline-Level Error:**
   - Soft red banner (`bg-rose-50 border border-rose-200 rounded-md p-4 flex items-center justify-between`).
   - Plain English description (e.g. *"Unable to extract assumptions due to a connection timeout"*), with a *"Retry"* button.
2. **Test-Level Error:**
   - If an individual test or search query fails, that specific test row indicates: *"Test timed out. Claim marked unresolved due to absent evidence."*
   - Other claims continue testing normally without blocking the pipeline.

---

## 5. Final Design Verification Checklist

- [x] **Light-First Readability:** Warm off-white background (`#fafafa`), crisp white cards (`#ffffff`), and deep slate text (`#18181b`) with generous line-height (`1.6`).
- [x] **Zero Fake Telemetry:** No glowing blue "LIVE STREAM" dots, no pulsing radar beacons, no 3-segment impact meters, and no unbuilt provider modals or dropzones.
- [x] **Strict 4-Color Verdicts:** Emerald (`survived`), Amber (`weakened`), Rose (`broken`), Indigo (`unresolved`). Never gray or disabled.
- [x] **Evaluator Masking:** Internal agent names (`devils_advocate`, `receipts`, `builder`) are strictly mapped to human test names (*Assumption Test*, *Evidence Test*, *Feasibility Test*).
- [x] **Real Backend Contracts:** Aligns 1:1 with `POST /cases`, `POST /cases/{id}/confirm`, `GET /cases/{id}/stream`, and `GET /cases/{id}`.
- [x] **Responsive & Accessible:** Clean, single-column reading layouts with full keyboard accessibility and WCAG AA contrast.

