# Crossfire — Dynamic Agent Selection & Claim-Driven Auto-Recommendation Spec

- **Date:** 2026-09-06
- **Status:** Approved
- **Author:** Dev A

---

## 1. Executive Summary & Objectives

Crossfire tests strategic decisions and technical proposals through an adversarial panel of specialized evaluators (agents). Until now, all active evaluators ran against all claims unconditionally or under fixed keywords without user customization.

This specification introduces **Dynamic Agent Selection**:

1. **Ingestion Step (Screen 1 / `EntryScreen`)**:
   - A compact, expandable agent panel allows users to leave selection on **Auto (Default)** or choose **Custom** to pre-select specific agents before extraction begins.
2. **Claim Decision & Auto-Recommendation**:
   - When claims are extracted, if in Auto mode, Crossfire analyzes the claims (topics, keywords, feasibility, edge risks, empirical evidence needs) and automatically selects the optimal agent suite along with clear rationales explaining why each agent was picked ("I'm going to use this, this, this").
3. **Claim Confirmation Step (Screen 2 / `ConfirmScreen`)**:
   - Users review extracted assumptions alongside the assigned agent panel.
   - Users can freely **select or deselect any agents** right here, with instant validation enforcing at least one active agent.
4. **Execution & Backend Pipeline (`POST /cases/{id}/confirm`, `core/loop.py`)**:
   - The test plan schedules tests _only_ for the confirmed selected agents.
   - Judgments and consequences reconcile cleanly based on active findings.
5. **Data Persistence & SQL Migration**:
   - Migration `migrations/002_add_agent_selection_to_cases.sql` provides explicit database columns (`agent_mode`, `selected_agents`) alongside full SQLite JSON serialization in `cases`.

---

## 2. Agent Catalog & UI Masking Rules

Adhering to Crossfire's product rules (evaluator internal IDs masked to failure-mode test names):

| Agent ID          | Masked UI Test Name  | Semantic Role & Heuristic Trigger                                                                                                                                           | Default in Auto                                                  |
| ----------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `devils_advocate` | **Assumption Test**  | Stress-tests implicit premises, logical contradictions, and unstated assumptions. Always foundational.                                                                      | Yes                                                              |
| `receipts`        | **Evidence Test**    | Verifies empirical claims, market sizing, pricing, conversion, and costs against web evidence. Triggered by empirical & market claims.                                      | Yes                                                              |
| `builder`         | **Feasibility Test** | Assesses engineering bottlenecks, API limits, performance, compliance, and architectural blockers. Triggered by tech/ops claims or load-bearing status.                     | Conditional / Recommended when tech/ops keywords or load-bearing |
| `overthinker`     | **Edge-Case Test**   | Identifies catastrophic tail risks, boundary failures, edge vulnerabilities, and worst-case user exploits. Triggered by extreme claims, uniqueness, or load-bearing status. | Conditional / Recommended when edge keywords or load-bearing     |

---

## 3. Backend Architecture & Contracts

### 3.1 Data Model Extensions (`core/models.py`)

```python
class Case(BaseModel):
    id: str
    raw_input: str
    context: str | None = None
    claims: list[Claim] = []
    test_plan: list[TestPlanItem] = []
    findings: list[Finding] = []
    consequences: list[DecisionConsequence] = []
    status: str = "extracting"
    agent_mode: str = "auto"                    # "auto" | "custom"
    selected_agents: list[str] = [              # active evaluator IDs
        "devils_advocate", "receipts", "builder", "overthinker"
    ]
    agent_rationales: dict[str, str] = {}       # reasoning for each auto-selected agent
```

### 3.2 API Schemas (`api/schemas.py`)

- `CreateCaseRequest`:
  ```python
  class CreateCaseRequest(BaseModel):
      raw_input: str = Field(min_length=3, max_length=10000)
      context: str | None = Field(default=None, max_length=50000)
      agent_mode: str | None = "auto"
      selected_agents: list[str] | None = None
  ```
- `ConfirmCaseRequest`:
  ```python
  class ConfirmCaseRequest(BaseModel):
      claims: list[Claim] | None = None
      selected_agents: list[str] | None = None
  ```

### 3.3 Dynamic Auto-Selection Heuristic (`core/loop.py`)

Function: `determine_auto_agents(claims: list[Claim]) -> tuple[list[str], dict[str, str]]`

