# Crossfire Frontend — Agent Instructions & Testing Mandate

You are working inside the `frontend/` workspace of the Crossfire project as **Dev A**.

---

## 1. Non-Negotiable Testing Rules

Before modifying, creating, or finishing any frontend code, you must read and adhere to:
👉 **[`frontend/TESTING.md`](./TESTING.md)**

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
