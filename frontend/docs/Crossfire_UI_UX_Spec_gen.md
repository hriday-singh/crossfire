# Crossfire — UI/UX Specification

This is the build specification for the Crossfire frontend interface. It strictly reflects the **currently working backend API** (`POST /cases`, `POST /cases/{id}/confirm`, `GET /cases/{id}/stream`, `GET /cases/{id}`) and our core product philosophy: **an authoritative, readable Executive Decision Memo with zero clutter and zero fake telemetry**.

- **Framework:** React 19 + TypeScript + Vite.
- **Styling:** Tailwind CSS + Radix UI primitives (`shadcn/ui`) using CSS variables.
- **Aesthetic:** Clean light-first design. High-contrast deep slate typography on warm off-white canvas, generous whitespace, relaxed line height.
- **Verdict Colors:** Reserved strictly for claim outcomes (Emerald, Amber, Rose, Indigo).
- **Restraint:** No 3D WebGL, no shader canvases, no pulsing glowing dots, no impact meters, and no unbuilt widgets. Fast (<150ms) CSS transitions only.

---

## 1. Why this direction, in one paragraph

The product is an **executive crash-test rig for decisions**, not an AI chat console, a simulated hacker terminal, or an arcade dashboard. A decision maker reviewing high-stakes assumptions needs immediate clarity, readable prose, and transparent proof—not dark-mode eye strain, pulsing blue radar dots, or 3-segment bar meters. The interface reads like a **clean, high-caliber decision brief** (think Linear, Stripe, or Notion): generous margins, crisp typography, distinct claim cards, and a 1-click slide-over drawer for inspecting primary sources and citations.

---

## 2. Design Principles

Every screen and component must satisfy these non-negotiable rules:

1. **Test name, not persona:** No backend evaluator name (`devils_advocate`, `receipts`, `builder`, `overthinker`) ever renders in the UI, tooltips, or error messages. Only human test names derived from `failure_mode` (*Assumption Test*, *Evidence Test*, *Feasibility Test*, *Edge-Case Test*).
2. **State over conversation:** Every screen is a structured view of `Case` fields (claims, findings, consequences, status)—never a chatbot transcript or message stream.
3. **Unresolved is a real, first-class outcome:** Styled in **Indigo (`#4f46e5`)**, never gray or disabled. It represents a deliberate, measured uncertainty where public evidence was thin or conflicting.
4. **Color carries verdict, nothing else:** The four verdict colors are reserved exclusively for claim results. They are never reused for form validation or general badges.
5. **Never a mode menu:** One single prompt: *"What are you considering?"*. No tabs, no mode pickers, no fake file dropzones.
6. **Evidence is always one click away:** Every claim card has an explicit affordance to open its slide-over Evidence Drawer, displaying real citations and counterarguments.
7. **Zero Fake Telemetry:** No pulsing "LIVE STREAM" dots, no simulated meters, and no unbuilt settings modals. Statuses are quiet, honest, and grounded in real data.

---

## 3. Screens & User Flow

The complete user journey consists of three core screens and one slide-over drawer:

### 3.1 Screen 1: Decision Entry View
* **Route / State:** Initial landing state (`Case == null`).
* **Prompt:** *"What are you considering?"* (text-xl font-semibold text-zinc-900).
* **Input:** Auto-growing textarea with comfortable padding, white background, and subtle neutral border (`border-zinc-200`).
* **Action:** Single high-contrast primary button: `"Test Decision"` (`bg-zinc-900 text-white`).
* **Loading State:** Calling `POST /cases` immediately replaces the textarea with a 3-bar skeleton loader and caption: *"Extracting core assumptions..."*.

