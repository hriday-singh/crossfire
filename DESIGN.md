# Crossfire — UI/UX Design System & Screen Specification

> **Target Audience:** Frontend Developers, UI Engineers, and AI Pair Programmers.  
> **Purpose:** Single source of truth for design tokens, visual consistency, component primitives, layout structure, and view specifications across all Crossfire screens.  
> **Status:** Grounded strictly on the active, working backend API (`POST /cases`, `POST /cases/{id}/confirm`, `GET /cases/{id}/stream`, `GET /cases/{id}`).

---

## 1. Product & UI Philosophy

Crossfire is an **authoritative decision testing memo**, not an AI chatbot, a simulated hacker terminal, or an arcade dashboard. 

### Core UI Principles:
1. **The Executive Decision Memo in Dark Mode:** A high-contrast dark theme designed for deep focus. Deep canvas (`#0e0e11`), elevated surfaces (`#1f1f22`), crisp readable typography (`#e4e1e6`), and a single blue accent (`#60a5fa`).
2. **No Fake Telemetry:** Every progress indicator is backed by a real SSE event (`activity`, `test_started`, `finding_ready`, `verdict_ready`). Animation may frame real state — it may never stand in for it. A counter that is not counting something, or a status that is not read from the run, does not ship.
3. **Internal Evaluator Name Masking (Mandatory Rule):** Internal backend agent names (`devils_advocate`, `receipts`, `builder`, `operator`) **must never appear anywhere in the UI**. They are strictly mapped to test names derived from failure modes:
   - `assumption` $\rightarrow$ **Assumption Test**
   - `evidence` $\rightarrow$ **Evidence Test**
   - `feasibility` $\rightarrow$ **Feasibility Test**
   - `operational_friction` (or `adoption`, `bureaucracy`) $\rightarrow$ **Operational Friction Test**
4. **Color Carries Verdict, Nothing Else:** The four verdict colors are reserved exclusively for claim and test results. Never use red or amber for regular form validation or general badges.
5. **Unresolved is a Measured Outcome:** The status `unresolved` means the system actively investigated and found conflicting or thin evidence. It is styled in **Indigo / Violet (`#818cf8`)**—never gray or disabled.
6. **One Input, Secondary Controls Out of the Way:** The entry view asks exactly one primary question. Attachments, presets, panel selection, and provider/model configuration are secondary affordances around it — never tabs or mode selectors competing with the prompt.
7. **Evidence Always One Click Away:** Every claim card opens a dedicated slide-over sheet (Evidence Drawer) revealing the full audit trail and primary source citations.

---

## 2. Design System Tokens & Consistencies

### 2.1 Color Palette (Dark-First, WCAG AA / AAA)
The interface uses a deep neutral palette engineered for readability, zero glare, and high contrast.

Defined once in `frontend/src/globals.css` and exposed through `frontend/tailwind.config.js`. No component hardcodes a hex.

| Token | CSS Variable / Tailwind | Hex Value | Semantic Usage |
|---|---|---|---|
| **Page canvas** | `bg-surface-container-lowest` | `#0e0e11` | Page root, header, footer |
| **Background** | `--background` / `bg-background` | `#131316` | App shell surface |
| **Card / Surface** | `--card` / `bg-surface-container` | `#1f1f22` | Cards, memo container, drawer surface |
| **Raised surface** | `bg-surface-container-high` | `#2a2a2d` | Hover states, nested panels |
| **Sunken surface** | `bg-surface-container-low` / `--input` | `#1b1b1e` | Inputs, code blocks, badges |
| **Border / Divider** | `--border` / `border-outline-variant` | `#414751` | Card borders, dividers, row separators |
| **Primary Text** | `--foreground` / `text-on-surface` | `#e4e1e6` | Headlines, claim statements, body text |
| **Secondary Text** | `text-on-surface-variant` | `#c1c7d3` | Supporting copy |
| **Muted Text** | `--muted-foreground` / `text-outline` | `#8b919d` | Captions, metadata, queued state |
| **Primary / Action** | `--primary` / `--ring` | `#60a5fa` | Primary buttons, links, focus rings |
| **Primary Foreground** | `--primary-foreground` | `#003a6b` | Text on primary buttons |
| **Secondary** | `--secondary` | `#cebdff` | Secondary accents |
| **Destructive** | `--destructive` / `error` | `#ffb4ab` | Error banners and destructive actions |

### 2.2 Verdict Colors in Dark Mode (Strict Exclusivity)
*These colors are strictly reserved for claim verdicts and test outcomes. Badges use subtle dark translucent backgrounds with matching borders and luminous text.*

Resolved in one place: `getVerdictConfig()` in `frontend/src/lib/formatters.ts`. Components read the label and class tokens from it rather than branching on status themselves.

