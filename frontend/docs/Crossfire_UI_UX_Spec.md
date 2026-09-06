# Crossfire — UI/UX Specification

This is the build specification for the Crossfire frontend interface. It strictly reflects the **currently working backend API** (`POST /cases`, `POST /cases/{id}/confirm`, `GET /cases/{id}/stream`, `GET /cases/{id}`) and our core product philosophy: **an authoritative, readable Executive Decision Memo with zero clutter and zero fake telemetry**.

- **Framework:** React 19 + TypeScript + Vite.
- **Styling:** Tailwind CSS + Radix UI primitives (`shadcn/ui`) using CSS variables.
- **Aesthetic:** Clean Dark Mode design. High-contrast crisp typography (`#f4f4f5`) on deep zinc canvas (`#09090b`), elevated card surfaces (`#18181b`), subtle borders (`#27272a`), generous whitespace, relaxed line height.
- **Verdict Colors:** Reserved strictly for claim outcomes (Emerald, Amber, Rose, Indigo).
- **Restraint:** No 3D WebGL, no shader canvases, no pulsing glowing dots, no impact meters, and no unbuilt widgets. Fast (<150ms) CSS transitions only.

---

## 1. Why this direction, in one paragraph

The product is an **executive crash-test rig for decisions**, not an AI chat console, a simulated hacker terminal, or an arcade dashboard. A decision maker reviewing high-stakes assumptions needs immediate clarity, readable prose, and transparent proof—deep focus without eye-straining neon glows, pulsing blue radar dots, or 3-segment bar meters. The interface reads like a **clean, high-caliber dark decision brief**: generous margins, crisp light typography, distinct dark cards, and a 1-click slide-over drawer for inspecting primary sources and citations.

---

## 2. Design Principles

Every screen and component must satisfy these non-negotiable rules:

1. **Test name, not persona:** No backend evaluator name (`devils_advocate`, `receipts`, `builder`, `overthinker`) ever renders in the UI, tooltips, or error messages. Only human test names derived from `failure_mode` (*Assumption Test*, *Evidence Test*, *Feasibility Test*, *Edge-Case Test*).
2. **State over conversation:** Every screen is a structured view of `Case` fields (claims, findings, consequences, status)—never a chatbot transcript or message stream.
3. **Unresolved is a real, first-class outcome:** Styled in **Indigo / Violet (`#818cf8`)**, never gray or disabled. It represents a deliberate, measured uncertainty where public evidence was thin or conflicting.
4. **Color carries verdict, nothing else:** The four verdict colors are reserved exclusively for claim results. They are never reused for form validation or general badges.
5. **Never a mode menu:** One single prompt: *"What are you considering?"*. No tabs, no mode pickers, no fake file dropzones.
6. **Evidence is always one click away:** Every claim card has an explicit affordance to open its slide-over Evidence Drawer, displaying real citations and counterarguments.
7. **Zero Fake Telemetry:** No pulsing "LIVE STREAM" dots, no simulated meters, and no unbuilt settings modals. Statuses are quiet, honest, and grounded in real data.

---

## 3. Screens & User Flow

The complete user journey consists of three core screens and one slide-over drawer:

### 3.1 Screen 1: Decision Entry View
* **Route / State:** Initial landing state (`Case == null`).
* **Prompt:** *"What are you considering?"* (`text-xl font-semibold text-zinc-100`).
* **Input:** Auto-growing textarea with comfortable padding, dark surface (`bg-zinc-900`), and subtle dark border (`border-zinc-800 text-zinc-100`).
* **Action:** Single high-contrast primary button: `"Test Decision"` (`bg-white text-zinc-950 font-medium hover:bg-zinc-200`).
* **Loading State:** Calling `POST /cases` immediately replaces the textarea with a 3-bar skeleton loader (`bg-zinc-800`) and caption: *"Extracting core assumptions..."*.

