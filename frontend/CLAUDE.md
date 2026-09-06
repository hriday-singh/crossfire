# Frontend Build Standards & Agent Instructions

---

## 1. Core Workflow Rules

- **Plan before building.** For any non-trivial feature, write out the plan (files touched, approach, sequence) before writing code. If the request is ambiguous, ask clarifying questions first instead of guessing.[cite: 1]
- **Build for production, not prototypes.** Assume the system needs to handle real, growing usage unless I explicitly say "quick prototype" or "just a demo."[cite: 1]
- **Never run database migrations.** Generate the migration file (SQL or ORM migration) and tell me what it does. I apply it myself.[cite: 1]
- **Never commit.** Make code changes only. I commit and push myself unless I say otherwise.[cite: 1]
- **Don't invent UI/UX patterns on the fly.** Reuse existing tokens and components (see Section 3) instead of one-off logic.[cite: 1]

### 1.1 Proactive Agent Behaviors (Strict Enforcement)
- **Automatic Sequential Backups:** Every time a change is made to code, you must proactively save the previous version as a test file. Number these sequentially (e.g., `test1`, `test2`, `test3`, etc.). If I rename a file to establish a specific versioning sequence (e.g., `testphase1,1`), you must dynamically adapt and continue that exact naming convention for subsequent saves (e.g., `testphase1,2`, `testphase1,3`, and later `testphase2,1`).
- **Clarification & Pre-Execution Approval:** Before making *any* code modifications, you must:
  1. Ask me to clarify any doubts regarding the prompt (e.g., specific color shades, graphic assets, animations, sizing parameters).
  2. Provide a full, detailed explanation of the intended execution plan based on the clarified requirements.
  3. Explicitly ask for my permission to execute the plan. **Do not proceed without a clear confirmation.**
- **`c2c` Folder Access:** You have blanket, pre-approved permission to access, read, and manipulate files within the `c2c` folder. Do not pause to ask for permission regarding this specific directory.

---

## 2. Default Tech Stack & Installed Skills

| Layer | Default / Packages |
|---|---|
| **Frontend Framework** | React + vite.js + three.js|
| **3D & WebGL** | `three`, `@react-three/fiber`, `@react-three/drei`, `three-stdlib`, `@types/three` |
| **Animation & Scroll** | `motion`, `lenis` |
| **Visuals & Camera** | `@shadergradient/react`, `camera-controls` |

**Agent Skills & Tooling Active in Workspace:**
- `JuliusBrussee/caveman`
- `mattpocock/skills`
- `shadcn/ui`
- `nutlope/hallmark`
- `Leonxlnx/taste-skill`
- `impeccable`
- `EnzeD/r3f-skills`
- `emilkowalski/skills`
- `Remocn/remocn`
- `ponytail`
- `superpowers`

---

## 3. UI & Design System Rules

**One global source of truth.** Every project has a single global style/token file (e.g. `globals.css` + Tailwind config using CSS variables) that defines *everything visual*: color palette, semantic colors (background, foreground, muted, border, primary, destructive, success, warning), typography scale, spacing scale, border-radius scale, shadows, breakpoints, and default states (hover, focus, active, disabled) for interactive elements. No component ever hardcodes a hex value, px value, or one-off color — it always references a token.[cite: 1]

**Build custom primitives once, reuse everywhere.** Dropdowns, calendars, time pickers, toasts, modals, tooltips — build each one time as a shared component in `components/ui/`, then reuse it project-wide. Never re-implement a variant of something that already exists. Recommended base: **Radix UI primitives + Tailwind**, styled via the global token file (the shadcn/ui pattern) — accessible, unstyled logic underneath, fully themed on top. Use this unless the project already has a different system in place.[cite: 1]

**Responsive by default, no exceptions.** Every screen and component is built mobile-first and verified at both mobile and desktop widths before considered done. Use fluid layouts (flex/grid, relative units), avoid fixed-width traps, keep touch targets usable on mobile. No layout, spacing, or sizing inconsistency between breakpoints.[cite: 1]

---

## 4. Visual Style

- Minimal, clean, generous whitespace. Restrained palette: one primary color, neutrals, one or two accents.[cite: 1]
- Rounded corners by default on everything — buttons, cards, inputs, modals, images — unless I say otherwise. Define a radius scale in tokens (e.g. `sm`, `md`, `lg`, `full`) rather than ad hoc values.[cite: 1]
- Light mode only, unless I ask for dark mode. Still use semantic (not raw) color tokens so dark mode can be added later without a rewrite.[cite: 1]
- Subtle motion for polish: hover/focus transitions, micro-interactions on state changes. Prefer CSS transitions on `transform`/`opacity` over JS-driven or layout-triggering animation — keeps things smooth without bloating memory/CPU.[cite: 1]
- Accessibility baked in: semantic HTML, keyboard navigation, ARIA where needed, WCAG AA contrast enforced through the token palette (not checked ad hoc per component).[cite: 1]
- No color inconsistency: since components only pull from tokens, clashing or inaccessible color combos shouldn't be possible — if a new color is needed, it gets added to the token file first, never inlined.[cite: 1]
- Performance: code-split routes, lazy-load below-the-fold and non-critical components/images, memoize expensive renders, virtualize long lists. Keep bundle and runtime memory lean — avoid heavy animation/UI libraries when CSS can do the job.[cite: 1]