### 3.2 Screen 2: Claim Alignment View
* **Route / State:** `Case.status == "awaiting_confirmation"`.
* **Purpose:** The alignment checkpoint where the user confirms what assumptions will be stress-tested before compute runs.
* **Layout:** Centered single column (max-width 720px).
* **Header Echo:** Clean restatement of the user's decision in readable prose.
* **Claim List:** A vertical stack of white cards.
  * Clicking any card turns its text into an editable input.
  * A simple `(×)` delete affordance removes irrelevant claims.
  * Lightweight `"+ Add assumption"` text link for anything the AI missed.
* **Action:** Primary button: `"Confirm and test assumptions"` $\rightarrow$ calls `POST /cases/{id}/confirm`.
* **Rule:** Status badges and `load_bearing` flags are **never** shown on this screen.

### 3.3 Screen 3: Decision Memo & Live Audit (Testing $\rightarrow$ Completed)
* **Route / State:** `Case.status == "testing"` or `"done"`.
* **Architecture:** Testing and Results live on the same screen component to prevent disruptive page transitions.
* **Top Summary Bar:**
  * *While testing:* A truthful, calm status: *"Testing 4 claims against web evidence and counterarguments..."*.
  * *When completed:* An authoritative executive summary: *"4 claims tested: 1 survived, 1 weakened, 1 broken, 1 unresolved."*.
* **Claim Cards (Max-width 840px):**
  * One spacious white card per claim (`bg-white border border-zinc-200 rounded-lg p-6 shadow-sm`).
  * **Core Foundation Tag:** Rendered when `load_bearing == true`.
  * **Claim Statement:** Bold, high-contrast, easily scannable text (`text-lg font-medium text-zinc-900`).
  * **Verdict Badge:** Semantic pill badge (`Survived`, `Weakened`, `Broken`, `Unresolved`).
  * **Real-World Consequence:** Plain-English explanation of how this assumption affects the plan.
  * **Drawer Trigger:** A prominent `"View Evidence & Sources →"` button.

### 3.4 Screen 4: Evidence & Source Audit Drawer
* **Component:** Slide-over sheet (`Sheet` primitive) opening from the right (480px width, white background, left border `border-zinc-200`).
* **Data Source:** Reads directly from the `Case` object (`GET /cases/{id}`).
* **Content Hierarchy (Top to Bottom):**
  1. **Claim Statement:** Prominent headline text.
  2. **Verdict & Reasoning:** Final verdict badge and evaluator rationale.
  3. **Real Evidence Sources (`EvidenceItem`):**
     * Clickable primary source URL with clean domain pill (e.g. `techcrunch.com`).
     * Document / article title.
     * Curated quote snippet retrieved by Tavily / Scrapling.
     * *Honest Empty State:* If no public sources exist: *"No public evidence could be retrieved for this claim"*.
  4. **Contradictions:** Explicit counter-evidence or conflicting facts found.
  5. **Recommended Plan Adjustment:** Plain-English guidance on what changes in the proposal.
  6. **Next Validation Step:** The smallest real-world test the user can perform tomorrow.

---

## 4. Design System Tokens (Light-First)

| Token | CSS Variable / Tailwind | Hex Value | Semantic Usage |
|---|---|---|---|
| **Background** | `--background` / `bg-zinc-50` | `#fafafa` | Canvas background (warm off-white) |
| **Card** | `--card` / `bg-white` | `#ffffff` | Cards, memo container, drawer surface |
| **Border** | `--border` / `border-zinc-200` | `#e4e4e7` | Card borders, dividers, subtle row separators |
| **Primary Text** | `--foreground` / `text-zinc-900` | `#18181b` | Headlines, claim statements, primary body |
| **Secondary Text** | `--muted-foreground` / `text-zinc-500` | `#71717a` | Captions, metadata, confidence values, queued state |
| **Primary Button** | `--primary` / `bg-zinc-900` | `#18181b` | Action buttons (`text-white`), focus rings |

