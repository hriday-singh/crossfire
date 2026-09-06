# Crossfire — UI/UX Design System & Stitch Screen Specification

> **Target Audience:** Google Stitch, Claude Designer, v0, Frontend Developers, and UI Engineers.
> **Purpose:** Single source of truth for design tokens, visual consistency, component primitives, layout skeletons, and ready-to-paste Stitch prompts across all Crossfire views.

---

## 1. Product & UI Philosophy

Crossfire is a **crash-test rig for decisions**, not an AI chatbot or a decorative dashboard. 

### Core UI Principles:
1. **CI Test Runner Mental Model:** The interface behaves like GitHub Actions, Vercel deployments, or a terminal test suite—flat, dense, dark, monospace-accented, and strictly state-driven.
2. **Never a Persona Chat:** No avatars, speech bubbles, persona names, or chat transcripts. 
3. **Internal Evaluator Name Masking (Mandatory Rule):** Internal backend agent names (`devils_advocate`, `receipts`, `builder`, `overthinker`) **must never appear anywhere in the UI**. They are strictly mapped to test names derived from failure modes:
   - `assumption` $\rightarrow$ **Assumption Test**
   - `evidence` $\rightarrow$ **Evidence Test**
   - `feasibility` $\rightarrow$ **Feasibility Test**
   - `edge-case` $\rightarrow$ **Edge-Case Test**
4. **Color Carries Verdict, Nothing Else:** The four verdict colors are reserved exclusively for claim and test results. Never use red or amber for regular form validation or warnings.
5. **Unresolved is a First-Class Outcome:** The status `unresolved` means the system actively investigated and found conflicting or thin evidence. It is styled in **Violet/Indigo**—never gray or disabled.
6. **One Input, Zero Mode Menus:** The entry view has exactly one primary question: *"What are you considering?"*. No tabs, no mode selectors ("Validate Idea" vs "Fact Check").
7. **Evidence Always One Click Away:** Every claim card opens a dedicated slide-over sheet (Drawer) revealing the full audit trail and evidence citations.

---

## 2. Design System Tokens & Consistencies

### 2.1 Color Palette (Dark Mode Only)
All screens are strictly dark mode (`.dark` on `<html>` with a `zinc-950` baseline). Contrast is tuned for WCAG AA compliance.

| Token | CSS Variable / Tailwind | Hex Value | Semantic Usage |
|---|---|---|---|
| **Background** | `--background` / `bg-zinc-950` | `#09090b` | Page root canvas |
| **Card / Surface** | `--card` / `bg-zinc-900` | `#18181b` | Cards, test rows, drawer surface, modals |
| **Subtle Hover** | `--muted` / `bg-zinc-800` | `#27272a` | Card hover state, active row background |
| **Border / Divider** | `--border` / `border-zinc-800` | `#27272a` | Row dividers, card borders, drawer edge |
| **Primary Text** | `--foreground` / `text-zinc-100` | `#f4f4f5` | Headlines, claim statements, primary body |
| **Secondary Text** | `--muted-foreground` / `text-zinc-400` | `#a1a1aa` | Captions, confidence values, timestamps, queued state |
| **Primary / Action** | `--primary` / `bg-blue-400` | `#60a5fa` | Action buttons, active focus rings, SSE live dot |
| **Primary Foreground** | `--primary-foreground` | `#09090b` | Text on primary blue buttons |

### 2.2 Verdict Colors (Strict Exclusivity)
*These colors are strictly reserved for claim verdicts and test outcomes.*

| Verdict | Semantic Role | Hex Value | Lucide Icon | Visual Meaning |
|---|---|---|---|---|
| `survived` | Success | `#34d399` (Emerald) | `circle-check` | Claim withstood tests & scrutiny |
| `weakened` | Caution | `#fbbf24` (Amber) | `triangle-alert` | Still standing, but damaged or disputed |
| `broken` | Destructive | `#f87171` (Red) | `circle-x` | Critical assumption invalidated by evidence |
| `unresolved` | Measured Uncertainty | `#a78bfa` (Violet) | `circle-help` | Active outcome: evidence was thin or contradictory |

