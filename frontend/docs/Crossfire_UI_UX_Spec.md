# Crossfire — UI/UX Specification

This is the build spec for the frontend, written the same way `crossfire_backend_spec.md` was written for the backend: from the confirmed idea-level docs (`Crossfire_Consolidated_Direction.md`, `Crossfire_Consolidated_Directionplan.md`) plus the UI-direction decisions locked in during this pass. Where the idea docs already decided something about UI ("read like a test runner, never a character chat"), this doc treats that as fixed and builds on it. Where they explicitly deferred something to "the UI/UX conversation" (the claim-confirmation screen's look, the evidence drawer's visual design, `DecisionConsequence.impact`'s exact shape), this doc resolves it.

- Framework: React, talking to the backend over the SSE stream defined in backend spec section 7.
- Styling: Tailwind CSS + shadcn/ui (Radix primitives, CSS-variable theming, `lucide-react` icons — shadcn's default icon set).
- Mode: dark only. No light theme, no toggle. One less surface to design, test, and get wrong in 48 hours.
- Ambition level: polished but simple. Clean execution of a known interface pattern (CI dashboard), not a custom design system. Every visual decision below optimizes for "fast to build correctly" over "distinctive."
- No 3D. See section 9.

---

## 1. Why this direction, in one paragraph

The product pivoted away from "AI agent council" to a claims-testing system, and the idea docs already followed that pivot to its UI conclusion without calling it a UI decision: *"What the user sees is the test name, not the persona... The interface should read like a test runner or CI dashboard, never like a character chat"* (Direction doc, section 6). That sentence rules out avatars, chat bubbles, persona voices, and anything that dramatizes the panel as characters. It also, less obviously, rules out the original 3D/animation plan — that plan was designed for a product about visualizing agents, and the product isn't about agents anymore, it's about claims, tests, and verdicts. A CI-dashboard reading of that mandate is: **flat, dense, dark, monospace-accented, state-driven.** Think GitHub Actions or a Vercel deployment page, not a chat product, not a data-viz showcase.

## 2. Design principles

These are the rules every screen and component below has to satisfy. When a build decision isn't covered by this spec, check it against these first.

1. **Test name, not persona.** No evaluator name (`devils_advocate`, `receipts`, `builder`, `overthinker`) ever renders in the UI, in a tooltip, or in an error message. Only the test name derived from `failure_mode` (section 5.3). This is a hard rule, not a style preference — it's the one line from the docs most likely to get accidentally violated by a developer who reaches for `finding.evaluator` because it's the field sitting right there in the API response.
2. **State over conversation.** Every screen is a structured view of `Case` fields (claims, test_plan, findings, consequences, status) — never a transcript, never a scrollback of "messages."
3. **Unresolved is a real, first-class outcome**, not a fallback or an error. It needs to look like a deliberate state (its own color, its own icon), never gray-and-apologetic.
4. **Color carries verdict, nothing else.** The four verdict colors (section 4.1) are reserved exclusively for claim/test status. Don't reuse "red" for a form validation error and a broken claim on the same screen — pick a different visual language for the two so they're never confusable at a glance.
5. **Never a mode menu.** Section 3 of the Direction doc is explicit: one input box, one question, no "Validate an idea / Fact-check a claim / Analyze a document" picker. The entry screen (section 3.1) has exactly one field.
6. **Evidence is always one click away, never buried.** Every claim, at every state, has a visible affordance to open its evidence drawer — including `unresolved` claims with zero evidence, where the drawer should say so plainly rather than being disabled/hidden.
7. **Restraint is the aesthetic.** Every animation, transition, and piece of motion has to earn its place against the CI-dashboard reference point. Default to none; add one only where section 8 specifies it.

## 3. Screens

Six screens/states cover the whole product. Numbered in the order a user moves through them.

### 3.1 Entry screen

- One large text input, one prompt above it: **"What are you considering?"** (Direction doc section 3, verbatim wording already agreed).
- One button: "Test this."
- No mode picker, no tabs, no examples carousel. Optionally, small muted-foreground placeholder text cycling through 1-2 example inputs (e.g. "I want to build an AI that helps students apply to college") for orientation — text only, no illustration, no animation on load.
- Submitting calls `POST /cases`. While `extract_claims()` runs (`Case.status == "extracting"`), replace the input area with a skeleton state (shadcn `Skeleton`, 3-4 lines suggesting claims are forming) plus a small muted caption ("Breaking this into claims..."). No spinner-and-percentage — there's no meaningful progress fraction at this stage, so don't fake one.
- On completion, route to 3.2.

### 3.2 Claim map confirmation

Maps to `Case.status == "awaiting_confirmation"` and the `claim_map_ready` SSE event. This is the checkpoint the Direction doc (section 11) insists must be visible, not backend-only — "keeping this screen small and plain is fine and expected. Hiding it entirely is the part being corrected."

- Header restates the decision back to the user in one line (echoing `Case.raw_input`, lightly reformatted if needed — a real paraphrase, not a verbatim dump, so the user can confirm Crossfire understood them).
- Below it, the claim list: each `Claim` as a compact card/row with its `statement` text, editable inline (contentEditable or a controlled `Textarea` swapped in on click) and a delete (×) affordance. No `load_bearing` or `status` shown yet — those don't exist until after confirmation, so don't imply otherwise.
- An "Add a claim" affordance (plain text link/button, not a prominent CTA — this is a secondary path).
- One primary button: "Confirm and run tests" → `POST /cases/{id}/confirm`.
- This screen has no live/streaming element. It's a static, editable form. Keep it exactly that plain — this is the one screen in the whole product that should feel like filling out a short form, not watching a system work.

### 3.3 Live test run (the core CI-dashboard screen)

This is the screen the whole visual direction is built around. Drives off the SSE stream (`GET /cases/{id}/stream`) once `Case.status == "testing"`.

Layout: a vertical list of test rows, one per `TestPlanItem`, each behaving like a CI job row:

| SSE event | Row state | Visual |
|---|---|---|
| (test plan built, before `test_started`) | Queued | Row present, muted, small circle-dashed icon, test name + target claim, no timestamp |
| `test_started` | Running | Icon becomes an animated (spin or pulse, pick one, not both) indicator; row background gets a very subtle highlight |
| `finding_ready` | Finding attached | A findings summary line appears under the row (confidence, one-line `reasoning` excerpt); row itself stays "running" until its claim's verdict lands, since one claim can have multiple tests/findings |
| `verdict_ready` | Resolved | Icon swaps to the verdict icon/color (section 4.1); row becomes clickable to open the evidence drawer |
| `consequence_ready` | Decision consequence attached | A small "impact" chip appears on the row (section 5.4) |
| `run_complete` | Run done | A persistent header banner: "N of M claims tested. X survived, Y weakened, Z broken, W unresolved." (the literal live-counter framing from Direction doc section 6 — "Assumption Test: 2 of 3 held" is this same pattern applied per-claim) |
| `error` | Errored | Row or global banner (depends on `stage` — see 3.6) |

Group rows by `target_claim`, not by arrival order — a user thinks in claims, not in the arbitrary order `asyncio.gather` resolves them. Within a claim's group, list its tests in the order `build_test_plan()` produced them.

Test name displayed = mapped from `failure_mode`, never from `Finding.evaluator` (see section 5.3 for the mapping table). This is the literal "Assumption Test: 2 of 3 held"-style copy the docs describe.

No page transition into this screen from 3.2 beyond a simple cross-fade — the user just confirmed, the tests are already starting, there's no reason to make them wait through a transition to see that.

### 3.4 Results dashboard (case overview)

The persistent view once `Case.status == "done"` — also usable as a live-updating view during "testing" if product decides the run-view and results-view should just be the same screen (recommended: **make 3.3 and 3.4 the same component**, not two separate routes; the row list simply keeps its rows after `run_complete` instead of navigating away. This avoids building and maintaining two layouts for what is, structurally, the same list at different completion percentages).

- Top: the counter banner from 3.3, now final and static.
- Body: one card per `Claim`, each showing: statement, verdict badge (icon + color + text label — never color alone, principle 4), a load-bearing indicator (see 5.5) if `load_bearing == true`, and a confidence value (secondary, muted — this is not the headline number, the verdict is).
- Click anywhere on a claim card → opens the evidence drawer (3.5) for that claim. This is the single most important interaction on the page; don't bury it behind a small icon-only button.
- Order claims load-bearing-first, then by status severity (broken → unresolved → weakened → survived) as a sensible default — but this is a reasonable-default call, not something the docs pin down; flag it for the team to confirm once real data exists (see section 10).

### 3.5 Evidence drawer

A `Sheet` (shadcn's slide-over, from the right edge) rather than a full route change — keeps the user's place in the results list, which matters because they'll likely open several in a row while reviewing a run.

Content follows the exact chain from Direction doc section 10, in this order, top to bottom:

```
CLAIM               → Claim.statement
WHY IT MATTERS       → load-bearing question's answer, framed as a sentence
                        ("If this is false, the plan changes materially.")
TESTS RUN            → TestPlanItem list for this claim, by mapped test name
EVIDENCE FOUND       → EvidenceItem list (source_url as a link, title, snippet)
                        per Finding, grouped by test
CONTRADICTIONS       → Finding.contradiction, only shown when non-null
STATUS               → the verdict badge, repeated here for scannability
                        after scrolling
DECISION IMPACT      → DecisionConsequence.impact
WHAT CHANGES         → DecisionConsequence.recommended_change
NEXT VALIDATION      → DecisionConsequence.next_validation, only rendered
                        when non-null (required by backend spec when
                        status is broken/unresolved AND load-bearing —
                        so its absence elsewhere is expected, not a bug)
```

For a claim with genuinely empty `evidence` (Tavily/Scrapling both failed, per backend spec section 5's failure handling), the "EVIDENCE FOUND" section must render an explicit state — "No evidence could be retrieved for this claim" — never an empty blank space that reads as a loading state or a bug. This is the direct UI counterpart to the backend's design choice that a missing source pushes a claim toward `unresolved` rather than crashing; the UI has to honor that same honesty.

Close via the Sheet's own dismiss, a click outside, or Escape (standard Radix/shadcn `Sheet` behavior — no custom close logic needed).

### 3.6 Error state

Backend spec section 7 defines one `error` event: `{"stage": "...", "message": "..."}`. Two different presentations depending on stage:

- **Stage is a single test/evaluator** (e.g. one evaluator threw inside `asyncio.gather`, caught via `return_exceptions=True`): that one row shows an inline error state (distinct from all four verdict states — don't reuse `broken`'s color for "the system failed to test this," those are different facts). The rest of the run continues normally.
- **Stage is pipeline-level** (extraction, reconciliation, or anything before/after the per-test fan-out): a full-width banner at the top of the current screen, plain language, no stack traces, with the raw `message` available behind a "details" disclosure for whoever's debugging live during the demo.

## 4. Verdict visual language

### 4.1 The four states

| Status | Color role | Icon (lucide-react) | Rationale |
|---|---|---|---|
| `survived` | success (green, e.g. shadcn `chart-2`-style green, tuned for AA contrast on near-black) | `circle-check` | Standard "passed" association from CI tools — no reinvention needed here |
| `weakened` | caution (amber) | `triangle-alert` | Reads as "still standing, but damaged" — distinct from a passing green and a failing red |
| `broken` | destructive (maps to shadcn `--destructive`) | `circle-x` | Standard "failed" |
| `unresolved` | a fifth, deliberately non-alarming hue — recommend a violet/indigo, not gray | `circle-help` or `circle-dashed` | Must not read as "worse than broken" (too alarming) or "no data" (too passive/gray) — per principle 3, this is a measured outcome, and the color needs to communicate "the system looked and genuinely couldn't resolve this," which gray reads as "didn't look" |

Do not use gray for `unresolved`. Gray is reserved for genuinely inactive/disabled UI (queued rows, disabled buttons). Reusing it for a verdict state collapses two different meanings ("nothing has happened yet" vs. "something happened and the answer is: unclear") into one visual signal, which directly undermines the docs' insistence that unresolved is a measured result, not an absence.

### 4.2 Base palette

Standard shadcn dark theme, class-based (`.dark` on `<html>`, applied unconditionally since there's no light mode to toggle to):

- `--background` / `--card`: near-black with a one-step-lighter card surface, so claim cards read as distinct surfaces against the page without a hard border everywhere.
- `--foreground`: off-white, not pure `#fff` (reduces glare/halation on a dark background, standard practice).
- `--muted-foreground`: for secondary text — confidence values, timestamps, the "queued" state.
- `--border`: subtle, used sparingly (row separators, drawer edge) — the CI-dashboard look comes from spacing and typography doing most of the separation work, not boxes around everything.
- `--ring`: keep shadcn's default focus-ring behavior; don't skip focus states for demo speed, a live judged demo is exactly when a stray Tab-key press shouldn't look broken.

Exact hex/oklch values: generate via a shadcn theme tool against this token list, tuned for WCAG AA contrast against the near-black background — don't hand-pick five colors independently and hope they're consistent; use one generator pass so the whole palette is coherent.

## 5. Typography, iconography, and small components

### 5.1 Type

- UI chrome, body text, claim statements, findings prose: system sans-serif stack (shadcn default, e.g. `Inter`/system-ui) — no separate font load, no extra hackathon setup step.
- Monospace, `ui-monospace`/`JetBrains Mono`-style stack, used specifically for: claim IDs, test IDs, test names when shown as labels ("ASSUMPTION_TEST", small-caps or as-is — pick one and apply consistently), evidence source URLs, and the `Case.id`/status strings if ever shown raw. This is the one deliberate "developer tool" signal in the type system, and it should be used narrowly — reserved for things that are actually identifiers or test-runner-style labels, not applied to prose, or it stops reading as intentional and starts reading as a font that didn't load.

### 5.2 Icons

`lucide-react` exclusively (ships with shadcn, zero extra dependency). No custom icon set, no illustration.

### 5.3 Test name mapping (required, not optional)

`Finding.evaluator` is an internal backend routing field and must never be read by any UI component. The only source of truth for a displayed test name is `TestPlanItem.failure_mode`:

| `failure_mode` | Displayed test name |
|---|---|
| `assumption` | Assumption Test |
| `evidence` | Evidence Test |
| `feasibility` | Feasibility Test |
| `edge-case` | Edge-Case Test |

If a `failure_mode` value ever appears that isn't one of these four, render it as a generic "Test" with the raw value visible only in a details/debug view — don't crash, and don't silently guess.

### 5.4 Impact chip

`DecisionConsequence.impact` is flagged in the backend spec as `# high | medium | low, or a short phrase — TBD in UI pass`. Resolving it here: **use a fixed three-value enum (`high` / `medium` / `low`), not free text.** A short phrase can't render as a consistent chip, can't be sorted or grouped, and doesn't match how `load_bearing` (a boolean, from an explicit yes/no question per Direction doc section 6) already works elsewhere in the same object. Recommend backend narrow the Pydantic field to `Literal["high", "medium", "low"]` to match. Rendered as a small filled-bar meter (three segments, N filled) rather than a colored badge — this keeps the crash-test-report association (an intensity readout) without introducing a fifth color into a system that already has four reserved verdict colors plus destructive-for-errors.

### 5.5 Load-bearing indicator

A small flag/anchor icon (not a color, per principle 4 — color is reserved for verdict) next to any claim where `load_bearing == true`. Absence of the icon means `load_bearing == false` or not yet classified (pre-confirmation) — the UI does not need to distinguish those two cases anywhere `load_bearing` isn't yet meaningful (i.e., never render this icon on screen 3.2).

### 5.6 SSE connection indicator

A small, quiet "live" dot (e.g. `--muted-foreground` gray, pulsing gently only while the stream is open) near the top of screens 3.3/3.4. If the SSE connection drops, it should visibly go stale (stop pulsing, maybe shift to amber) rather than leave the user assuming a run is stuck when it's actually just disconnected. Cheap to build, and exactly the kind of small honesty signal that matters more live on stage than it does in a spec.

## 6. Component inventory → shadcn/ui mapping

| Component needed | shadcn/ui primitive | Notes |
|---|---|---|
| Entry input | `Textarea` + `Button` | Auto-grow textarea, not a single-line `Input` — decisions are rarely one line |
| Claim confirmation list | `Card` (per claim) + inline `Textarea` on edit | See 3.2 |
| Test run row | Custom, built on `Card`/plain flex row | No shadcn primitive matches a CI job row directly; keep it simple (icon, text, chip) |
| Verdict badge | `Badge`, custom color variants added for the 4 states | Extend shadcn's badge variants rather than building a new component |
| Confidence value | Plain text, `--muted-foreground` | Not a progress bar — a bar implies more precision than a 0-1 confidence float usually deserves next to a verdict badge that's already the headline |
| Impact meter | Custom, 3-segment bar | See 5.4 |
| Evidence drawer | `Sheet` | Right-side slide-over |
| Evidence source link | Plain `<a>` styled as shadcn link, `external-link` icon | Opens in new tab |
| Loading/extracting state | `Skeleton` | 3.1 |
| Error banner | `Alert` (shadcn) | Two variants: inline (row-level) and page-level, per 3.6 |
| Provider selector (stretch, see 7) | `Select` inside a `Dialog` or dedicated settings route | Kept intentionally minimal — this is explicitly a "mostly a UI and config task" per Direction doc section 11 |
| Tooltips (e.g. explaining "unresolved") | `Tooltip` | Use sparingly — if a first-time user needs a tooltip to understand a verdict badge, the icon/label pairing in 4.1 isn't doing its job alone; tooltips are backup, not the primary explanation |

## 7. Provider selector (stretch — hour 20-28 per Direction doc's build plan)

Per Direction doc section 7 and the backend spec's provider interface (section 3), only Gemini is wired for the hackathon; Anthropic and OpenAI-compatible are stubs. **Design the settings UI for the full five-provider list (Claude, OpenAI, Gemini, Ollama, custom endpoint) now, even though only Gemini is selectable initially** — a `Select` with the other four options present but disabled/labeled "coming soon" costs nothing extra to build and lets the pitch honestly say the architecture supports it, per the same "designed-for, not built-and-polished" distinction the Direction doc draws for local models. One provider per run, chosen before a case starts (not per-persona) — matches the confirmed scope.

## 8. Motion — the complete list

Everything animated in this product, in full. If it's not on this list, it doesn't move.

1. Screen-to-screen transitions: opacity cross-fade, ~150ms. Nothing else — no slides, no scale.
2. Test row entering "running": icon transitions to a spin (for a "processing" glyph) or a soft pulse (for a dot) — pick exactly one style and use it everywhere a "running" state appears, never mix.
3. Verdict badge on arrival: a single brief pulse/flash (under 300ms) when a row transitions from running to resolved, so a live-watching user's eye catches the state change without needing a sound or a toast.
4. Counter banner (3.3/3.4): numbers increment directly (no animated count-up library) — a plain re-render is enough and one fewer dependency.
5. Evidence drawer open/close: shadcn `Sheet`'s default slide transition, unmodified.
6. SSE "live" dot (5.6): gentle opacity pulse while connected.

That's the whole list. No confetti, no success animations beyond item 3, no scroll-triggered reveals, no hover-tilt cards.

## 9. Explicitly not in this build

- **3D of any kind** (models, WebGL scenes, three.js) — see the standalone answer given during this planning pass: it contradicts the "test runner, not spectacle" direction, doesn't fit the dark-CI-dashboard visual language just chosen, and is real, spiky build risk in a 48-hour window already carrying live SSE state, a confirmation gate, and an evidence drawer. If there is genuine slack in the hour 46-48 buffer and someone wants to spend it on a single abstract visual for the pitch deck itself (not the working app) — an impact/shatter motif tied to the crash-test metaphor — that's an isolated, optional, last-priority nice-to-have, fully decoupled from the product UI, and shouldn't be scheduled against anything in sections 3-8.
- **Light mode.** Dark only, per the direction confirmed for this build.
- **Any illustration, mascot, or custom icon set** beyond lucide-react.
- **A persona/character view of any kind** — no avatars for Devil's Advocate, Receipts, Builder, Overthinker, or Judge anywhere in the product, including empty states, loading copy, or error messages. If placeholder copy needs a subject, use the test name ("Running the Evidence Test...") never the evaluator name.
- **The side-by-side demo view as a persistent product feature.** Per Direction doc section 10 / Plan doc section 16, the live side-by-side (plain model call vs. Crossfire) is a demo mechanism, not a shipped user-facing mode. Build it as a separate, simple route used only for the presentation, not integrated into the main claim-testing flow — it has different layout needs (two columns, a plain-text output pane next to the structured Crossfire view) that don't belong bolted onto screens 3.1-3.5.

## 10. Open items for the team

Carried over in the same spirit as the idea docs' own "open items" sections — things this pass made a reasonable call on but that are worth a two-minute confirmation once people are actually looking at the built screens, not before:

1. **Claim card default ordering** on the results dashboard (5.4 proposes load-bearing-first, then severity) — confirm this reads well once real, non-toy claim lists exist; may want confidence as a tiebreaker.
2. **`DecisionConsequence.impact` as a fixed enum** (section 5.4) needs the backend model (`core/models.py`) updated to match — flag this to whoever owns `providers/` + `core/loop.py` per the backend spec's three-way split, since it's a one-line Pydantic change but affects what `build_consequences()` is allowed to return.
3. **Whether 3.3 and 3.4 are literally the same component** (recommended in section 3.4) or the team prefers a distinct "run finished" transition — functionally equivalent, this is a build-convenience call, not a UX requirement.
4. ~~Exact violet/indigo hex for `unresolved`~~ — resolved below in Appendix A, now that this doc doubles as a generation brief and needed real values rather than "pick one later." Treat Appendix A's values as a first pass, not gospel — cheap to swap before anyone's hand-built five components against them, expensive after.
5. **Whether the SSE stale-connection indicator (5.6) is worth the extra state handling** given the demo runs locally against one `uvicorn` process (backend spec's assumption 2) — connection drops are less likely in that setup than in a hosted deploy, so this can be cut first if hour 30-35 integration hardening runs short.

---

This spec assumes the reader has `crossfire_backend_spec.md` open alongside it — every screen above is described in terms of that document's `Case` model, SSE event names, and module layout, deliberately, so the two specs stay mechanically in sync rather than describing the same system in two different vocabularies.

---

## Appendix A: Locked design tokens

Sections 4.1/4.2 deliberately left exact colors to "run through a generator." That's the right call for a human dev team, but a generation tool can't defer the decision — it needs real values now. These are Tailwind's 400-weight shades on a `zinc-950` base, chosen specifically because that pairing is a known-safe, widely-used combination for AA text/UI contrast on a near-black background — a reasonable locked starting point, not a substitute for an actual contrast check once real components exist.

| Token | Hex | Usage |
|---|---|---|
| `--background` | `#09090b` | Page background |
| `--card` | `#18181b` | Claim cards, test rows, drawer background |
| `--border` | `#27272a` | Row separators, drawer edge, card outlines (used sparingly per principle 7) |
| `--foreground` | `#f4f4f5` | Primary text |
| `--muted-foreground` | `#a1a1aa` | Secondary text: confidence values, timestamps, queued-state labels |
| `--primary` | `#60a5fa` (blue) | Buttons, links, focus ring, the SSE "live" dot when connected |
| `survived` | `#34d399` (emerald) | Verdict badge + icon |
| `weakened` | `#fbbf24` (amber) | Verdict badge + icon |
| `broken` / `--destructive` | `#f87171` (red) | Verdict badge + icon, page-level error banners |
| `unresolved` | `#a78bfa` (violet) | Verdict badge + icon — resolves open item 4 above |

Five distinct hues total (blue for action, plus the four verdict colors) — nothing else in the interface should introduce a sixth. The impact meter (5.4) stays monochrome (filled vs. unfilled segments in `--foreground`/`--muted-foreground`), not a color, specifically so it doesn't compete with this set.

Typography: UI text in a system sans stack (`ui-sans-serif, system-ui, -apple-system, sans-serif`); identifiers, test names, and evidence URLs in a system mono stack (`ui-monospace, "JetBrains Mono", "SF Mono", monospace`) — see section 5.1 for where each is used.

## Appendix B: Sample case data

A generation tool renders convincingly only when it has real content to place, not field names. This is one fabricated but realistic `Case` — matching the shapes in `crossfire_backend_spec.md` section 2 exactly — covering all four verdict states plus one non-load-bearing claim, so every visual state in this spec has an example to draw from.

**Decision (`Case.raw_input`):** "I want to build an AI that helps students apply to college, including submitting applications on their behalf."

**Claim 1** — load-bearing, weakened
- Statement: "Students will trust an AI to submit applications on their behalf."
- Test: Assumption Test
- Finding: confidence 0.62 — "Survey data on AI trust in high-stakes academic contexts shows meaningful hesitation once autonomous submission, rather than drafting help, is specified."
- Evidence: "Student Trust in Automated Academic Tools (2026 survey)" — "42% of respondents said they would not let an AI submit a final application without a manual review step."
- Contradiction: "Adoption data from similar automated-submission tools in adjacent domains (financial-aid forms) shows faster-than-expected uptake once a review step is added."
- Decision impact: high — "Add a mandatory human-review checkpoint before final submission rather than fully autonomous send." Next validation: "Prototype test measuring opt-in rate for a 'review before send' toggle with 10 users."

**Claim 2** — load-bearing, broken
- Statement: "There's no existing competitor already solving this well."
- Test: Evidence Test
- Finding: confidence 0.81 — "A directly competing, funded product with a similar submission model is already live."
- Evidence: "CollegeAI raises $12M for automated application platform" — "CollegeAI already offers end-to-end application drafting and submission with human-in-the-loop review, live since March 2026."
- Contradiction: none.
- Decision impact: high — "Differentiate on a visible review-and-audit trail rather than a 'first to market' claim." Next validation: "Direct trial of CollegeAI's product to map exact feature gaps."

**Claim 3** — not load-bearing, survived
- Statement: "The onboarding screen should use a dark theme."
- Test: Assumption Test (shallow pass — not load-bearing)
- Finding: confidence 0.9 — "No meaningful decision risk either way; survives basic scrutiny."
- Evidence: none needed.
- Decision impact: low — no recommended change, no next validation (illustrates that non-load-bearing claims can legitimately have a thin `DecisionConsequence`).

**Claim 4** — load-bearing, unresolved
- Statement: "The AI can reliably parse arbitrary college application portal formats without per-school custom integration."
- Test: Feasibility Test
- Finding: confidence 0.4 — "No reliable public data on application-portal format standardization; would require a direct technical spike to determine feasibility." Evidence list empty (this is the "evidence pipeline came back empty" case from backend spec section 5 — render the explicit empty-evidence state from section 3.5, not a blank drawer).
- Contradiction: none.
- Decision impact: high — "Scope v1 to the 3-5 most common application-portal providers instead of universal support." Next validation: "Technical spike: attempt automated parsing against 5 real portal exports."

Run summary banner for this sample case: **"4 of 4 claims tested. 1 survived, 1 weakened, 1 broken, 1 unresolved."**

## Appendix C: Per-screen layout skeletons and ready-to-paste prompts

Section 3 specified content and ordering per screen; this section adds the spatial layout each one was missing, then a self-contained prompt block per screen — paste each into Stitch, Claude Designer, v0, or similar, one screen at a time rather than all six in one prompt, since these tools generate more accurately from a single, concrete brief than a bundled multi-screen request.

### C.1 Entry screen

**Layout:** Single column, vertically and horizontally centered in the viewport, max content width 640px. Small wordmark "Crossfire" top-left of viewport (not inside the centered column). Prompt label above an auto-growing textarea (min-height ~120px). Primary button right-aligned directly below the textarea.

```
Design a single dark-mode screen for a web app called Crossfire, using
the palette background #09090b, card #18181b, foreground #f4f4f5,
muted-foreground #a1a1aa, primary/accent #60a5fa. Sans-serif UI font.

Layout: small "Crossfire" wordmark, top-left of the full viewport, in
muted-foreground. The rest of the screen is empty except one centered
column, max-width 640px, vertically centered.

In that centered column, top to bottom:
1. A short label in foreground text, medium weight: "What are you
   considering?"
2. A large, auto-growing textarea below it (card background, border
   #27272a, rounded corners, ~120px tall, placeholder text in
   muted-foreground: "I want to build an AI that helps students apply
   to college, including submitting applications on their behalf.")
3. A primary button, right-aligned below the textarea, filled with
   #60a5fa, dark text, label "Test this."

No illustration, no logo mark beyond the wordmark, no decorative
background elements. The whole screen should feel closer to a
developer tool's landing input (think a CI tool's "new run" screen)
than a marketing page.
```

### C.2 Claim map confirmation

**Layout:** Single column, max width 720px, left-aligned (not centered like the entry screen — this is a working screen, not a landing moment). Header sentence at top. Claim cards stacked full-width below it, 12px gap between cards. "Add a claim" as a plain text link below the last card. Primary button bottom-right of the column.

```
Design a dark-mode screen, same palette as before (background #09090b,
card #18181b, border #27272a, foreground #f4f4f5, muted-foreground
#a1a1aa, primary #60a5fa). Single column, max-width 720px, left-aligned
near the top of the viewport (not vertically centered).

Top to bottom:
1. A muted-foreground caption: "Here's what I think you're deciding:"
   followed by one line of foreground text restating the decision:
   "Whether to build an AI that helps students apply to college,
   including submitting applications on their behalf."
2. Below that, a stacked list of 4 claim cards (card background,
   border, rounded corners, ~16px padding, 12px gap between cards).
   Each card: claim statement text on the left, a small "x" delete
   icon top-right in muted-foreground. Use these four claim texts:
   "Students will trust an AI to submit applications on their behalf.",
   "There's no existing competitor already solving this well.",
   "The onboarding screen should use a dark theme.",
   "The AI can reliably parse arbitrary college application portal
   formats without per-school custom integration."
   No status badges or icons on these cards yet — they haven't been
   tested.
3. Below the list, a plain text link (not a button), muted-foreground:
   "+ Add a claim"
4. A primary button, bottom-right of the column, filled #60a5fa:
   "Confirm and run tests"

This should feel like a short, plain edit-and-confirm form — quiet,
not busy, no progress indicators.
```

### C.3 / C.4 Live test run and results dashboard

**Layout:** Full-width app shell. Fixed top bar, ~56px, full viewport width: wordmark + a small pulsing "live" dot on the left, the run summary counter on the right. Main content below the bar: single column, max-width 960px, centered. One card per claim, full width of that column, containing the claim statement, a load-bearing flag icon (when applicable), a verdict badge, and one nested row per test run against that claim.

```
Design a dark-mode dashboard screen, same palette (background #09090b,
card #18181b, border #27272a, foreground #f4f4f5, muted-foreground
#a1a1aa, primary #60a5fa) plus four status colors: survived #34d399,
weakened #fbbf24, broken #f87171, unresolved #a78bfa.

Top bar: full width, ~56px tall, background #09090b, bottom border
#27272a. Left side: "Crossfire" wordmark plus a small circular dot in
#60a5fa (a "live" connection indicator). Right side, in foreground
text: "4 of 4 claims tested — 1 survived, 1 weakened, 1 broken, 1
unresolved."

Below the bar, a single centered column, max-width 960px. Four claim
cards stacked vertically, 16px gap, each full width of the column:

Card 1 (weakened): claim text "Students will trust an AI to submit
applications on their behalf.", a small flag icon (load-bearing) next
to it, a badge on the right reading "Weakened" in amber #fbbf24 with a
triangle-alert icon, confidence "0.62" in small muted-foreground text
below the badge. Below the claim text, one nested row: a monospace
label "ASSUMPTION TEST" with a checkmark-style resolved icon in amber.

Card 2 (broken): claim text "There's no existing competitor already
solving this well.", load-bearing flag, badge "Broken" in red #f87171
with an x-circle icon, confidence "0.81". Nested row: monospace
"EVIDENCE TEST" with a red resolved icon.

Card 3 (survived, no load-bearing flag): claim text "The onboarding
screen should use a dark theme.", badge "Survived" in emerald #34d399
with a check-circle icon, confidence "0.90". Nested row: monospace
"ASSUMPTION TEST" with a green resolved icon.

Card 4 (unresolved): claim text "The AI can reliably parse arbitrary
college application portal formats without per-school custom
integration.", load-bearing flag, badge "Unresolved" in violet #a78bfa
with a circle-help icon, confidence "0.40". Nested row: monospace
"FEASIBILITY TEST" with a violet resolved icon.

Each claim card should be clickable/hoverable (subtle background
lightening on hover) since clicking opens a detail view. Dense,
scannable, closer to a CI pipeline results page than a data dashboard
— no charts, no big number tiles, no illustration.
```

### C.5 Evidence drawer

**Layout:** Right-edge slide-over panel, ~440px wide, full viewport height, background `--card`, left border `--border`, internal vertical scroll, close (×) top-right. Sections stacked with generous vertical spacing (~24px between sections), each section preceded by a small monospace, uppercase, muted-foreground label.

```
Design a dark-mode slide-over panel (drawer), anchored to the right
edge of the viewport, ~440px wide, full height, background #18181b,
left border #27272a, drawer contents scroll vertically, a close "x"
icon top-right in muted-foreground #a1a1aa.

Use this content for the drawer, in this order, each section preceded
by a small monospace uppercase label in muted-foreground with ~24px
space above it:

CLAIM
"There's no existing competitor already solving this well."

WHY IT MATTERS
"If this is false, the plan changes materially — this claim is
load-bearing."

TESTS RUN
"Evidence Test" (monospace label, small badge/chip style)

EVIDENCE FOUND
A small card: title "CollegeAI raises $12M for automated application
platform" as a link (primary blue #60a5fa, external-link icon),
snippet below in foreground text: "CollegeAI already offers end-to-end
application drafting and submission with human-in-the-loop review,
live since March 2026."

STATUS
A badge: "Broken" in red #f87171 with an x-circle icon.

DECISION IMPACT
"High" (rendered as three small filled segments out of three, in
foreground color, next to two empty/outlined segments — actually just
show a 3-segment meter, all 3 filled, to indicate high impact)

WHAT CHANGES
"Differentiate on a visible review-and-audit trail rather than a
'first to market' claim."

NEXT VALIDATION
"Direct trial of CollegeAI's product to map exact feature gaps."

Keep it plain and text-forward — this is a reading surface, not
another dashboard. No cards-within-cards beyond the one evidence
source card described above.
```

### C.6 Error banner

**Layout:** Full-width banner, ~52px tall, placed at the top of the main content area (below the app's top bar if one is present), background a low-opacity tint of `broken` red over `--card`, left accent border in `broken` red, icon + message left-aligned, a "Details" disclosure link right-aligned.

```
Design a dark-mode alert banner, full width of its container, ~52px
tall, background a very subtle red tint over #18181b, a 3px solid
left border in #f87171, contents vertically centered: a triangle-alert
icon in #f87171 on the left, then text in foreground #f4f4f5:
"Something went wrong while reconciling claim findings." On the far
right, a plain text link in muted-foreground #a1a1aa: "Details".
No dismiss animation needed for this mockup — just the static banner.
```

Generate these one at a time. If a tool asks for global settings (framework, spacing scale, corner radius) before it'll take a per-screen prompt: 8px spacing unit, 8px corner radius on cards/buttons, 6px on badges/chips, dark mode only — no light variant needed.
