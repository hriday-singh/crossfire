# Live Runner Auto-Scroll & Interactive Sort Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix live runner scrolling behavior (ensure window auto-scrolls to top on launch to display live intelligence, fix feed auto-scroll from stalling during streaming updates, and follow active updates) and replace the non-interactive "Sorted by" text with a fully functional, accessible sort dropdown.

**Architecture:**
- **Scroll Synchronization:** 
  - Window-level scroll reset in `DashboardScreen` / `ConfirmScreen` on runner launch so the top section (verdict + Live Investigation Feed "live intelligence") is immediately in view.
  - Container-level scroll in `LiveActivityFeed` using a container ref and `scrollTop = scrollHeight` scheduled with `requestAnimationFrame` instead of brittle `scrollIntoView({ behavior: "smooth" })` calls that collide during rapid SSE events.
  - Active claim tracking in `DashboardScreen` so claim-level updates are smoothly followed without fighting manual user interaction.
- **Sort Controls:**
  - Build an accessible `DropdownMenu` UI primitive in `components/ui/dropdown-menu.tsx` compliant with the design system and ARIA standards.
  - Integrate interactive sort selection in `DashboardScreen.tsx` replacing static `<span>Sorted by: Criticality</span>`, supporting: Criticality (default), Outcome Severity, Passed First, Original Order, and Load-Bearing First.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest + React Testing Library.

**Spec:** User requirements:
1. "When the live runner is running, make sure that it keeps on scrolling wherever the updates happen."
2. "Make sure to scroll to the top so I can see the live intelligence. The scroll is not being affected by whatever is coming."
3. "Also, the 'Sorted by' thing is just text; it's not there."

## Global Constraints
- Never commit code directly (user commits).
- Never run database migrations.
- Strict TypeScript mode (zero `any`, narrow `unknown`).
- Design system tokens only: all colors, borders, and shadows reference existing Tailwind tokens (`surface-container`, `outline-variant`, `primary-container`, etc.).
- Responsive mobile & desktop.
- 100% test coverage for modified components; `npm run test:all` must pass with zero failures.

---

### Task 1: Auto-Scroll Window to Top on Live Runner Launch

**Files:**
- Modify: `frontend/src/components/screens/DashboardScreen.tsx`
- Modify: `frontend/src/components/screens/ConfirmScreen.tsx`
- Test: `frontend/src/tests/screens.test.tsx`

**Interfaces:**
- When navigating to `DashboardScreen` with `isTesting` or `activeScreen === "runner"`, `window.scrollTo({ top: 0, behavior: "smooth" })` is triggered.
- When `confirmAndRun` is clicked in `ConfirmScreen`, the window scroll position is reset to top so the user lands directly on the top header, verdict call, and Live Investigation Feed ("live intelligence").

- [ ] **Step 1: Write test in `screens.test.tsx` checking that `window.scrollTo` is called when `DashboardScreen` mounts or enters testing mode**
- [ ] **Step 2: Run test to verify failure before implementation**
- [ ] **Step 3: Implement window scroll-to-top hook in `DashboardScreen.tsx` on runner mount / stream start**
- [ ] **Step 4: Ensure `ConfirmScreen.tsx` `confirmAndRun` also invokes `window.scrollTo(0, 0)`**
- [ ] **Step 5: Run tests to verify they pass**

---

### Task 2: Robust Live Intelligence Feed Auto-Scrolling

**Files:**
- Modify: `frontend/src/components/features/LiveActivityFeed.tsx`
- Test: `frontend/src/tests/LiveActivityFeed.test.tsx`

**Interfaces:**
- Replace `feedEndRef.current.scrollIntoView?.({ behavior: "smooth" })` with direct container ref manipulation:
  ```typescript
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  ```
- Listen to container `onScroll`: if user scrolls up more than 40px from bottom, set `autoScroll(false)`; if user scrolls back near bottom, set `autoScroll(true)`.
- When `activities` change or streaming events arrive and `autoScroll` is true, schedule `containerRef.current.scrollTop = containerRef.current.scrollHeight` via `requestAnimationFrame`.
- If `autoScroll` is paused by user scroll, show a subtle floating badge `"Resume auto-scroll ⇣"` allowing instant re-engagement.