> [!CAUTION]
> Do NOT use gray for `unresolved`. Gray is reserved exclusively for inactive or queued UI elements. Reusing gray undermines the core principle that `unresolved` is an active, measured finding.

### 2.3 Typography
* **UI & Body Stack:** `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  * Applied to: Headlines, prompts, claim statements, descriptions, recommendations.
* **Monospace Stack:** `ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`
  * Applied to: Test labels (e.g. `ASSUMPTION TEST`), Case IDs, source URLs, confidence scores, impact meter chips.

### 2.4 Spacing, Radii & Elevation
* **Base Grid:** 4px / 8px spacing cadence (`gap-2`, `gap-3`, `gap-4`, `p-4`, `p-6`).
* **Corner Radii:**
  * Cards / Drawers: `8px` (`rounded-lg`)
  * Buttons / Inputs: `6px` (`rounded-md`)
  * Badges / Chips / Tags: `4px` or full pill (`rounded-md` or `rounded-full`)
* **Shadows:** Restrained, dark elevation (`shadow-sm`, `shadow-md` using `rgba(0,0,0,0.5)`). No bright glows.
* **Transitions:** 150ms ease-out on background and opacity. No bouncing or heavy layout shifts.

---

## 3. UI Component Inventory (Radix / shadcn/ui Mapping)

| UI Element | Base Primitive | Custom Styling / Behavior |
|---|---|---|
| **Entry Textarea** | `Textarea` (shadcn) | Auto-expanding, min-height 120px, card background, focus ring `#60a5fa` |
| **Primary CTA** | `Button` (shadcn) | Background `#60a5fa`, text `#09090b`, hover brightness-110, font-medium |
| **Claim Card** | `Card` (shadcn) | `#18181b` background, 1px border `#27272a`, hover `#27272a`, cursor-pointer |
| **Verdict Badge** | `Badge` (shadcn) | Borderless or subtle tint background, verdict text + corresponding Lucide icon |
| **Impact Meter** | Custom component | 3 horizontal monochrome bars (`--foreground` filled, `--border` empty) |
| **Load-Bearing Flag** | `Anchor` / `Flag` icon | Rendered in `--foreground` next to claim title; tooltip: *"Load-bearing assumption"* |
| **Evidence Drawer** | `Sheet` (shadcn) | Right slide-over, 460px width, `#18181b` background, left border `#27272a` |
| **Live SSE Dot** | `span` / SVG dot | 8px circle, `#60a5fa`, subtle opacity pulse (1.5s interval) while connected |
| **Error Banner** | `Alert` (shadcn) | Low-opacity `#f87171` background, 3px solid left border in `#f87171` |
| **Settings Modal** | `Dialog` (shadcn) | Centered modal, `#18181b` background, Select dropdowns for model provider |

---

## 4. Per-Screen Specifications & Ready-to-Paste Stitch Prompts

Use these prompts directly in Stitch (or v0/Claude Designer) to generate pixel-accurate, consistent screens.

---

### Screen 1: Decision Entry & Ingestion View

#### Screen Purpose:
The distraction-free starting point. Accepts the user's raw proposal, bet, or strategy dilemma. Includes an optional context dropzone for future PDF/URL ingestion (`ingestion/pdf.py` and Scrapling).

#### Layout Skeleton:
- **Global Header:** Small wordmark `"Crossfire"` in top-left viewport (`text-zinc-400`).
- **Main Canvas:** Centered single column, max-width `640px`, vertically centered in viewport.
- **Form Elements:**
  - Label: `"What are you considering?"` (18px, font-medium, `text-zinc-100`).
  - Textarea: Auto-growing, ~120px height, background `#18181b`, border `#27272a`.
  - Context Dropzone (Optional attachment): Small dashed box below textarea: `"+ Attach pitch deck (PDF) or paste link (URL)"`.
  - Action Row: Right-aligned primary button: `"Test this"` (`bg-blue-400 text-zinc-950 font-medium`).
- **Loading State:** Upon submission, the input area swaps to 3 skeleton bars with caption: *"Breaking this into claims..."*.

