# Crossfire — UI/UX Design System & Screen Specification

> **Target Audience:** Frontend Developers, UI Engineers, and AI Pair Programmers.  
> **Purpose:** Single source of truth for design tokens, visual consistency, component primitives, layout structure, and view specifications across all Crossfire screens.  
> **Status:** Grounded strictly on the active, working backend API (`POST /cases`, `POST /cases/{id}/confirm`, `GET /cases/{id}/stream`, `GET /cases/{id}`).

---

## 1. Product & UI Philosophy

Crossfire is an **authoritative decision testing memo**, not an AI chatbot, a simulated hacker terminal, or an arcade dashboard. 

### Core UI Principles:
1. **The Executive Decision Memo in Dark Mode:** A sleek, high-contrast dark theme designed for deep focus. Deep zinc canvas (`#09090b`), elevated card surfaces (`#18181b`), crisp readable typography (`#f4f4f5`), and generous whitespace.
2. **Zero Fake Telemetry:** No glowing blue "LIVE STREAM" dots, no radar beacons, no simulated counters, and no unbuilt widgets (e.g. model dropdowns, fake dropzones, 3-segment impact meters).
3. **Internal Evaluator Name Masking (Mandatory Rule):** Internal backend agent names (`devils_advocate`, `receipts`, `builder`, `operator`) **must never appear anywhere in the UI**. They are strictly mapped to test names derived from failure modes:
   - `assumption` $\rightarrow$ **Assumption Test**
   - `evidence` $\rightarrow$ **Evidence Test**
   - `feasibility` $\rightarrow$ **Feasibility Test**
   - `operational_friction` (or `adoption`, `bureaucracy`) $\rightarrow$ **Operational Friction Test**
4. **Color Carries Verdict, Nothing Else:** The four verdict colors are reserved exclusively for claim and test results. Never use red or amber for regular form validation or general badges.
5. **Unresolved is a Measured Outcome:** The status `unresolved` means the system actively investigated and found conflicting or thin evidence. It is styled in **Indigo / Violet (`#818cf8`)**—never gray or disabled.
6. **One Input, Zero Mode Menus:** The entry view has exactly one primary question: *"What are you considering?"*. No tabs, no mode selectors.
7. **Evidence Always One Click Away:** Every claim card opens a dedicated slide-over sheet (Evidence Drawer) revealing the full audit trail and primary source citations.

---

## 2. Design System Tokens & Consistencies

### 2.1 Color Palette (Dark-First, WCAG AA / AAA)
The interface uses a deep neutral palette engineered for readability, zero glare, and high contrast.

| Token | CSS Variable / Tailwind | Hex Value | Semantic Usage |
|---|---|---|---|
| **Background** | `--background` / `bg-zinc-950` | `#09090b` | Page root canvas (deep zinc) |
| **Card / Surface** | `--card` / `bg-zinc-900` | `#18181b` | Cards, memo container, drawer surface |
| **Border / Divider** | `--border` / `border-zinc-800` | `#27272a` | Card borders, dividers, subtle row separators |
| **Primary Text** | `--foreground` / `text-zinc-100` | `#f4f4f5` | Headlines, claim statements, primary body text |
| **Secondary Text** | `--muted-foreground` / `text-zinc-400` | `#a1a1aa` | Captions, metadata, confidence values, queued state |
| **Primary / Action** | `--primary` / `bg-white` | `#ffffff` | Primary action buttons (`text-zinc-950 font-medium`), focus rings |
| **Primary Foreground** | `--primary-foreground` | `#09090b` | Text on primary buttons |

### 2.2 Verdict Colors in Dark Mode (Strict Exclusivity)
*These colors are strictly reserved for claim verdicts and test outcomes. Badges use subtle dark translucent backgrounds with matching borders and luminous text.*

| Verdict | Semantic Role | Text / Icon Color | Badge Background | Badge Border | Lucide Icon | Visual Meaning |
|---|---|---|---|---|---|---|
| `survived` | Success | `#34d399` (Emerald-400) | `rgba(6, 78, 59, 0.4)` | `rgba(6, 95, 70, 0.5)` | `circle-check` | Claim withstood tests & scrutiny |
| `weakened` | Caution | `#fbbf24` (Amber-400) | `rgba(120, 53, 15, 0.4)` | `rgba(146, 64, 14, 0.5)` | `triangle-alert` | Still standing, but damaged or disputed |
| `broken` | Destructive | `#f87171` (Rose-400) | `rgba(136, 19, 55, 0.4)` | `rgba(159, 18, 57, 0.5)` | `circle-x` | Critical assumption invalidated by evidence |
| `unresolved` | Measured Uncertainty | `#818cf8` (Indigo-400) | `rgba(49, 46, 129, 0.4)` | `rgba(55, 48, 163, 0.5)` | `circle-help` | Active outcome: evidence was thin or conflicting |

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
* **Shadows:** Muted, subtle depth (`shadow-sm`, `shadow-md` backed by `#000000`). No bright glows or saturated neon drop shadows.
* **Transitions:** 150ms ease-out on background and opacity. Fast, functional, and smooth.

