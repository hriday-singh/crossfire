# 🚀 Crossfire (Frontend)

[![Powered by SerpApi](https://img.shields.io/badge/Search%20Grounding-Powered%20by%20SerpApi-377FEA?style=flat&logoColor=white)](https://serpapi.com)

Interactive web client for Crossfire, built with React, Vite, and Tailwind CSS. Crossfire stress-tests strategic proposals, extracts load-bearing assumptions, routes them across a panel of independent evaluators, and reconciles the findings into actionable verdicts via the **Steel Man** ("Break to Rebuild") protocol.

---

## 🔍 Evidence Grounding via SerpApi & DuckDuckGo Lite

Real-time search grounding and empirical evidence extraction across all stress-tested claims are powered by **[SerpApi](https://serpapi.com)** with automatic zero-config fallback to **DuckDuckGo Lite** (via Scrapling). When the **Researcher** agent evaluates empirical claims (pricing, market size, conversion, benchmarks), it cross-checks assumptions against live web results to identify unproven claims and empirical contradictions, complete with citation metadata and provenance badges.

---

## 🤖 The Testing Panel & Agent Identities

Crossfire employs 4 specialized evaluator agents running independent, blind tests, adjudicated by a judicial reconciler:

| Agent Identity | UI Test Label | Failure Modes / Scope | Role Description |
|---|---|---|---|
| **Devil's Advocate** (`devils_advocate`) | **Assumption Test** | `assumption` | Evaluates deductive validity, unstated premises, cognitive blind spots, and misaligned incentives without external search. |
| **Researcher** (`researcher`, alias `receipts`) | **Evidence Test** | `evidence` | Queries public sources, benchmarks, and competitor documentation via SerpApi (with Scrapling fallback). Deep-fetches pages for load-bearing claims. |
| **Builder** (`builder`) | **Feasibility Test** | `feasibility`, `behavior`, `constraint` | Evaluates engineering viability, required APIs, data access, latency budgets, unit economics, and compliance boundaries (GDPR, HIPAA, SOC2). |
| **Operator** (`operator`, alias `overthinker`) | **Operational Friction Test** | `operational_friction`, `adoption`, `bureaucracy` | Stress-tests operational friction, adoption inertia, enterprise procurement/CISO gatekeeping, regulatory liability, and process drag. |
| **Steel Man** (`steelman` / `steel_man`) | **Steel Man Verdict** | Judicial Reconciliation | Central adjudicator running the **Break to Rebuild** protocol. Synthesizes findings, enforces the evidence gate, and re-architects broken claims. |

### 🛡️ Strict UI Masking Rule (Zero Leakage)
In accordance with Crossfire design standards, internal persona identifiers (`devils_advocate`, `receipts`, `builder`, `operator`) are **strictly masked** in client-facing UI components and rendered as objective test suites (*Assumption Test*, *Evidence Test*, *Feasibility Test*, *Operational Friction Test*).

### 🔨 Steel Man Protocol: "Break to Rebuild"
When an assumption is broken or weakened, the Steel Man does not simply reject the proposal. It outputs:
1. **Fatal Flaw:** The precise structural or empirical vulnerability that invalidates the original claim.
2. **Salvaged Claim:** The minimal viable re-architecture of the assumption that preserves the founder's strategic upside while bypassing the fatal flaw.
3. **Trade-off Acknowledged:** The explicit concession made in the pivot (e.g. trading automated throughput for human-in-the-loop compliance).

---

## 🖥️ Screen Flow & Key Features

1. **Proposal Entry Canvas (`EntryScreen`):**
   - Natural language proposal input (up to 500 characters).
   - Ingests external reference materials via auto-detected URLs, PDF documents, or screenshot images (OCR extracted).
   - Agent selection panel: Toggle between automated optimal agent routing and custom evaluator suites.

2. **Extraction & Confirmation Gate (`ClaimExtractionReview`):**
   - Displays 2–5 falsifiable claims extracted by the model.
   - Human-in-the-loop controls: Edit statements, delete unneeded claims, add missing assumptions, and fine-tune evaluator assignments before compute is spent.

3. **Live Adversarial Runner (`LiveRunner`):**
   - Real-time Server-Sent Events (SSE) streaming (`test_started`, `finding_ready`, `verdict_ready`, `consequence_ready`).
   - Live activity pulse feed showing evaluator actions in real time.
   - Active test execution matrix tracking parallel progress.

4. **Decision Dashboard & Executive Memo (`ResultsScreen`):**
   - Overall strategic assessment and scoreboard (Survived, Weakened, Broken, Unresolved).
   - Interactive claim cards highlighting load-bearing status, verdicts, and Steel Man salvage plans.
   - 1-click export of an authoritative Markdown Decision Memorandum to the clipboard.

5. **Evidence Drawer (`EvidenceDrawer`):**
   - Inspects cited web evidence, domain badges, snippet quotes, and SerpApi provenance.
   - Shows detailed finding contradictions, confidence metrics, and evaluator reasoning.

6. **Settings & Zero-Backend Preview Catalog (`DebugViewsToolbar`):**
   - Switch LLM providers and models (Gemini, Claude, OpenAI-compatible).
   - Developer preview mode: 1-click navigation across all 10 view variations using realistic mock data without requiring a live backend.

---

## 🛠️ Tech Stack

* **Framework:** React 18 (TypeScript) + Vite
* **Styling:** Tailwind CSS with CSS custom properties design tokens
* **Icons:** SerpApi brand vector icon, Material Symbols Outlined
* **Testing:** Vitest + React Testing Library (161 tests across 25 suites)
* **Code Architecture:** Strict modularity with zero files exceeding 700 lines

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Start development server
```bash
npm run dev
```
The client starts at `http://localhost:5173` with automatic reverse-proxy routing for backend endpoints (`/cases`, `/ingest`, `/health`, `/ready`) to the backend on default port 8000.

### 3. Run tests and typechecking
```bash
# Run unit tests with Vitest
npm test

# Run TypeScript compiler check
npm run build
```