- `devils_advocate` is always included: _"Stress-tests implicit premises and counter-incentives across all extracted claims."_
- `receipts` is included if empirical, cost, pricing, or market signals are present, or by default: _"Searches external empirical evidence and market benchmarks for factual assertions."_
- `builder` is included if technical, infrastructure, latency, performance, or operational constraints appear: _"Evaluates engineering feasibility, latency bottlenecks, and operational blockers."_
- `overthinker` is included if risk, competitor, boundary, or uniqueness claims appear: _"Identifies worst-case tail risks, boundary failures, and second-order vulnerabilities."_

### 3.4 Test Plan Execution (`build_test_plan`)

`build_test_plan(case: Case, panel: bool = True, active_agents: list[str] | None = None)`:
Filters test items to only include failure modes corresponding to `active_agents`:

- `devils_advocate` $\rightarrow$ `failure_mode == "assumption"`
- `receipts` $\rightarrow$ `failure_mode == "evidence"`
- `builder` $\rightarrow$ `failure_mode in ("feasibility", "behavior", "constraint")`
- `overthinker` $\rightarrow$ `failure_mode in ("edge-case", "edge_case", "alternative")`

---

## 4. Frontend UI & State Architecture

### 4.1 Ingestion Screen (`EntryScreen.tsx`)

- Located below the textarea and above the action row.
- Rendered as a compact expandable card styled with design tokens:
  - Collapsed: Clean row with an icon, _"Agent Suite: Auto (Recommended)"_, and an "Expand / Customize" trigger.
  - Expanded: Segmented toggle between **Auto** and **Custom**.
    - When **Custom** is selected: Checkbox cards for all 4 agents with display name, masked test label, and brief description.
- State persists into `CaseContext` so if a user starts extracting, `agent_mode` and `selected_agents` are transmitted via `createCase`.

### 4.2 Alignment Screen (`ConfirmScreen.tsx`)

- Placed directly between the Extracted Assumptions stack and the Bottom Actions row.
- **Header**: _"Assigned Adversarial Agents (N active)"_.
- In **Auto Mode**:
  - Displays a clean guidance banner: _"Based on your extracted claims, Crossfire selected the following agents:"_
  - Shows each agent with its auto-generated rationale tag.
- **Interactive Toggles**:
  - All 4 agents rendered as interactive toggle cards/chips.
  - Clicking any card toggles selection on/off.
  - If a user deselects or selects an agent, the run updates `selected_agents`.
  - Validation: If 0 agents are selected, an error message appears and "Run Tests" is disabled.

### 4.3 Reducer & API Client

- `caseReducer.ts`:
  - Add actions: `SET_AGENT_MODE`, `TOGGLE_AGENT`, `SET_SELECTED_AGENTS`.
  - In `EXTRACTING_SUCCESS`: hydrates `agent_mode`, `selected_agents`, and `agent_rationales` from the backend response.
- `lib/api.ts`:
  - Update `createCase(rawInput, context, agentMode, selectedAgents)`
  - Update `confirmCase(caseId, claims, selectedAgents)`

---

## 5. SQL Migration (`migrations/002_add_agent_selection_to_cases.sql`)

```sql
-- Migration: 002_add_agent_selection_to_cases.sql
-- Description: Add agent_mode and selected_agents columns to cases table for direct queryability and audit trails.

ALTER TABLE cases ADD COLUMN agent_mode TEXT DEFAULT 'auto';
ALTER TABLE cases ADD COLUMN selected_agents TEXT DEFAULT '["devils_advocate","receipts","builder","overthinker"]';
```

_(Per user global rule: File generated only, never auto-applied by agent)._

---

## 6. Testing & Quality Strategy

1. **Backend Unit Tests**:
   - `tests/core/test_loop.py`: test `determine_auto_agents` heuristics, test `build_test_plan` respects `selected_agents`.
   - `tests/api/test_routes.py`: test `POST /cases` with `agent_mode="custom"`, test `POST /cases/{id}/confirm` with `selected_agents`.
2. **Frontend Unit Tests**:
   - `src/tests/EntryScreen.test.tsx`: test expanding agent panel and toggling custom agents.
   - `src/tests/ConfirmScreen.test.tsx`: test agent selection/deselection and minimum 1 agent constraint.
   - `src/tests/caseReducer.test.ts`: test agent actions.
   - `src/tests/api.test.ts`: test payload propagation.
   - Run `npm run test:all` (must pass 100%).