---

## 3. UI Component Inventory (Radix / shadcn/ui Mapping)

| UI Element | Base Primitive | Custom Dark Mode Styling / Behavior |
|---|---|---|
| **Entry Textarea** | `Textarea` (shadcn) | Auto-expanding, min-height 120px, `bg-zinc-900`, `border-zinc-800`, `text-zinc-100`, focus ring `ring-1 ring-zinc-400` |
| **Primary CTA** | `Button` (shadcn) | `bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-md shadow-sm` |
| **Secondary Button** | `Button` (shadcn) | `bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 rounded-md` |
| **Claim Card** | `Card` (shadcn) | `bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-lg cursor-pointer` |
| **Verdict Badge** | `Badge` (shadcn) | Rounded-full pill, dark translucent background + semantic luminous text + matching Lucide icon |
| **Load-Bearing Flag** | `Badge` (shadcn) | Muted dark pill (`bg-zinc-800 text-zinc-300 border border-zinc-700`), text: *"Core foundation"* |
| **Evidence Drawer** | `Sheet` (shadcn) | Right slide-over, 480px width, `bg-zinc-900 border-l border-zinc-800`, generous padding |
| **Status Bar** | `div` | Clean single-line header summary displaying progress or final counts (`text-zinc-400`) |
| **Error Banner** | `Alert` (shadcn) | Dark rose background (`bg-rose-950/40 border border-rose-800/60 text-rose-300`) |

---

## 4. Per-Screen Specifications

### Screen 1: Decision Entry View

#### Purpose:
The distraction-free starting point. Accepts the user's proposal or strategy dilemma. Strictly one input, zero distractions.

#### Layout Skeleton:
- **Header:** Clean `"Crossfire"` wordmark at top-left with subtle status text (`text-zinc-400`).
- **Main Canvas:** Centered column, max-width `640px`, generous top margin.
- **Form Elements:**
  - Label: `"What are you considering?"` (20px, font-semibold, `text-zinc-100`).
  - Textarea: Auto-growing, ~120px height, `bg-zinc-900`, `border-zinc-800`, `text-zinc-100`, comfortable padding, focus ring `ring-1 ring-zinc-400`.
  - Action Row: Right-aligned primary button: `"Test Decision"` (`bg-white text-zinc-950 font-medium hover:bg-zinc-200`).
- **Loading State:** On submission (`POST /cases`), swaps textarea to 3 soft pulsing skeleton lines (`bg-zinc-800`) with caption: *"Extracting core assumptions..."*.

---

### Screen 2: Claim Alignment View

#### Purpose:
The critical alignment gate (`Case.status == "awaiting_confirmation"`). Displays the extracted assumptions before any tests or searches run, allowing the user to verify, edit, or remove claims.

#### Layout Skeleton:
- **Placement:** Single column, max-width `720px`, centered.
- **Header:**
  - Subtitle: `"Review assumptions before testing:"` in `text-zinc-400`.
  - Echo: User's decision statement in `text-zinc-100 font-medium`.
- **Claim Stack:** Vertical stack of dark cards (`bg-zinc-900 border border-zinc-800 p-4 rounded-lg`).
  - Left: Claim statement text (`text-zinc-200`).
  - Right: Clean `×` delete button (`text-zinc-500 hover:text-rose-400`).
  - Interaction: Clicking card allows inline text editing.
  - Bottom: Lightweight `"+ Add assumption"` button (`text-zinc-400 hover:text-zinc-200`).
- **Actions:** High-contrast primary button: `"Confirm & Run Tests"` $\rightarrow$ calls `POST /cases/{id}/confirm`.

---

### Screen 3: Decision Memo & Live Audit (Testing $\rightarrow$ Completed)

#### Purpose:
The unified audit memo. Seamlessly transitions from live SSE testing into the final executive decision memo without abrupt layout shifts.

#### Layout Skeleton:
- **Placement:** Centered column, max-width `840px`.
- **Header Summary Bar:**
  - *While Testing (`Case.status == "testing"`):* Calm, truthful progress text: *"Testing claims against web evidence and counterarguments..."* (`text-zinc-400`).
  - *When Completed (`Case.status == "done"`):* Executive summary: *"4 claims tested: 1 survived, 1 weakened, 1 broken, 1 unresolved."* (`text-zinc-200 font-medium`).