| Verdict | UI Label | Text / Icon Color | Badge Classes | Visual Meaning |
|---|---|---|---|---|
| `survived` | Survived | `#34d399` (Emerald-400) | `bg-emerald-950/40 border-emerald-500/30` | Claim withstood tests & scrutiny |
| `weakened` + `qualified` | Holds, with limits | `#fbbf24` (Amber-400) | `bg-amber-950/40 border-amber-500/30` | Holds under narrower conditions |
| `weakened` + `contested` | Challenged | `#f97316` (Orange-500) | `bg-orange-950/40 border-orange-500/30` | Disputed by a live counter-position |
| `weakened` (unspecified) | Weakened | `#fbbf24` (Amber-400) | `bg-amber-950/40 border-amber-500/30` | Still standing, but damaged or disputed |
| `broken` | Broken | `#f87171` (Rose-400) | `bg-rose-950/40 border-rose-500/30` | Critical assumption invalidated by evidence |
| `unresolved` | Unresolved | `#818cf8` (Indigo-400) | `bg-indigo-950/40 border-indigo-500/30` | Active outcome: evidence was thin or conflicting |
| *(none)* | Untested | `#71717a` (Zinc-500) | `bg-zinc-800 border-zinc-700` | Not yet reconciled — the **only** legitimate gray |

> The CSS variables `--verdict-survived` / `--verdict-weakened` / `--verdict-broken` / `--verdict-unresolved` (`#a78bfa` for unresolved) back the `text-verdict-*` and `bg-verdict-*` Tailwind utilities used outside badges — charts, dots, and rails.

`weakened_kind` is derived by the backend, never generated: `qualified` (survives in a narrower scope) and `contested` (a live counter-position disputes it) read differently to a decision-maker, so they carry different labels and hues within the same verdict.

> [!CAUTION]
> Do NOT use gray for `unresolved`. Gray is reserved exclusively for inactive or queued UI elements. Reusing gray undermines the core principle that `unresolved` is an active, measured finding.

### 2.3 Typography
Type is a paired token: `font-<name>` sets the family, `text-<name>` sets size, line height, tracking, and weight. Never mix a family token with an unrelated size.

| Token | Family | Size / Line height | Used for |
|---|---|---|---|
| `headline-lg` | Inter | 24 / 32, `-0.02em`, 600 | Screen headlines |
| `headline-md` | Inter | 18 / 24, `-0.015em`, 600 | Card and section titles |
| `headline-sm` | Inter | 15 / 20, `-0.01em`, 600 | Sub-section titles, dialog titles |
| `body-md` | Inter | 14 / 20, 400 | Claim statements, primary body copy |
| `body-sm` | Inter | 13 / 18, 400 | Supporting copy, drawer prose |
| `body-xs` | Inter | 12 / 16, 400 | Metadata, captions |
| `code-lg` | JetBrains Mono | 14 / 20, 500 | Wordmark, engine badge |
| `code-md` | JetBrains Mono | 12 / 16, 500 | Case IDs, source URLs, log lines |
| `code-sm` | JetBrains Mono | 11 / 14, `0.02em`, 400 | Footer, dense terminal-style rows |
| `label-mono` | JetBrains Mono | 10 / 12, `0.06em`, 600 | Uppercase section labels, test-type tags |

Body default is Inter via `globals.css`; monospace stays scoped to identifiers, test labels, URLs, and log output.

### 2.4 Spacing, Radii & Elevation
* **Spacing scale:** named tokens on a 4px cadence — `space-1` (4px), `space-1.5` (6px), `space-2` (8px), `space-2.5` (10px), `space-3` (12px), `space-4` (16px), `space-5` (20px), `space-6` (24px), `space-8` (32px), plus `gutter` (16px). Use `gap-space-4`, `p-space-6`, not raw Tailwind numbers.
* **Corner Radii (tight by design — this is an instrument panel, not a consumer card stack):**
  * `rounded` / `rounded-sm`: 2px — rows, chips, inline tags
  * `rounded-lg`: 4px — cards, panels
  * `rounded-md`: 6px — buttons, inputs
  * `rounded-xl`: 8px — drawers, modals
  * `rounded-full`: 12px — pills (note: *not* a circle in this scale)
* **Shadows:** muted depth only (`shadow-sm`, `shadow-md`, `shadow-lg` over black). No glows, no saturated neon drop shadows.
* **Motion:** transitions on `transform`, `opacity`, `background-color`, and `border-color` only, ~150ms ease-out. `animate-pulse-subtle` is the single shared looping animation. All motion collapses to ~0ms under `prefers-reduced-motion: reduce`, enforced globally in `globals.css` — never re-enable it per component.

---

## 3. UI Component Inventory (Radix / shadcn/ui Mapping)

### 3.1 Shared primitives (`src/components/ui/`)
Radix-backed, styled through the token file. Build once here; never re-implement a variant inside a feature.

| Primitive | File | Notes |
|---|---|---|
| `Button`, `Card`, `Badge`, `Alert`, `Separator`, `Skeleton`, `Textarea` | `button.tsx`, `card.tsx`, … | Token-driven variants only |
| `Sheet` | `sheet.tsx` | Right slide-over used by the Evidence Drawer |
| `Dialog` | `dialog.tsx` | Modal shell for Providers, Settings, History, Export |
| `DropdownMenu` | `dropdown-menu.tsx` | Sort and select menus |
| `ProviderIcon` | `providerIcons.tsx` | Brand marks for provider rows |
| `SerpApiIcon` | `serpapi.tsx` | Attribution mark in header, footer, and evidence rows |

