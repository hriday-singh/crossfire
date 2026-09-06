# Frontend UI Polish, Settings, and Interaction Enhancements Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 13 reported frontend issues: remove v1.4 engine labels, eliminate bottom footer gap, fix button hover tokens, support Windows/Mac shortcuts, make navigation steps truthful, introduce a dedicated Settings modal & clarify settings purpose, fix Clear History and broken actions, eliminate double cross buttons in drawers, fix FAQ & ingestion spacing, remove Runner Ready pill, enable full drag-and-drop, and auto-detect pasted URLs.

**Architecture:** 
- State management via `caseReducer` updated with `CLEAR_HISTORY` and `DELETE_HISTORY_ITEM` actions.
- Header cleaned up to remove runner status badge, profile avatar, and v1.4 badge, while separating History and Settings triggers.
- A new `SettingsModal` component managing runtime config (API URL, engine mode, evaluator suite, cache clearing).
- Radix `SheetContent` upgraded with `hideDefaultClose` to stop rendering redundant close buttons.
- `EntryScreen` enriched with full-card drag-and-drop overlay and automatic clipboard URL detection & ingestion.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Radix UI Primitives, Lucide icons / Material Symbols, Vitest + React Testing Library.

**Spec:** User feedback checklist (13 items) & Frontend Design System (`frontend/CLAUDE.md`).

## Global Constraints
- Never commit code.
- Never run database migrations.
- Maintain strict TypeScript safety (zero `any`).
- Follow design system tokens from `globals.css` and `tailwind.config.js`. No hardcoded colors.
- Sequential backup before code edits: `test5_*.tsx`.
- Must pass `npm run test:all` with 100% tests passing and zero regressions.

---

### Task 1: Sequential Backups & Sheet Primitive Fix (Double Cross Button)

**Files:**
- Backup: `frontend/test5_Sheet.tsx`, `frontend/test5_Header.tsx`, `frontend/test5_EntryScreen.tsx`, `frontend/test5_App.tsx`, `frontend/test5_HistoryModal.tsx`, `frontend/test5_FaqDrawer.tsx`, `frontend/test5_caseReducer.ts`
- Modify: `frontend/src/components/ui/sheet.tsx`
- Test: `frontend/src/tests/EvidenceDrawer.test.tsx`, `frontend/src/tests/ui.test.tsx`

**Interfaces:**
- `SheetContentProps`: add `hideDefaultClose?: boolean`
- When `hideDefaultClose={true}`, `<SheetPrimitive.Close>` is omitted, letting custom headers handle closing without a duplicate cross icon.

- [ ] **Step 1: Create sequential `test5` backups for files to be touched**
- [ ] **Step 2: Add failing/verifying test for `hideDefaultClose` on SheetContent**
- [ ] **Step 3: Update `SheetContent` in `sheet.tsx` to support `hideDefaultClose`**
- [ ] **Step 4: Update `EvidenceDrawer.tsx`, `FaqDrawer.tsx`, and `HistoryModal.tsx` to pass `hideDefaultClose`**
- [ ] **Step 5: Run tests to confirm zero duplicate close buttons**

---

### Task 2: Layout Adjustments & Spacing (Bottom Gap & Nav Bar Separation)

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/screens/EntryScreen.tsx`
- Modify: `frontend/src/components/screens/DashboardScreen.tsx`
- Test: `frontend/src/tests/screens.test.tsx`

**Details:**
- In `App.tsx`: change `<main className="flex-1 pb-16">` to `<main className="flex-1 pt-14">`. This removes the 64px phantom bottom gap between the viewport and the footer, and ensures content starts cleanly below the fixed 56px header.
- In `EntryScreen.tsx`: add clean vertical spacing (`pt-8 pb-12` instead of raw `py-16`) ensuring visible separation between "Decision Proposal" and the top nav bar on all screen sizes.
- In `DashboardScreen.tsx`: remove `v1.4` text and bullet separator from footer.

- [ ] **Step 1: Write test checking layout classes and absence of v1.4 in dashboard footer**
- [ ] **Step 2: Update `App.tsx`, `EntryScreen.tsx`, and `DashboardScreen.tsx`**
- [ ] **Step 3: Verify all layout tests pass**

---

### Task 3: Header Refactor (Remove v1.4, Remove Runner Ready, Remove Profile, Separate History & Settings)

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx`
- Test: `frontend/src/tests/Header.test.tsx`, `frontend/src/tests/telemetryAndHistory.test.tsx`

**Details:**
- Remove `v1.4-engine` pill.
- Remove `RUNNER READY` / `RUNNER ACTIVE` status pill completely.
- Remove profile icon ("CF" avatar).
- Add distinct **History** button (`history` icon, `title="Case History"`, `onClick={() => setActiveModal("history")}`).
- Add distinct **Settings** button (`settings` icon, `title="Settings"`, `onClick={() => setActiveModal("settings")}`).
- Make pipeline step navigation truthful: clicking `02 Claim Map`, `03 Live Runner`, or `04 Audit Sheet` when no case exists should not inject a hardcoded fake case (`DEFAULT_COLLEGE_AI_CASE`). Instead, disable unreached steps (or navigate to existing active case only).

- [ ] **Step 1: Update tests in `Header.test.tsx` for new header structure (separate history and settings, no v1.4, no runner ready, no avatar)**
- [ ] **Step 2: Implement header updates in `Header.tsx`**
- [ ] **Step 3: Run `npm test` on Header tests**

---

### Task 4: State Management & Case History Fixes