### 4.1 Verdict Colors (Strict Exclusivity)
| Verdict | Semantic Role | Text / Icon Color | Badge Background | Lucide Icon |
|---|---|---|---|---|
| `survived` | Success | `#059669` (Emerald) | `#ecfdf5` | `circle-check` |
| `weakened` | Caution | `#d97706` (Amber) | `#fffbeb` | `triangle-alert` |
| `broken` | Destructive | `#e11d48` (Rose) | `#fff1f2` | `circle-x` |
| `unresolved` | Uncertainty | `#4f46e5` (Indigo) | `#eef2ff` | `circle-help` |

---

## 5. Explicitly Excluded from the Product

- **No Dark-Only Mode:** Clean, readable light-first design is standard.
- **No 3D / WebGL / Canvas Shaders:** Removed from all specs and dependencies.
- **No Fake Telemetry:** No glowing blue "LIVE STREAM" dots, no radar beacons, no 3-segment impact meters.
- **No Unbuilt Features:** No PDF drag-and-drop dropzones, no model provider dropdowns, no settings modals, no history sidebars.
- **No Personas / Avatars:** Internal agent names (`devils_advocate`, `receipts`, `builder`) never appear anywhere.

---

## 6. Sample Decision Test Case

To ensure design and component testing are grounded in a concrete, realistic decision:

* **Raw Input (`Case.raw_input`):** *"I want to build an AI that helps students apply to college, including submitting applications on their behalf."*

* **Extracted Claims & Reconciled Verdicts:**
  1. **Claim 1 (Load-bearing):** *"Students will trust an AI to submit applications on their behalf."*
     - **Test:** Assumption Test
     - **Verdict:** `weakened` (Amber `#d97706`)
     - **Finding:** Confidence 0.62 — *"Survey data indicates 42% of students require a manual verification step before permitting automated submission."*
     - **Recommended Change:** *"Introduce a mandatory human review checkpoint before final dispatch."*
  2. **Claim 2 (Load-bearing):** *"There's no existing competitor already solving this well."*
     - **Test:** Evidence Test
     - **Verdict:** `broken` (Rose `#e11d48`)
     - **Finding:** Confidence 0.81 — *"Directly competing product CollegeAI raised $12M seed and is live in the market."*
     - **Citation:** `techcrunch.com` — *"CollegeAI offers end-to-end college application drafting and automated submission."*
     - **Recommended Change:** *"Differentiate on human-in-the-loop counseling audits rather than a first-to-market claim."*
  3. **Claim 3 (Not load-bearing):** *"High school counselors lack the capacity to review every essay individually."*
     - **Test:** Assumption Test
     - **Verdict:** `survived` (Emerald `#059669`)
     - **Finding:** Confidence 0.90 — *"Public education counselor ratios (1:450) confirm severe capacity bottlenecks."*
  4. **Claim 4 (Load-bearing):** *"The AI can reliably parse arbitrary college application portals without per-school custom integration."*
     - **Test:** Feasibility Test
     - **Verdict:** `unresolved` (Indigo `#4f46e5`)
     - **Finding:** Confidence 0.35 — *"No public API standard exists; web bot detection blocks automated crawlers. Technical feasibility spike required."*
     - **Empty Evidence State:** *"No public documentation could be retrieved for arbitrary portal APIs."*
     - **Next Validation Action:** *"Build a manual testing spike against 3 target application portals."*

* **Headline Summary:** *"4 claims tested: 1 survived, 1 weakened, 1 broken, 1 unresolved."*

---

## 7. Verification Checklist

- [x] **Light-First Simplicity:** Clean white surfaces, soft neutral borders, high-contrast charcoal typography.
- [x] **Zero Fake Telemetry:** No pulsing "LIVE" dots, no 3-segment meters, no unbuilt settings modals.
- [x] **Strict 4-Color Verdicts:** Emerald, Amber, Rose, Indigo (never gray).
- [x] **Strict Evaluator Masking:** No internal worker names (`devils_advocate`, `receipts`, etc.) rendered in UI.
- [x] **Backend Contract Parity:** Exact match with `Case`, `Claim`, `EvidenceItem`, `Finding`, and `DecisionConsequence`.