### 3.2 Feature components (`src/components/features/`)

| Component | Role |
|---|---|
| `ClaimCard` | One claim: verdict badge, load-bearing flag, consequence line, evidence entry point, Prompt Fixer selection |
| `EvidenceDrawer` | Full audit trail per claim — tests run, sources, contradictions, what needs to change, how to check, export brief, raw JSON |
| `VerdictBlock` | Case-level result: decision state, headline, deciding factor, claim tallies, next actions |
| `TestRow` | One test's state (`Queued` → running → `Completed`) inside a claim |
| `LiveActivityFeed` | Real-time run narration from `activity` events |
| `ExtractionProgress`, `CubeSpinner` | Honest waiting states during extraction and confirmation |
| `AgentSelectorPanel`, `AssignedAgentsCard` | Auto-selected panel with per-agent rationale; manual pin |
| `AttachmentBar`, `EntryDropzoneBar`, `EntryPresetsBar`, `EntryFooter` | Entry-screen input affordances |
| `PromptFixerWorkbench` | Rewrites the original decision around the claims that broke or weakened |
| `ProvidersModal`, `SettingsModal`, `HistoryModal`, `FaqDrawer`, `LiveLogsDrawer` | Provider/key/model management, engine settings, past cases, FAQ, raw logs |
| `RocketBlueprintHead`, `TechDecorations` | Presentational framing only — never state-bearing |

### 3.3 Canvas & motion (`src/components/canvas/`, `ui/Rocket*`)
`SpaceStarfield`, `StageContainer`, `ConferenceRoom`, `CharacterSprite`, `DevilBotSprite`, `RocketIntroAnimation`, `RocketTrailCanvas`, `CruciblePageTransition`. Decorative layer only: `pointer-events-none` where it overlays content, behind an explicit `z-0`, and fully suppressed under `prefers-reduced-motion`. No run state is ever communicated *only* through this layer.

---

## 4. Per-Screen Specifications

> Literal `zinc-*` class names in the skeletons below predate the token migration and are illustrative of *intent* only. The tokens in §2 govern: `surface-container-*` for surfaces, `outline-variant` for borders, `on-surface` / `on-surface-variant` / `outline` for text.

Three screens, addressed by `state.activeScreen` in `CaseContext` and mirrored in the header's stage nav: **01 Ingestion** (`entry`), **02 Claim Map** (`confirm`), **03 Live Runner** (`runner` / `dashboard`). The header also carries the wordmark (click resets the case) and a live engine badge showing the active provider and model, which opens Settings.

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

### Screen 2b: Needs-Input / Clarify State

#### Purpose:
`Case.status == "needs_input"` — extraction found nothing testable. This is a conversation, not an error.

#### Specifications:
- The `gate_message` is a real clarifying question referencing the user's own words. Never render it as an error banner and never use destructive colors.
- `clarify_missing` renders as 2–3 short chips naming the absent pieces (the option, the cost, the deadline, the alternative).
- `clarify_interpretation` renders as a quiet *"Reading it as: …"* line so a misreading can be corrected rather than guessed at.
- `provisional` claims render with a distinct "inferred" marker and are individually acceptable or removable. They must never look identical to a confirmed claim.
- The answer field posts to `POST /cases/{id}/clarify`. On success the run starts immediately — no second confirmation step.

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

- [x] **Tokens Only:** No hardcoded hex, px, or one-off color anywhere in a component. New colors are added to `globals.css` first.
- [x] **Dark-First Readability:** Canvas `#0e0e11`, surfaces `#1f1f22`, text `#e4e1e6`, one blue accent `#60a5fa`.
- [x] **No Fake Telemetry:** Every progress indicator traces to a real SSE event. Decorative canvas and rocket layers never carry state on their own.
- [x] **Strict Verdict Colors:** Emerald (`survived`), Amber / Orange (`weakened`, split by `weakened_kind`), Rose (`broken`), Indigo (`unresolved`). Gray means *untested*, nothing else.
- [x] **Evaluator Masking:** Internal agent ids (`devils_advocate`, `receipts`, `researcher`, `builder`, `operator`, `overthinker`) never appear in the UI — `formatTestName()` maps them to *Assumption / Evidence / Feasibility / Operational Friction Test*.
- [x] **Real Backend Contracts:** Aligns with `POST /cases`, `/cases/{id}/clarify`, `/cases/{id}/confirm`, `GET /cases/{id}/stream`, `GET /cases/{id}`, `/cases/{id}/improve_prompt`, and `/providers/*`.
- [x] **Responsive & Accessible:** Mobile-first single-column reading layouts, keyboard-navigable Radix primitives, WCAG AA contrast from the token palette, and `prefers-reduced-motion` honored globally.
- [x] **Tested:** Every changed component, hook, reducer, and formatter has a unit test under `frontend/src/tests/`, and `npm run test:all` passes. See `frontend/TESTING.md`.