**Files:**
- Modify: `frontend/src/context/caseReducer.ts`
- Modify: `frontend/src/context/CaseContext.tsx`
- Modify: `frontend/src/components/features/HistoryModal.tsx`
- Test: `frontend/src/tests/caseReducer.test.ts`, `frontend/src/tests/telemetryAndHistory.test.tsx`

**Details:**
- Add `CLEAR_HISTORY` action to `caseReducer` so `state.caseHistory` is cleared to `[]`.
- Add `DELETE_HISTORY_ITEM` action to delete a single case by ID.
- In `HistoryModal.tsx`:
  - `handleClearHistory` dispatches `CLEAR_HISTORY` and removes from localStorage.
  - Add individual trash/delete button per history card.
  - Fix button text encoding `Test this ?` -> `Test this →`.
  - Remove "Live Engine v1.4" text from API target banner.
  - Ensure "View Memo" properly loads the case into dashboard view.

- [ ] **Step 1: Write tests for `CLEAR_HISTORY` and `DELETE_HISTORY_ITEM` in `caseReducer.test.ts`**
- [ ] **Step 2: Implement reducer actions and dispatch in `HistoryModal.tsx`**
- [ ] **Step 3: Verify tests pass**

---

### Task 5: Dedicated Settings Modal

**Files:**
- Create: `frontend/src/components/features/SettingsModal.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/tests/SettingsModal.test.tsx`

**Details:**
- Clarifies "What are the settings for?":
  - **API Target**: Endpoint URL (defaults to `http://localhost:8000`).
  - **Engine Mode**: Live Adversarial Scrutiny vs Offline Demo Mode.
  - **Active Evaluators**: Toggle individual evaluators (Devil's Advocate, Receipts Search, Feasibility Builder, Overthinker).
  - **Local Data**: Clear cached searches, reset all local storage data.
- Triggered by the new Settings button (`activeModal === "settings"`).

- [ ] **Step 1: Write tests for `SettingsModal.tsx`**
- [ ] **Step 2: Implement `SettingsModal.tsx` with full token styling and accessible controls**
- [ ] **Step 3: Wire into `App.tsx`**
- [ ] **Step 4: Verify tests pass**

---

### Task 6: Button Hover Polish & Design System Tokens

**Files:**
- Modify: `frontend/src/components/ui/button.tsx`
- Modify: button classes across `EntryScreen.tsx`, `ConfirmScreen.tsx`, `DashboardScreen.tsx`
- Test: `frontend/src/tests/ui.test.tsx`

**Details:**
- Update `buttonVariants` in `button.tsx` to use design system tokens (`bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim hover:shadow-md active:scale-[0.98]`, outline variant with `border-outline-variant hover:bg-surface-container-high`, etc.).
- Replace unpolished `hover:brightness-110` with token-based hover and active transitions.

- [ ] **Step 1: Update `buttonVariants` in `button.tsx`**
- [ ] **Step 2: Replace raw hover colors across screens with unified tokens**
- [ ] **Step 3: Verify styling and tests**

---

### Task 7: FAQ Drawer Spacing & Typography Polish

**Files:**
- Modify: `frontend/src/components/features/FaqDrawer.tsx`
- Test: `frontend/src/tests/faq.test.tsx`

**Details:**
- Expand drawer width from cramped size to `sm:w-[680px]`.
- Increase padding: header `p-space-6`, search/filter bar `p-space-5`, list container `p-space-6`, items `p-space-5`.
- Generous gap between items (`space-y-space-4`).
- Expand accordion answer typography: relaxed line height (`leading-relaxed`), comfortable reading size, proper whitespace.

- [ ] **Step 1: Update `FaqDrawer.tsx` styling for generous whitespace**
- [ ] **Step 2: Run `faq.test.tsx` and verify layout**

---

### Task 8: Ingestion Enhancements (Full Drag-and-Drop, Auto-Detect URLs, Windows/Mac Shortcuts)

**Files:**
- Modify: `frontend/src/components/screens/EntryScreen.tsx`
- Test: `frontend/src/tests/EntryScreen.test.tsx` or `frontend/src/tests/screens.test.tsx`

**Details:**
- **Drag & Drop**: Wrap the entire proposal card / drop zone with full drag-and-drop listener (`onDragOver`, `onDragLeave`, `onDrop`) showing a clear visual drag-over overlay ("Drop document or screenshot to attach"). Supports PDF and images even if an attachment already exists (replaces it).
- **Auto-Detect URLs**: In `onPaste` (and URL input detection), if the pasted text contains or is a valid URL (`http://` or `https://`), automatically trigger `ingestUrl` and attach it as the reference web URL, displaying an ingestion badge.
- **Windows/Mac Shortcuts**: Replace Mac-only `⌘` with dual or platform-aware shortcut hint: `<kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Enter</kbd>` or platform detection showing `Ctrl + Enter` on Windows and `⌘ + Enter` on Mac.

- [ ] **Step 1: Write unit tests for URL paste detection, drag-and-drop handling, and keyboard shortcut rendering**
- [ ] **Step 2: Implement full drag-and-drop and clipboard URL detection in `EntryScreen.tsx`**
- [ ] **Step 3: Implement platform-aware shortcut display**
- [ ] **Step 4: Run test suite to verify**

---

### Task 9: Full Verification & Definition of Done

**Files:**
- All modified files

- [ ] **Step 1: Run `npm run typecheck`**
- [ ] **Step 2: Run `npm test` (full vitest run)**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Verify zero errors, zero regressions, no git commits made**