#### Copy-Paste Stitch Prompt:
```text
Design a dark-mode web screen for a tool called "Crossfire", using this exact design system:
- Background: #09090b
- Card/Surface: #18181b
- Border: #27272a
- Primary Text: #f4f4f5
- Muted Text: #a1a1aa
- Accent/Primary Button: #60a5fa (text #09090b)
- Fonts: Sans-serif for UI, Monospace for technical labels.
- Corner Radius: 8px for cards, 6px for buttons/inputs.

Layout & Content:
1. Top bar: Full-width, clean and sparse. Left side has a simple muted wordmark: "CROSSFIRE" in uppercase tracking-wider sans-serif.
2. Centered main column: Max width 640px, vertically centered on screen.
3. Form:
   - Header label: "What are you considering?" (medium weight, #f4f4f5).
   - A large dark textarea (~130px tall, #18181b surface, 1px border #27272a, rounded-md) with placeholder: "I want to build an AI that helps students apply to college, including submitting applications on their behalf."
   - Directly underneath, a compact, subtle dashed border area with paperclip icon: "Attach pitch deck (PDF) or paste URL for context (optional)".
   - Bottom row: Right-aligned primary button with label "Test this" (background #60a5fa, bold dark text #09090b, rounded-md, px-5 py-2.5).

Style: Clean, restrained, developer-tool aesthetic (like GitHub or Vercel). No gradients, no illustrations, no 3D elements, no chat bubbles.
```

---

### Screen 2: Claim Map Confirmation View

#### Screen Purpose:
The critical alignment gate. Displays the AI-extracted assumptions before any tests or searches are executed, allowing the user to edit, delete, or add claims.

#### Layout Skeleton:
- **Placement:** Single column, max-width `720px`, left-aligned near top (not vertically centered).
- **Header:** Paraphrased decision echo: `"Here is what I think you're deciding:"` followed by user decision statement.
- **Claim Stack:** 4 compact cards (`#18181b`, border `#27272a`, padding 16px, gap 12px).
  - Left: Claim statement text (`#f4f4f5`).
  - Right: Subtle `×` delete icon (`#a1a1aa`, hover `#f87171`).
  - Interaction: Clicking card allows inline text editing.
- **Footer Controls:**
  - Left: `"+ Add an assumption"` (plain text button, `#a1a1aa`).
  - Right: Primary CTA `"Confirm and run tests"` (`bg-blue-400 text-zinc-950`).

#### Copy-Paste Stitch Prompt:
```text
Design a dark-mode confirmation screen for "Crossfire" using:
- Background: #09090b, Card: #18181b, Border: #27272a, Text: #f4f4f5, Muted: #a1a1aa, Primary: #60a5fa.

Layout & Content:
1. Top bar: "CROSSFIRE" wordmark top-left in muted text.
2. Main Content: Single column, max-width 720px, left-aligned, 40px padding top.
3. Decision Echo:
   - Caption: "Here's what I think you're deciding:" in #a1a1aa (text-sm).
   - Statement: "Whether to build an AI that helps students apply to college, including submitting applications on their behalf." (text-lg, #f4f4f5, font-medium).
4. Extracted Assumptions List:
   - A vertical stack of 4 cards (background #18181b, border #27272a, rounded-lg, p-4, mb-3).
   - Each card has the assumption text on the left, and a small muted "×" delete icon on the top-right.
   - Use these 4 assumption statements:
     Card 1: "Students will trust an AI to submit applications on their behalf."
     Card 2: "There's no existing competitor already solving this well."
     Card 3: "The onboarding screen should use a dark theme."
     Card 4: "The AI can reliably parse arbitrary college application portal formats without per-school custom integration."
   - Note: Do NOT show status badges, colors, or test results here—they have not been tested yet!
5. Bottom Actions Row (flex items-center justify-between mt-6):
   - Left: Plain text button "+ Add an assumption" in #a1a1aa hover:text-white.
   - Right: Primary button "Confirm and run tests" in solid #60a5fa with dark text #09090b.

Style: Restrained form interface. Feels like a fast review-and-confirm gate in a developer CI tool.
```

---

### Screen 3: Live Test Runner View (Streaming CI Matrix)

