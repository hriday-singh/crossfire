# Frontend Testing Standards & Enforcement Guide

> **Authoritative Specification for Humans and AI Agents (Dev A, Claude Code, Antigravity)**
> Every change touching the frontend codebase must adhere to the rules, testing patterns, and checklists defined in this document.

---

## 1. The Golden Rules (Non-Negotiables)

1. **Unit Test Everything That Ships**:
   No code change is complete without matching unit tests written in the exact same pass. If you create or modify a component, screen, hook, reducer action, API function, or formatter, you **must** add or update its unit tests. Never defer tests to "later."

2. **Always Run Tests Before Completion**:
   Before declaring any frontend task done or reporting success, you must run:
   ```bash
   npm run test:all
   ```
   (or `npm run typecheck && npm test`).
   Every single test must pass (0 failures, 0 errors).

3. **Zero Regressions & No Weakened Assertions**:
   Existing tests represent locked contracts. You must never delete, skip (`it.skip`), or weaken existing assertions to make a failing suite pass. If your change breaks an existing test, either fix your implementation or update the test only if the functional specification itself intentionally evolved.

4. **Co-located Centralization Convention**:
   All frontend unit tests reside in `frontend/src/tests/` using the `.test.ts` or `.test.tsx` suffix. Match file basenames closely (e.g., `src/tests/api.test.ts` tests `src/lib/api.ts`, `src/tests/ClaimCard.test.tsx` tests `src/components/features/ClaimCard.tsx`).

5. **No Hardcoded Values or Clashing Tokens**:
   Test cases must assert semantic classes, token usage, and accessible roles—not fragile random hexes or un-themed DOM structures.

---

## 2. Coverage Scope ("Unit Test Everything")

Every layer of the frontend application has mandatory test requirements:

| Layer | What Must Be Tested | Test File Pattern |
|---|---|---|
| **Reducers & State** | All action types, state transitions, state immutability, localStorage hydration, error recovery | `src/tests/caseReducer.test.ts`, `src/tests/CaseContext.test.tsx` |
| **Custom Hooks** | Stream connections, mock playback step timing, event dispatching, cleanup on unmount | `src/tests/useCaseStream.test.ts` |
| **API Client & Networking** | Request payloads, URL parameters, query strings, headers, HTTP 2xx success, HTTP 4xx/5xx `CrossfireApiError` handling | `src/tests/api.test.ts` |
| **Formatters & Pure Utilities** | All input branches, boundary conditions, zero values, null/undefined safety, string truncations | `src/tests/formatters.test.ts`, `src/tests/utils.test.ts` |
| **UI Primitives** | Variant classes (default, outline, ghost, destructive), sizes, disabled states, accessibility attributes | `src/tests/ui.test.tsx` |
| **Feature Components** | Interactive states, click callbacks, conditional badges, drawer toggling, impact meters | `src/tests/ClaimCard.test.tsx`, `src/tests/TestRow.test.tsx`, `src/tests/ImpactMeter.test.tsx`, `src/tests/LiveDot.test.tsx`, `src/tests/EvidenceDrawer.test.tsx` |
| **Modals & Drawers** | Open/close visibility, speed presets, mock toggles, backdrop clicks, escape key triggers | `src/tests/SettingsModal.test.tsx`, `src/tests/HistoryDrawer.test.tsx` |
| **Layout & Screen Views** | View routing (`entry` -> `confirm` -> `dashboard`), form validation, preset loading, reality check summary | `src/tests/Header.test.tsx`, `src/tests/ErrorBanner.test.tsx`, `src/tests/screens.test.tsx` |

---

## 3. Testing Stack & Environment

- **Runner**: [Vitest](https://vitest.dev/) (`vitest run` for single pass, `vitest` for watch mode)
- **DOM Environment**: `jsdom` configured in `frontend/vite.config.ts`
- **DOM Assertions**: `@testing-library/jest-dom` (matchers like `toBeInTheDocument()`, `toHaveClass()`, `toBeDisabled()`)
- **Component Harness**: `@testing-library/react` (`render`, `screen`, `fireEvent`, `waitFor`, `act`)
- **TypeScript**: `typescript` with `tsc --noEmit` validation

---

## 4. Best Practices & Standard Patterns

### A. RTL Query Priority
Always query elements from the user's perspective. Follow this strict hierarchy:
1. `screen.getByRole('button', { name: /confirm/i })` (accessible role & name)
2. `screen.getByLabelText(/input/i)`
3. `screen.getByPlaceholderText(/describe your plan/i)`
4. `screen.getByText(/claim statement/i)`
5. `screen.getByTitle(/tooltip/i)`
6. Only use `screen.getByTestId(...)` if an element has no accessible semantic marker.

### B. Testing Components with Context
Wrap components in `CaseProvider` or a custom test harness when they consume `useCase`:
```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaseProvider } from "@/context/CaseContext";
import { Header } from "@/components/layout/Header";

describe("Header", () => {
  it("renders branding and action buttons", () => {
    render(
      <CaseProvider>
        <Header onToggleDebugDock={() => {}} isDebugDockOpen={false} />
      </CaseProvider>
    );
    expect(screen.getByText("CROSSFIRE")).toBeInTheDocument();
  });
});
```

### C. Testing API Calls with Mocked Fetch
Always restore mock functions in `afterEach`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCase, CrossfireApiError } from "@/lib/api";

describe("api.ts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to /cases and parses response", async () => {
    const mockCase = { id: "test-123", raw_input: "test plan" };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCase,
    });

    const result = await createCase("test plan");
    expect(result.id).toBe("test-123");
    expect(fetch).toHaveBeenCalledWith("/cases", expect.objectContaining({
      method: "POST",
    }));
  });
});
```

### D. Testing Custom Hooks & Asynchronous Streams
Use `renderHook` and `vi.useFakeTimers()` for timed simulation loops:
```ts
import { renderHook, act } from "@testing-library/react";
import { useCaseStream } from "@/hooks/useCaseStream";

it("advances simulation steps on timer ticks", () => {
  vi.useFakeTimers();
  // ... renderHook with provider
  act(() => {
    vi.advanceTimersByTime(500);
  });
  // assert dispatched state changes
  vi.useRealTimers();
});
```

---

## 5. NPM Commands Reference

Run all commands from the `frontend/` directory:

| Command | Purpose | When to Use |
|---|---|---|
| `npm run test:all` | **Primary verification**: Runs `tsc --noEmit` and `vitest run` | **Mandatory before completing any task** |
| `npm test` | Runs all Vitest unit test suites once | While developing or checking unit tests |
| `npm run test:watch` | Interactive TDD watch mode | When writing or iterating on new tests |
| `npm run typecheck` | Strict TypeScript compiler check | To verify contracts and type safety |
| `npm run build` | Full production bundle compilation | To ensure build output succeeds |

---

## 6. Definition of Done Checklist (Frontend Tasks)

Before closing any frontend feature, bug fix, or refactor, verify every box:

- [ ] **Implementation Complete**: Feature code satisfies the functional requirement and respects design tokens.
- [ ] **Unit Tests Created/Updated**: Unit tests added in `src/tests/` covering happy path and failure/edge cases.
- [ ] **Zero Regressions**: All previous tests continue to pass without modifications.
- [ ] **Typecheck Passed**: `npm run typecheck` passes with zero errors.
- [ ] **All Tests Passed**: `npm test` passes 100% across all suites.
- [ ] **Clean Build**: `npm run build` compiles with zero warnings or errors.
- [ ] **No Unstaged Artifacts**: No temporary debug logs or hardcoded test keys left behind.
