# Crossfire — Frontend View Architecture & Screen Plan

This document outlines the complete view architecture for **Crossfire** from a frontend/UI developer's perspective. It strictly reflects the **currently working backend API** (`backend/api/routes.py`, `backend/core/models.py`, `backend/api/events.py`) and embodies our core UI philosophy: **maximum readability, zero clutter, and zero fake telemetry**.

---

## 1. Goal Description & Philosophy

Crossfire is a **rigorous decision testing memo**, not an AI chatbot, a simulated hacker terminal, or an arcade dashboard. 

Instead of an unreadable, cluttered console or an agreeable AI chat window:
1. **Inputs a proposal or business decision** via a clean, distraction-free prompt.
2. **Extracts foundational assumptions** into distinct, testable claims.
3. **Lets the user review and edit claims** before any compute runs.
4. **Stress-tests each claim** against live web evidence, counter-arguments, and feasibility constraints.
5. **Presents an authoritative, readable Decision Memo** with clear verdicts (`survived`, `weakened`, `broken`, `unresolved`) and a 1-click slide-over Evidence Drawer containing real citations.

Our mandate: **Clean, breathable, honest, and effortless to read.**

---

## 2. Core View Flow (The User Journey)

The entire product consists of three focused screens and one slide-over drawer:

```mermaid
graph TD
    V1["View 1: Decision Entry<br><i>POST /cases</i>"] -->|"Submit Proposal"| Loading["Calm State: Extracting Claims..."]
    Loading --> V2["View 2: Claim Alignment<br><i>POST /cases/{id}/confirm</i>"]
    V2 -->|"Confirm & Run"| V3["View 3: Decision Memo & Audit<br><i>GET /cases/{id}/stream</i>"]
    V3 <-->|"Click Claim Card"| Drawer["Evidence Drawer (Slide-Over Sheet)<br><i>GET /cases/{id}</i>"]
```

---

## 3. Detailed View Breakdown

### View 1: Decision Entry View ("What are you considering?")
*The distraction-free starting point.*

* **Role & Purpose:** A focused, high-contrast entry point that invites the user to state a business proposition, product bet, or strategic dilemma.
* **Layout & Key Elements:**
  * **Header:** Minimal wordmark (`Crossfire`) with generous breathing room.
  * **Hero Prompt:** A clear, human question: *"What are you considering?"*
  * **Textarea:** Clean, auto-expanding textarea with a subtle dark border (`border-zinc-800`), dark surface (`bg-zinc-900`), and crisp text (`text-zinc-100`, comfortable font size 16px / `text-base` to prevent mobile zooming, with relaxed line height).
  * **Primary Action:** A single high-contrast button: `"Test Decision"` (`bg-white text-zinc-950 font-medium hover:bg-zinc-200`).
* **Honest Simplicity (No Fake Stuff):**
  * No fake PDF dropzones or file attachment widgets.
  * No model provider dropdowns, temperature sliders, or settings modals.
  * No cycling example carousels or decorative graphics.
* **Extraction State:**
  * On submit, calls `POST /cases` (`{"raw_input": "..."}`).
  * Transitions smoothly to a calm skeleton state with 3–4 soft pulsing lines (`bg-zinc-800`) and a quiet caption: *"Extracting core assumptions..."*. No fake percentage spinners.

---

### View 2: Claim Alignment View
*The checkpoint where user and system align on what is actually being tested.*

* **Role & Purpose:** Maps to `Case.status == "awaiting_confirmation"`. Ensures the system didn't misunderstand the user's premise before compute runs.
* **Layout & Key Elements:**
  * **Header Restatement:** Echoes the decision in clean, readable prose so the user knows Crossfire understood their intent (`text-zinc-100 font-medium`).
  * **Instructions:** *"We extracted these core assumptions. Verify, edit, or remove any before we test."* (`text-zinc-400`)
  * **Claim List:** A clean stack of dark cards (`bg-zinc-900 border-zinc-800`) against the deep zinc background (`bg-zinc-950`).
  * **Inline Editing:** Clicking any card switches the statement to an editable text input.
  * **Delete Affordance:** A simple `(×)` remove button on each card (`text-zinc-500 hover:text-rose-400`).
  * **Add Affordance:** A lightweight `"+ Add assumption"` text button for anything the system missed (`text-zinc-400 hover:text-zinc-200`).
  * **Primary Action:** One clear button: `"Confirm and test assumptions"` $\rightarrow$ `POST /cases/{id}/confirm` (`bg-white text-zinc-950 font-medium`).
* **Design Character:** A calm, static editing form.

---

### View 3: Decision Memo & Live Audit (Testing $\rightarrow$ Completed)
*The signature screen: a unified, calm executive brief that seamlessly updates.*

