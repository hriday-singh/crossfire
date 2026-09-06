---
name: general
description: the workflow that the ai agent must follow when developing
---


# General AI dev skill

## When to use

Use when developing and debugging anything

## Default Tech Stack

| Layer | Default / Packages |
|---|---|
| **Frontend Framework** | React 19 + TypeScript (Strict Mode) + Vite |
| **Styling & Design System** | Tailwind CSS (CSS variables) + Radix UI primitives (`shadcn/ui`) |
| **Icons** | `lucide-react` |
| **Networking & Streaming** | Native `fetch` + Native `EventSource` (SSE streaming) |
| **State Management** | React Context + deterministic `useReducer` for SSE events |

**UI Philosophy & Non-Negotiables:**
- Clean, readable Executive Decision Memo layout in Dark Mode (`#09090b` canvas, `#18181b` cards, `#f4f4f5` text). High contrast, generous whitespace, calm typography.
- Zero fake telemetry: No glowing blue "LIVE" dots, no fake dropzones, no impact meters, no unbuilt settings modals.
- No 3D, WebGL, or heavy canvas shaders. Fast (<150ms) CSS transitions only.

**Agent Skills & Tooling Active in Workspace:**
- `shadcn/ui`
- `minimalist-ui`


## Workflow

1. **Understand**
   - Understand the user's objective and the existing project.
   - Inspect relevant files, code, and configuration before making changes.
   - Identify important requirements and constraints.

2. **Clarify**
   - If the objective is ambiguous or important information is missing, ask for clarification.
   - Do not make major assumptions when clarification is needed.

3. **Plan**
   - Break the objective into logical steps.
   - Choose an appropriate approach before implementing it.
   - Consider existing code and prefer reusing it when appropriate.

4. **Implement**
   - Complete the task step by step.
   - Keep changes focused and organized.
   - **Mandatory Unit Tests**: Every new or changed component, hook, reducer, formatter, or utility MUST ship with unit tests in `src/tests/` in the same pass. See `frontend/TESTING.md`.
   - Explain important decisions when useful.

5. **Verify**
   - **Always run tests**: Execute `npm run test:all` (or `npm run typecheck && npm test`).
   - Ensure 100% test pass rate with zero failures, zero errors, and zero regressions.
   - Verify that the implementation actually satisfies the original objective.
   - Fix problems discovered during verification.

6. **Review**
   - Review the final result for correctness, consistency, and unnecessary changes.
   - Report what was completed and mention any remaining issues.




 