#### Screen Purpose:
The signature live execution screen. Connects to the Server-Sent Events (SSE) stream and shows tests executing in parallel across claims.

#### Layout Skeleton:
- **Top Bar (56px):**
  - Left: `"Crossfire"` wordmark + 8px pulsing `#60a5fa` live indicator dot (*"Connected"*).
  - Right: Live counter badge: `"4 tests queued · 2 running · 0 completed"`.
- **Main Container:** Max-width `960px`, centered.
- **Claim Test Matrix:**
  - One card per claim.
  - Inside each claim card: Claim statement + nested test rows.
  - Test Row States:
    - *Queued:* Muted dashed circle icon, label `ASSUMPTION TEST`, status "Queued".
    - *Running:* Spinning or pulsing indicator, subtle row highlight, label `EVIDENCE TEST`, status "Searching sources...".
    - *Finding Attached:* Sub-row appears with a 1-line summary and confidence meter.

#### Copy-Paste Stitch Prompt:
```text
Design a dark-mode live test runner screen for "Crossfire", mirroring a developer CI/CD dashboard (like GitHub Actions test execution).
Palette: Background #09090b, Card #18181b, Border #27272a, Text #f4f4f5, Muted #a1a1aa, Primary Blue #60a5fa.
Status Colors: Emerald #34d399, Amber #fbbf24, Red #f87171, Violet #a78bfa.

Header Bar (56px tall, border-b #27272a, px-6):
- Left: "CROSSFIRE" wordmark in #f4f4f5, next to an 8px glowing blue dot (#60a5fa) labeled "LIVE STREAM" in monospace text-xs #60a5fa.
- Right: Monospace status counter: "TESTING IN PROGRESS — 2 OF 4 COMPLETED".

Main Content (Centered column, max-width 960px, py-8):
A vertical list of Claim Test Groups (gap-4):

Group 1 (In Progress):
- Card container (#18181b, border #27272a, rounded-lg, p-5).
- Header: Claim statement "Students will trust an AI to submit applications on their behalf." (font-medium #f4f4f5).
- Nested test rows (gap-2 mt-3):
  * Row 1: Running state. Left has a spinning blue circle icon (#60a5fa), monospace label "ASSUMPTION TEST", status text "Evaluating behavioral resistance...".
  * Row 2: Queued state. Left has a dashed circle icon (#a1a1aa), monospace label "EVIDENCE TEST", status text "Queued".

Group 2 (Resolved):
- Card container (#18181b, border #27272a, rounded-lg, p-5).
- Header: Flag icon (load-bearing) + "There's no existing competitor already solving this well."
- Badge top-right: "Broken" in #f87171 with circle-x icon.
- Nested test row: Resolved icon (circle-x in #f87171), monospace label "EVIDENCE TEST", excerpt "Found 1 direct competitor (CollegeAI, $12M seed).".

Style: Flat, dense, monospace-accented, no playful avatars or chat elements. Pure developer CI execution feel.
```

---

### Screen 4: Results & Verdict Dashboard View

#### Screen Purpose:
The persistent executive overview when all tests finish. Prioritizes load-bearing assumptions and presents clear, evidence-backed verdicts.

#### Layout Skeleton:
- **Top Scoreboard Banner (56px):**
  - Left: `"Crossfire"` wordmark.
  - Right: Headline counter: `"4 of 4 claims tested — 1 survived, 1 weakened, 1 broken, 1 unresolved"`.
- **Main Matrix (Max-width 960px):**
  - Claim Cards sorted by: **Load-bearing first**, then by severity (Broken $\rightarrow$ Unresolved $\rightarrow$ Weakened $\rightarrow$ Survived).
  - Each Card Contains:
    - Load-bearing indicator (Flag/Anchor icon) if true.
    - Full claim statement.
    - Verdict Badge with Icon:
      - 🟢 `Survived` (`#34d399`, `circle-check`)
      - 🟡 `Weakened` (`#fbbf24`, `triangle-alert`)
      - 🔴 `Broken` (`#f87171`, `circle-x`)
      - 🟣 `Unresolved` (`#a78bfa`, `circle-help`)
    - Confidence score (e.g. `0.81` in muted monospace).
    - Impact Meter (3 horizontal bars: High = 3 filled, Medium = 2 filled, Low = 1 filled).
    - Excerpt of recommended decision update.
    - Affordance: Subtle hover glow and right chevron indicating click to open Evidence Drawer.