---

## 5. Testing Strategy

- **Every feature ships with unit tests on both sides, same change** — not deferred to later. Frontend logic/components and backend services/endpoints each get tests when they're built or modified.[cite: 1]
- **Frontend:** Vitest + React Testing Library.[cite: 1]
- **Backend:** Vitest/Jest for Node services, Pytest for Python services.[cite: 1]
- **Lint + typecheck are part of "done":** ESLint + Prettier + `tsc --noEmit` must pass alongside tests before a change is considered complete.[cite: 1]
- **Coverage priority:** business logic, services, API endpoints, and non-trivial UI logic get real coverage. Trivial presentational glue doesn't need exhaustive tests — don't pad numbers.[cite: 1]
- **Playwright / E2E: off by default.** Don't add it unless I explicitly ask. When I do ask for it later:[cite: 1]
  - Keep it in a separate `e2e/` directory, not mixed with unit tests.[cite: 1]
  - Cover critical flows only (auth, core happy paths, payment/checkout if applicable) — not every page.[cite: 1]
  - Run on PRs to main / on a schedule in CI, not on every save.[cite: 1]
- **Testing pyramid to aim for:** lots of unit tests → a smaller layer of integration tests (API endpoint + real DB, e.g. via a test container) → a thin layer of E2E once introduced.[cite: 1]
- **CI:** GitHub Actions (or equivalent) running lint, typecheck, and unit tests on every PR. CI never applies migrations.[cite: 1]
- **Pre-commit hook (Husky + lint-staged):** auto-run lint/format on staged files. This protects the commits I make myself, even though Claude doesn't commit.[cite: 1]

---

## 6. Definition of Done (checklist)

- [ ] Clarification doubts addressed, execution plan detailed, and user permission explicitly granted.
- [ ] Pre-change code backed up sequentially (e.g., `test1`, `testphase1,1`).
- [ ] Plan written and (if ambiguous) confirmed before coding[cite: 1]
- [ ] No hardcoded colors/sizes — everything pulled from the global token file[cite: 1]
- [ ] Any new custom UI primitive added to the shared component library, not one-off[cite: 1]
- [ ] Verified responsive on mobile and desktop[cite: 1]
- [ ] Unit tests added/updated on frontend and backend for the change[cite: 1]
- [ ] Lint + typecheck pass[cite: 1]
- [ ] Migration file generated if schema changed — not applied[cite: 1]
- [ ] No commit made[cite: 1]
---

# Crossfire Frontend — Agent Instructions & Testing Mandate

You are working inside the `frontend/` workspace of the Crossfire project as **Dev A**.

---

## 1. Non-Negotiable Testing Rules

Before modifying, creating, or finishing any frontend code, you must read and adhere to:
**[`frontend/TESTING.md`](./TESTING.md)**

### Critical Mandates:
1. **Unit test everything**: Every component, hook, reducer action, screen, or utility must ship with matching unit tests in `src/tests/` in the same change. Never defer tests.
2. **Always run tests before completing**:
   ```bash
   npm run test:all
   ```
   Do not report a task as complete unless both `typecheck` and `vitest run` pass with zero errors and zero regressions.
3. **Keep tests centralized**: All unit tests belong in `src/tests/` (e.g. `src/tests/api.test.ts`, `src/tests/ClaimCard.test.tsx`).
4. **Follow design tokens**: Never hardcode colors, hex values, or random pixel values. Use Tailwind classes backed by CSS variables in `src/globals.css`.

---

## 2. Tech Stack

- **Framework**: React 19 + Vite (TypeScript)
- **Styling**: Tailwind CSS + Radix UI Primitives (`@radix-ui/react-*`) + Lucide icons
- **State**: React Context (`CaseContext`) + Reducer (`caseReducer`)
- **Transport**: Native SSE (`EventSource`) + Fetch API wired directly to backend API
- **Testing**: Vitest + React Testing Library (`@testing-library/react`, `@testing-library/jest-dom`)
- **DOM**: `jsdom`

---

## 3. Quick Verification Commands

```bash
# Run full suite + typecheck
npm run test:all

# Run tests only
npm test

# Run typecheck only
npm run typecheck

# Build check
npm run build
```