* **Role & Purpose:** Subscribes to `GET /cases/{id}/stream` when `status == "testing"` and remains the persistent results memo once `status == "done"`. Avoids jarring route navigations.
* **Layout & Key Elements:**
  * **Executive Summary Header:**
    * *During testing:* A truthful, quiet status line: *"Testing 4 claims against web evidence and counterarguments..."* (`text-zinc-400`)
    * *When complete:* A calm, authoritative summary: *"4 claims tested: 1 survived, 1 weakened, 1 broken, 1 unresolved."* (`text-zinc-200 font-medium`)
    * *No fake telemetry:* No glowing blue "LIVE STREAM" dots, no radar beacons, no simulated counters.
  * **Claim Cards:**
    * Clean, well-spaced dark cards (`bg-zinc-900 border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors`).
    * **Load-bearing Indicator:** Subtle badge: *"Core foundation"* (`bg-zinc-800 text-zinc-300 border-zinc-700`, for claims where `load_bearing == true`).
    * **Claim Statement:** Bold, high-contrast, easily scannable (`text-lg font-medium text-zinc-100`).
    * **Verdict Badge (Strict Color Mapping in Dark Mode):**
      * `survived`: Emerald badge (`#34d399` text on `rgba(6, 78, 59, 0.4)` border `rgba(6, 95, 70, 0.5)`).
      * `weakened`: Amber badge (`#fbbf24` text on `rgba(120, 53, 15, 0.4)` border `rgba(146, 64, 14, 0.5)`).
      * `broken`: Rose badge (`#f87171` text on `rgba(136, 19, 55, 0.4)` border `rgba(159, 18, 57, 0.5)`).
      * `unresolved`: Indigo badge (`#818cf8` text on `rgba(49, 46, 129, 0.4)` border `rgba(55, 48, 163, 0.5)`) — *represents a deliberate, measured uncertainty, never gray or disabled.*
    * **Decision Consequence:** Plain-English explanation of the real-world impact (`text-sm text-zinc-400 mt-2`).
    * **Action Trigger:** A clear, visible button: `"View Evidence & Sources →"` that opens the Evidence Drawer.

---

### Slide-Over Drawer: Evidence & Source Audit
*The transparency layer: inspect the real proof behind every verdict.*

* **Role & Purpose:** A right-hand slide-over sheet (`Sheet` primitive) opening smoothly without navigating away from the memo. Fetches or reads the full `Case` object (`GET /cases/{id}`).
* **Layout & Key Elements (Top to Bottom):**
  1. **Claim Statement:** Full, prominent statement.
  2. **Verdict & Reasoning:** The verdict badge and the evaluator's plain-language reasoning.
  3. **Real Evidence Sources (`EvidenceItem` list):**
     * Clickable primary source URL with clean domain label.
     * Source title.
     * Curated quote/snippet retrieved by Tavily / Scrapling.
     * *Honest Empty State:* If web evidence was absent, an explicit, truthful callout: *"No public evidence could be retrieved for this claim"*.
  4. **Contradictions:** Explicit counterarguments or conflicting data found, if any.
  5. **Recommended Change:** Actionable guidance on how to adjust your decision or business plan.
  6. **Next Validation Step:** The smallest concrete real-world test to perform (rendered when present).

---

### View 4: Error Handling
*Clear, non-destructive feedback.*

* **Test-Level Failure:** If an evaluator error occurs on a single test, only that claim indicates an issue; the rest of the memo finishes cleanly.
* **Pipeline-Level Failure:** A clean alert banner at the top of the memo explaining the issue in plain English, with a retry option.

---

## 4. UI Component Architecture

Streamlined, lightweight, and built purely with standard React + Tailwind + Radix UI:

```
frontend/src/
├── components/
│   ├── ui/                       # Radix / shadcn primitives (Button, Textarea, Card, Sheet, Badge, Alert)
│   ├── layout/
│   │   ├── Header.tsx            # Clean wordmark and connection state text
│   │   └── Container.tsx         # Centered container with generous reading width (max-w-4xl)
│   ├── screens/
│   │   ├── EntryScreen.tsx       # View 1: Decision input
│   │   ├── ConfirmScreen.tsx     # View 2: Claim alignment checklist
│   │   └── DashboardScreen.tsx   # View 3: Unified memo & live audit
│   ├── features/
│   │   ├── ClaimCard.tsx         # Readable card with verdict badge & consequence
│   │   ├── VerdictBadge.tsx      # Semantic badge (survived, weakened, broken, unresolved)
│   │   ├── EvidenceDrawer.tsx    # Slide-over audit sheet
│   │   └── EvidenceSourceItem.tsx# Real citation link and snippet
```

---

## 5. Design Tokens & Styling Rules

* **Theme:** Dark Mode (`#09090b` canvas, elevated `#18181b` cards, subtle `#27272a` borders, crisp `#f4f4f5` text).
* **Typography:** System sans-serif (`Inter`, system-ui) with relaxed line height (`leading-relaxed` / 1.6) and high-contrast text (`#f4f4f5`) for optimal reading comfort.
* **Verdict Colors:** Reserved strictly for claim verdicts—never used for form validation or decorative badges.
* **Masking Evaluators:** Internal agent names (`devils_advocate`, `receipts`, `builder`) **never appear in the UI**. Only user-facing test types (*Assumption Test*, *Evidence Test*, *Feasibility Test*) are displayed.