#### Copy-Paste Stitch Prompt:
```text
Design a dark-mode results dashboard for "Crossfire".
Palette:
- Background: #09090b
- Card: #18181b
- Border: #27272a
- Text: #f4f4f5
- Muted: #a1a1aa
- Verdict Survived: #34d399 (Emerald)
- Verdict Weakened: #fbbf24 (Amber)
- Verdict Broken: #f87171 (Red)
- Verdict Unresolved: #a78bfa (Violet)

Top Navigation Bar:
- Full-width, 56px, border-b #27272a.
- Left: "CROSSFIRE" wordmark.
- Right: Monospace summary banner: "4 of 4 claims tested — 1 survived, 1 weakened, 1 broken, 1 unresolved".

Main Content (Centered, max-width 960px, py-8, gap-4):
Stacked claim cards (each card is clickable, hover:border-zinc-700, p-5, rounded-lg, #18181b):

Card 1 (Broken & Load-bearing):
- Left side: An anchor/flag icon with tooltip "Load-bearing", followed by claim text: "There's no existing competitor already solving this well." (text-base font-medium #f4f4f5).
- Right side: Badge with circle-x icon and text "Broken" in solid red #f87171 (dark text #09090b), confidence "0.81" in muted monospace.
- Bottom sub-line: Impact meter showing 3 of 3 filled bars (High Impact) + monospace test tag "EVIDENCE TEST" + excerpt: "CollegeAI raised $12M for automated application platform."

Card 2 (Weakened & Load-bearing):
- Left: Flag icon + "Students will trust an AI to submit applications on their behalf."
- Right: Badge with triangle-alert icon "Weakened" in amber #fbbf24, confidence "0.62".
- Bottom: 2 of 3 bars (Medium Impact) + "ASSUMPTION TEST" + excerpt: "42% of students require a manual review step before submission."

Card 3 (Unresolved & Load-bearing):
- Left: Flag icon + "The AI can reliably parse arbitrary college application portal formats without custom integration."
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

#### Copy-Paste Stitch Prompt:
```text
Design a dark-mode slide-over drawer (Sheet) anchored to the right edge of the screen for "Crossfire".
Palette: Surface #18181b, Left border #27272a, Text #f4f4f5, Muted #a1a1aa, Accent Blue #60a5fa, Red #f87171.
Dimensions: 460px wide, 100vh tall, scrollable content, 24px internal padding.