### 3.2 Screen 2: Claim Alignment View
* **Route / State:** `Case.status == "awaiting_confirmation"`.
* **Purpose:** The alignment checkpoint where the user confirms what assumptions will be stress-tested before compute runs.
* **Layout:** Centered single column (max-width 720px).
* **Header Echo:** Clean restatement of the user's decision in readable prose (`text-zinc-100 font-medium`).
* **Claim List:** A vertical stack of dark cards (`bg-zinc-900 border border-zinc-800 rounded-lg p-4`).
  * Clicking any card turns its text into an editable input.
  * A simple `(×)` delete affordance removes irrelevant claims (`text-zinc-500 hover:text-rose-400`).
  * Lightweight `"+ Add assumption"` text link for anything the AI missed (`text-zinc-400 hover:text-zinc-200`).
* **Action:** Primary button: `"Confirm and test assumptions"` $\rightarrow$ calls `POST /cases/{id}/confirm` (`bg-white text-zinc-950 font-medium`).
* **Rule:** Status badges and `load_bearing` flags are **never** shown on this screen.

### 3.3 Screen 3: Decision Memo & Live Audit (Testing $\rightarrow$ Completed)
* **Route / State:** `Case.status == "testing"` or `"done"`.
* **Architecture:** Testing and Results live on the same screen component to prevent disruptive page transitions.
* **Top Summary Bar:**
  * *While testing:* A truthful, calm status: *"Testing 4 claims against web evidence and counterarguments..."* (`text-zinc-400`).
  * *When completed:* An authoritative executive summary: *"4 claims tested: 1 survived, 1 weakened, 1 broken, 1 unresolved."* (`text-zinc-200 font-medium`).
* **Claim Cards (Max-width 840px):**
  * One spacious dark card per claim (`bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors`).
  * **Core Foundation Tag:** Rendered when `load_bearing == true` (`bg-zinc-800 text-zinc-300 border border-zinc-700`).
  * **Claim Statement:** Bold, high-contrast, easily scannable text (`text-lg font-medium text-zinc-100`).
  * **Verdict Badge:** Semantic pill badge (`Survived`, `Weakened`, `Broken`, `Unresolved`).
  * **Real-World Consequence:** Plain-English explanation of how this assumption affects the plan (`text-sm text-zinc-400 mt-2`).
  * **Drawer Trigger:** A prominent `"View Evidence & Sources →"` button (`text-xs text-zinc-400 hover:text-zinc-200`).

### 3.4 Screen 4: Evidence & Source Audit Drawer
* **Component:** Slide-over sheet (`Sheet` primitive) opening from the right (480px width, `bg-zinc-900`, left border `border-zinc-800`).
* **Data Source:** Reads directly from the `Case` object (`GET /cases/{id}`).
* **Content Hierarchy (Top to Bottom):**
  1. **Claim Statement:** Prominent headline text (`text-base font-semibold text-zinc-100`).
  2. **Verdict & Reasoning:** Final verdict badge and evaluator rationale (`text-sm text-zinc-300`).
  3. **Real Evidence Sources (`EvidenceItem`):**
     * Clickable primary source URL with clean domain pill (e.g. `techcrunch.com`) in `text-xs font-mono text-blue-400`.
     * Document / article title (`text-sm font-medium text-zinc-200`).
     * Curated quote snippet retrieved by DuckDuckGo / Scrapling (`text-sm text-zinc-400 leading-relaxed mt-1`).
     * *Honest Empty State:* If no public sources exist: *"No public evidence could be retrieved for this claim"* (`text-sm text-zinc-500 italic`).
  4. **Contradictions:** Explicit counter-evidence or conflicting facts found (`bg-zinc-950 border border-zinc-800 p-3 rounded-md text-zinc-300`).
  5. **Recommended Plan Adjustment:** Plain-English guidance on what changes in the proposal (`text-sm text-zinc-200`).
  6. **Next Validation Step:** The smallest real-world test the user can perform tomorrow (`text-sm text-zinc-300 font-medium`).

---

## 4. Design System Tokens (Dark-First)

| Token | CSS Variable / Tailwind | Hex Value | Semantic Usage |
|---|---|---|---|
| **Background** | `--background` / `bg-zinc-950` | `#09090b` | Canvas background (deep zinc) |
| **Card** | `--card` / `bg-zinc-900` | `#18181b` | Cards, memo container, drawer surface |
| **Border** | `--border` / `border-zinc-800` | `#27272a` | Card borders, dividers, subtle row separators |
| **Primary Text** | `--foreground` / `text-zinc-100` | `#f4f4f5` | Headlines, claim statements, primary body |
| **Secondary Text** | `--muted-foreground` / `text-zinc-400` | `#a1a1aa` | Captions, metadata, confidence values, queued state |
| **Primary Button** | `--primary` / `bg-white` | `#ffffff` | Action buttons (`text-zinc-950 font-medium`), focus rings |