- **Claim Card Stack:**
  - Each card represents one claim (`bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors`).
  - Top Row: Load-bearing pill (`bg-zinc-800 text-zinc-300 border border-zinc-700`) + Reconciled Verdict Badge on the right.
  - Body: Claim statement in bold, readable text (`text-lg font-medium text-zinc-100`).
  - Real-World Consequence: Plain-English summary of what this means for the proposal (`text-sm text-zinc-400 mt-2`).
  - Footer Action: Button `"View Evidence & Sources →"` (`text-xs text-zinc-400 hover:text-zinc-200`). Clicking opens the slide-over Evidence Drawer.

---

### Screen 4: Evidence & Audit Slide-Over Drawer (Sheet)

#### Purpose:
The complete transparency layer. Slides over from the right viewport edge when a claim card is clicked, presenting primary sources, test details, and actionable recommendations.

#### Layout Skeleton:
- **Panel Specs:** 480px width, right-anchored, full viewport height, background `bg-zinc-900`, left border `border-zinc-800`, internal vertical scrolling.
- **Header:** Close `(×)` top-right, followed by Section Header `AUDIT TRAIL & EVIDENCE` (`text-xs font-mono text-zinc-400 uppercase`).
- **Content Flow (Top to Bottom):**
  1. **Claim & Verdict:** Full claim statement (`text-base font-semibold text-zinc-100`) + Reconciled Verdict Badge (`Survived`, `Weakened`, `Broken`, `Unresolved`).
  2. **Why It Matters:** Plain-English explanation of why this claim is load-bearing (`text-sm text-zinc-300`).
  3. **Tests Executed:** Clean monospace badges for tests run (e.g. `[ ASSUMPTION TEST ]`, `[ EVIDENCE TEST ]`).
  4. **Primary Source Citations (`EvidenceItem`):**
     - Dark citation card (`bg-zinc-950 border border-zinc-800 rounded-md p-4`):
       - Clickable primary source URL with clean domain pill (`text-xs font-mono text-blue-400 hover:underline`).
       - Article / document title (`text-sm font-medium text-zinc-200`).
       - Curated quote snippet retrieved by search (`text-sm text-zinc-400 leading-relaxed mt-1`).
     - *Honest Empty State:* If no public evidence was found: *"No public evidence could be retrieved for this claim"* (`text-sm text-zinc-500 italic`).
  5. **Contradictions Surfaced:** Alert callout highlighting counter-arguments or conflicting market evidence (`bg-zinc-950 border border-zinc-800 p-3 rounded-md text-zinc-300`).
  6. **Recommended Plan Adjustment:** Plain-English guidance on how to adjust the strategy (`text-sm text-zinc-200`).
  7. **Next Validation Step:** The concrete smallest experiment to perform tomorrow (`text-sm text-zinc-300 font-medium`).

---

### Screen 5: Error Handling & Degradation

#### Purpose:
Clear, honest, non-destructive error states matching the backend's `error` SSE event (`{"stage": "...", "message": "..."}`).

#### Specifications:
1. **Pipeline-Level Error:**
   - Dark rose banner (`bg-rose-950/40 border border-rose-800/60 rounded-md p-4 flex items-center justify-between text-rose-300`).
   - Plain English description (e.g. *"Unable to extract assumptions due to a connection timeout"*), with a `"Retry"` button.
2. **Test-Level Error:**
   - If an individual test or search query fails, that specific test row indicates: *"Test timed out. Claim marked unresolved due to absent evidence."*
   - Other claims continue testing normally without blocking the pipeline.

---

## 5. Final Design Verification Checklist

- [x] **Dark-First Readability:** Deep zinc canvas (`#09090b`), elevated dark cards (`#18181b`), and crisp zinc text (`#f4f4f5`) with generous line-height (`1.6`).
- [x] **Zero Fake Telemetry:** No glowing blue "LIVE STREAM" dots, no pulsing radar beacons, no 3-segment impact meters, and no unbuilt provider modals or dropzones.
- [x] **Strict 4-Color Verdicts:** Luminous Emerald (`survived`), Amber (`weakened`), Rose (`broken`), Indigo (`unresolved`). Never gray or disabled.
- [x] **Evaluator Masking:** Internal agent names (`devils_advocate`, `receipts`, `builder`) are strictly mapped to human test names (*Assumption Test*, *Evidence Test*, *Feasibility Test*).
- [x] **Real Backend Contracts:** Aligns 1:1 with `POST /cases`, `POST /cases/{id}/confirm`, `GET /cases/{id}/stream`, and `GET /cases/{id}`.
- [x] **Responsive & Accessible:** Clean, single-column reading layouts with full keyboard accessibility and WCAG AA contrast.