Header:
- Top bar with section title "AUDIT TRAIL & EVIDENCE" in monospace text-xs tracking-wider text-zinc-400.
- Close "×" button on top-right (#a1a1aa).

Sections (stacked vertically, each with a small uppercase monospace label in #a1a1aa and 20px spacing):

1. CLAIM
   "There's no existing competitor already solving this well." (text-base font-medium #f4f4f5)

2. WHY IT MATTERS
   "If this is false, the plan changes materially — this claim is load-bearing to the entire decision." (text-sm text-zinc-300)

3. TESTS RUN
   Monospace chip: [ EVIDENCE TEST · COMPLETED ]

4. EVIDENCE FOUND
   A citation card (#09090b background, border #27272a, rounded-md, p-3.5):
   - Title/Link: "CollegeAI raises $12M for automated application platform" (with an external-link icon, #60a5fa, text-sm font-medium).
   - Snippet: "CollegeAI already offers end-to-end application drafting and submission with human-in-the-loop review, live since March 2026." (text-xs text-zinc-300 mt-1.5 leading-relaxed).

5. STATUS & IMPACT
   - Reconciled Verdict Badge: "Broken" in red #f87171 with circle-x icon.
   - Impact Meter: 3 filled horizontal segments [■ ■ ■] "High Decision Impact".

6. WHAT CHANGES
   A prominent blockquote (#27272a border-l-2 pl-3 py-1 text-sm text-zinc-200):
   "Differentiate on a visible review-and-audit trail rather than a 'first to market' claim."

7. NEXT VALIDATION STEP
   A highlighted action box (border border-blue-400/30 bg-blue-400/5 rounded-md p-3):
   - Label in #60a5fa (text-xs font-mono uppercase): "RECOMMENDED EXPERIMENT"
   - Body: "Direct trial of CollegeAI's product to map exact feature gaps before writing code."

Style: Dense, readable, journalistic audit trail.
```

---

### Screen 6: System & Test Error States

#### Screen Purpose:
Illustrates non-destructive error handling. If a single web query fails, only that test row flags an inline warning; if a pipeline error occurs, a global alert banner appears with a technical disclosure.

#### Copy-Paste Stitch Prompt:
```text
Design dark-mode error and warning states for "Crossfire".
Palette: Surface #18181b, Border #27272a, Text #f4f4f5, Muted #a1a1aa, Red #f87171, Amber #fbbf24.

State 1: Global Pipeline Error Banner (Top of page):
- Container: Full width, 52px tall, background rgba(248, 113, 113, 0.1), solid 3px left border in #f87171, rounded-md, px-4 flex items-center justify-between.
- Left: Red triangle-alert icon (#f87171) next to text: "Unable to reconcile claim findings due to a provider timeout." (#f4f4f5 text-sm).
- Right: Text button "Details" (#a1a1aa, text-xs underline) with a collapsed JSON snippet viewer.

State 2: Inline Row-Level Failure (Inside a Claim Card):
- A single test row inside the matrix displaying an inline amber warning:
  * Monospace tag: "EVIDENCE TEST"
  * Warning icon in #fbbf24: "Source search returned no index hits (query timeout). Claim marked unresolved."
  * The rest of the claim card and other tests continue functioning normally without crashing.
```

---

### Screen 7: Side-by-Side "Reality Check" Demo View (Future Python Feature)

#### Screen Purpose:
The presentation split-screen route (`/demo`) designed to demonstrate Crossfire's core thesis: standard AI chat flattery vs. Crossfire's brutal crash test.

#### Layout Skeleton:
- **Two-Column Split Layout:** (50% / 50% split on desktop).
- **Left Column ("Standard Frontier AI Chat"):**
  - Typical chat interface.
  - Prompt: *"I want to build an AI that applies to colleges for students..."*
  - Response: Overly polite, sycophantic praise: *"That sounds like an incredible startup idea! Here are 5 reasons why it will succeed..."*
- **Right Column ("Crossfire Crash Test"):**
  - Crossfire's structured CI results card set showing the broken assumptions, competitor citation ($12M funded competitor), and required strategy shift.

#### Copy-Paste Stitch Prompt:
```text
Design a dark-mode split-screen comparison demo for "Crossfire" showing:
Left Side: "Standard AI Model Call" vs Right Side: "Crossfire Crash Test".
Palette: #09090b background, #18181b card, #27272a border, #f4f4f5 text, #60a5fa blue, #f87171 red.

Top Bar: Title "WHY CROSSFIRE: THE REALITY CHECK" (centered, monospace text-sm tracking-wider #a1a1aa).

Left Column (50% width, p-6, border-r border-zinc-800):
- Subheader: "TRADITIONAL LLM CHAT (Sycophantic Agreement)" in text-xs text-zinc-400 font-mono.
- A standard chat bubble layout:
  * User prompt: "I want to build an AI that submits college applications for students."
  * AI response (polite, uncritical text block): "That is a brilliant and disruptive idea! Students are stressed, and automating this could save hundreds of hours. You could expand into scholarships and high school counseling..."
  * Caption at bottom in #f87171: "Verdict: False confidence. Fails to identify existing competitors or student trust hesitation."

Right Column (50% width, p-6):
- Subheader: "CROSSFIRE CRASH TEST (Evidence & Stress Testing)" in text-xs text-blue-400 font-mono.
- Crossfire's structured card:
  * Broken Claim: "No existing competitor already solving this." (Red badge, circle-x).
  * Evidence citation: "CollegeAI raised $12M, live since March 2026."
  * Weakened Claim: "Students trust fully autonomous submission." (Amber badge, 42% refusal rate).
  * Strategy update: "Pivot to human-in-the-loop audit trail."
  * Caption at bottom in #34d399: "Verdict: 1 broken, 1 weakened. Saved 6 months of building the wrong product."

Style: Sharp contrast between unstructured chatbot fluff on the left and rigorous structured CI testing on the right.
```

---

### Screen 8: Provider & Engine Configuration Modal

#### Screen Purpose:
Allows switching between AI models (Gemini, Claude, GPT-4o, and local Ollama) and entering API keys or custom endpoints.

#### Copy-Paste Stitch Prompt:
```text
Design a dark-mode settings dialog modal for "Crossfire".
Palette: Background #09090b, Dialog Surface #18181b, Border #27272a, Text #f4f4f5, Muted #a1a1aa, Primary #60a5fa.
Width: 480px centered on screen with backdrop overlay (rgba(0,0,0,0.7)).

Modal Content:
1. Header: "Engine & Model Provider Settings" (font-medium text-lg #f4f4f5) with close "x" button top-right.
2. Form Fields (stacked with 16px gap):
   - Field 1: Active Provider (Dropdown Select):
     Options: "Google Gemini 2.5 Pro (Active)", "Anthropic Claude 3.7 Sonnet (Coming Soon)", "OpenAI GPT-4o (Coming Soon)", "Local Ollama Endpoint".
   - Field 2: Local Server URL (Input box with placeholder "http://localhost:11434").
   - Field 3: API Key (Password input with masked dots and a "Show" toggle).
   - Field 4: Search Verification Engine: Fixed label "Tavily Search API (Connected)".
3. Footer Actions:
   - "Cancel" button (#a1a1aa text).
   - "Save & Apply" primary button (solid #60a5fa with dark text #09090b).
```

---

### Screen 9: Case History & Run Library Drawer

#### Screen Purpose:
A slide-out drawer on the left side allowing users to browse previously tested decisions and compare revisions.

#### Copy-Paste Stitch Prompt:
```text
Design a dark-mode left slide-out sidebar/drawer for "Crossfire" representing "Recent Crash Tests".
Dimensions: 360px wide, full viewport height, anchored to left edge, background #18181b, border-r #27272a, p-5.

Header:
- "PAST CRASH TESTS" (monospace text-xs tracking-wider text-zinc-400).
- Close "×" top-right.

List of Past Runs (gap-3 mt-4):
- Item 1 (Selected/Active):
  * Date: "Today, 14:20" (text-xs text-zinc-400 font-mono)
  * Title: "College application submission AI" (text-sm font-medium #f4f4f5)
  * Mini status pill: "1 survived · 1 weakened · 1 broken · 1 unresolved" with miniature color dots.
- Item 2:
  * Date: "Yesterday"
  * Title: "Unlimited free-tier SaaS inference unit economics"
  * Mini status pill: "2 broken · 1 survived"
- Item 3:
  * Date: "3 days ago"
  * Title: "Micro-SaaS SEO agent for local dentists"
  * Mini status pill: "3 survived · 1 weakened"

Footer:
- Button: "+ Test a new decision" (w-full, border border-zinc-700 bg-zinc-800 text-sm font-medium py-2 rounded-md).
```

---

## 5. Design Verification Checklist for Stitch Generation

When reviewing mockups generated by Stitch or other tools, verify:
- [ ] **No Persona Names:** Does any text mention `Devil's Advocate`, `Receipts`, or `Builder`? *(If yes, fail and replace with test names: Assumption Test, Evidence Test, Feasibility Test).*
- [ ] **No Gray Unresolved:** Is `unresolved` rendered in violet/indigo (`#a78bfa`) with a help icon? *(Never gray).*
- [ ] **Contrast Compliance:** Is all secondary text clearly legible against `#09090b` / `#18181b`?
- [ ] **No Avatars/Chat Bubbles:** Is the interface structured as cards, rows, and drawers rather than a message stream?
- [ ] **Monospace Integrity:** Are test labels, status counters, and URLs rendered in monospace?
- [ ] **Actionable Consequence:** Does the evidence drawer include both *What Changes* and *Next Validation Step*?