### 4.1 Verdict Colors (Strict Exclusivity in Dark Mode)
| Verdict | Semantic Role | Text / Icon Color | Badge Background | Badge Border | Lucide Icon |
|---|---|---|---|---|---|
| `survived` | Success | `#34d399` (Emerald-400) | `rgba(6, 78, 59, 0.4)` | `rgba(6, 95, 70, 0.5)` | `circle-check` |
| `weakened` | Caution | `#fbbf24` (Amber-400) | `rgba(120, 53, 15, 0.4)` | `rgba(146, 64, 14, 0.5)` | `triangle-alert` |
| `broken` | Destructive | `#f87171` (Rose-400) | `rgba(136, 19, 55, 0.4)` | `rgba(159, 18, 57, 0.5)` | `circle-x` |
| `unresolved` | Uncertainty | `#818cf8` (Indigo-400) | `rgba(49, 46, 129, 0.4)` | `rgba(55, 48, 163, 0.5)` | `circle-help` |

---

## 5. Explicitly Excluded from the Product

- **No Neon / Cluttered Cyberpunk Themes:** Clean, muted dark slate design (`#09090b` canvas, `#18181b` cards) for calm reading, not eye-straining glows.
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
     - **Verdict:** `weakened` (Amber `#fbbf24`)
     - **Finding:** Confidence 0.62 — *"Survey data indicates 42% of students require a manual verification step before permitting automated submission."*
     - **Recommended Change:** *"Introduce a mandatory human review checkpoint before final dispatch."*
  2. **Claim 2 (Load-bearing):** *"There's no existing competitor already solving this well."*
     - **Test:** Evidence Test
     - **Verdict:** `broken` (Rose `#f87171`)
     - **Finding:** Confidence 0.81 — *"Directly competing product CollegeAI raised $12M seed and is live in the market."*
     - **Citation:** `techcrunch.com` — *"CollegeAI offers end-to-end college application drafting and automated submission."*
     - **Recommended Change:** *"Differentiate on human-in-the-loop counseling audits rather than a first-to-market claim."*
  3. **Claim 3 (Not load-bearing):** *"High school counselors lack the capacity to review every essay individually."*
     - **Test:** Assumption Test
     - **Verdict:** `survived` (Emerald `#34d399`)
     - **Finding:** Confidence 0.90 — *"Public education counselor ratios (1:450) confirm severe capacity bottlenecks."*
  4. **Claim 4 (Load-bearing):** *"The AI can reliably parse arbitrary college application portals without per-school custom integration."*
     - **Test:** Feasibility Test
     - **Verdict:** `unresolved` (Indigo `#818cf8`)
     - **Finding:** Confidence 0.35 — *"No public API standard exists; web bot detection blocks automated crawlers. Technical feasibility spike required."*
     - **Empty Evidence State:** *"No public documentation could be retrieved for arbitrary portal APIs."*
     - **Next Validation Action:** *"Build a manual testing spike against 3 target application portals."*

* **Headline Summary:** *"4 claims tested: 1 survived, 1 weakened, 1 broken, 1 unresolved."*

---

## 7. Verification Checklist

- [x] **Dark-First Simplicity:** Clean dark surfaces (`#18181b`), subtle borders (`#27272a`), high-contrast white/zinc typography (`#f4f4f5`).
- [x] **Zero Fake Telemetry:** No pulsing "LIVE" dots, no 3-segment meters, no unbuilt settings modals.
- [x] **Strict 4-Color Verdicts:** Luminous Emerald, Amber, Rose, Indigo (never gray).
- [x] **Strict Evaluator Masking:** No internal worker names (`devils_advocate`, `receipts`, etc.) rendered in UI.
- [x] **Backend Contract Parity:** Exact match with `Case`, `Claim`, `EvidenceItem`, `Finding`, and `DecisionConsequence`.