- [ ] **Step 1: Write tests in `LiveActivityFeed.test.tsx` simulating rapid activity streams and verifying container auto-scroll logic**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement container ref scrolling with auto-scroll lock/unlock in `LiveActivityFeed.tsx`**
- [ ] **Step 4: Run tests to verify all tests in `LiveActivityFeed.test.tsx` pass**

---

### Task 3: Active Claim Follow During Live Run Updates

**Files:**
- Modify: `frontend/src/components/screens/DashboardScreen.tsx`
- Test: `frontend/src/tests/screens.test.tsx`

**Interfaces:**
- Track the latest active claim undergoing scrutiny (`activeClaimId` derived from `state.activeTests` or `state.activeTestActivities`).
- When a claim is actively being evaluated and updates arrive, ensure the claim card displays live active state indicator and provide an optional/controlled smooth follow scroll when updates occur down in the claims dossier.

- [ ] **Step 1: Add test in `screens.test.tsx` verifying active claim card reflects live testing indicators**
- [ ] **Step 2: Run test to verify expectations**
- [ ] **Step 3: Implement active update tracking and optional follow-scroll behavior in `DashboardScreen.tsx`**
- [ ] **Step 4: Run tests to verify pass**

---

### Task 4: Accessible Dropdown Menu UI Primitive

**Files:**
- Create: `frontend/src/components/ui/dropdown-menu.tsx`
- Test: `frontend/src/tests/ui.test.tsx`

**Interfaces:**
```typescript
export interface DropdownMenuItem<T extends string = string> {
  id: T;
  label: string;
  description?: string;
  icon?: string;
}

export interface DropdownMenuProps<T extends string = string> {
  value: T;
  options: DropdownMenuItem<T>[];
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}
```
- Full keyboard navigation: ArrowUp/Down, Enter, Space, Escape.
- Click outside listener with auto-dismiss.
- Semantic ARIA roles (`role="menu"`, `role="menuitem"`, `aria-haspopup="true"`, `aria-expanded`).

- [ ] **Step 1: Write tests in `ui.test.tsx` for `DropdownMenu` (rendering, click selection, keyboard accessibility, click-outside)**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `DropdownMenu` in `frontend/src/components/ui/dropdown-menu.tsx`**
- [ ] **Step 4: Run tests to verify `DropdownMenu` passes**

---

### Task 5: Interactive "Sorted by" Dropdown in DashboardScreen

**Files:**
- Modify: `frontend/src/components/screens/DashboardScreen.tsx`
- Test: `frontend/src/tests/screens.test.tsx`

**Interfaces:**
- Add `ClaimSortOption = "criticality" | "severity" | "passed_first" | "original" | "load_bearing"`
- Sort implementations:
  - `criticality`: Load-bearing first, then worst outcome (`broken` -> `unresolved` -> `weakened` -> `survived`).
  - `severity`: Worst outcome first regardless of load-bearing (`broken` -> `unresolved` -> `weakened` -> `survived`).
  - `passed_first`: Best outcome first (`survived` -> `weakened` -> `unresolved` -> `broken`).
  - `original`: Document extraction order (original array index).
  - `load_bearing`: Load-bearing claims first, then non-load-bearing.
- Replace static `<span>Sorted by: Criticality</span>` with the interactive `DropdownMenu` component.

- [ ] **Step 1: Write tests in `screens.test.tsx` testing the sort dropdown: default selection, selecting each sort option, and checking reordering of claim cards**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement interactive sort dropdown and dynamic sorting logic in `DashboardScreen.tsx`**
- [ ] **Step 4: Run tests to verify all tests pass**

---

### Task 6: Full Verification & Typecheck

**Files:**
- Run workspace validation: `frontend/`

- [ ] **Step 1: Run `npm run typecheck` (`tsc --noEmit`) to verify zero TypeScript errors**
- [ ] **Step 2: Run `npm run test:all` to ensure all 26+ test suites pass with 100% success**
- [ ] **Step 3: Review UI responsiveness and design token compliance**
