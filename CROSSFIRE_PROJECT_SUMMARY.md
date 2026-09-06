# Crossfire — Project Master Summary & Architecture Brief

> **Purpose:** This document provides a self-contained, end-to-end technical and product overview of **Crossfire**, including its architectural pipeline, data models, and an in-depth breakdown of the four evaluator personas. It is formatted for direct ingestion by external AI assistants to provide full context on the codebase, philosophy, and engineering constraints.

---

## 1. Executive Summary & Core Thesis

**Crossfire** is an automated **adversarial decision-testing engine** designed to stress-test high-stakes business, strategic, and technical proposals before committing capital, engineering hours, or reputation.

* **The Core Thesis:** *"Don't ask an AI if your idea is good — make it survive Crossfire."*
* **The Problem It Solves:** Frontier LLMs (ChatGPT, Claude, Gemini) inherently suffer from sycophancy (flattery bias) and drift toward agreement or generic advice. AI "councils" or consensus-voting systems suffer from groupthink and error propagation.
* **The Crossfire Approach:** Crossfire acts as an automated **"crash test for decisions."** It compiles a user's rough proposal into discrete, checkable claims, determines which claims are **load-bearing** (claims whose failure would collapse the decision), subjects them to an adversarial panel of 4 independent evaluators, grounds them in live empirical web evidence, and synthesizes the results into an executive **Decision Memo** featuring actionable strategic pivots and concrete real-world validation experiments.
* **Epistemic Honesty:** Crossfire does not claim to be an omniscient oracle. It exposes assumptions, highlights conflicting evidence, and measures uncertainty rather than promising absolute truth.

---

## 2. End-to-End Pipeline & Execution Lifecycle

Crossfire operates around a single central data object called a **`Case`**, passing through a structured lifecycle over asynchronous Python pipelines and streaming updates to the frontend via **Server-Sent Events (SSE)**:

```
[User Input / Docs / URLs]
           │
           ▼
1. Claim Extraction (`POST /cases`) ──► Generates 2–5 discrete, falsifiable claims
           │
           ▼
2. User Confirmation Gate (`POST /cases/{id}/confirm`) ──► Human-in-the-loop: Edit, add, or prune claims
           │
           ▼ (Decoupled background async task with SSE streaming via `GET /cases/{id}/stream`)
3. Load-Bearing Analysis ──► Is claim critical? ("If false, does the decision materially change?")
           │
           ▼
4. Test Plan Generation ──► Maps failure modes & assigns evaluators to claims
           │
           ▼
5. Parallel Adversarial Testing (`asyncio.gather`) ──► 4 Evaluators run in STRICT isolation
   ├── Devil's Advocate (Assumption Test)
   ├── Receipts (Evidence Test + Live Web Search / Scraping)
   ├── Builder (Feasibility Test)
   └── Overthinker (Edge-Case Test)
           │
           ▼
6. Judicial Reconciliation (Judge) ──► Reconciles findings (Survives, Weakens, Breaks, or Unresolved)
           │
           ▼
7. Strategic Consequence Synthesis ──► Tailored pivot recommendations + smallest next validation experiments
           │
           ▼
[Final Decision Memo & Evidence Drawer] (`GET /cases/{id}`)
```

### Key API & Lifecycle Endpoints:
1. `POST /cases`: Ingests raw input, pasted URLs, or documents (PDFs/images via OCR) and extracts 2 to 5 falsifiable claim statements (`status: awaiting_confirmation`).
2. `GET /cases/{id}/stream`: Opens an SSE listener queue keyed by `case_id` for real-time progress events.
3. `POST /cases/{id}/confirm`: Locks user-approved claims, responds with `202 Accepted` immediately, and schedules the asynchronous pipeline in the background.
4. `GET /cases/{id}`: Returns the complete, hydrated `Case` object for rendering the interactive Decision Memo and Evidence Drawer.

---

## 3. Data Contracts & State Machine (`backend/core/models.py`)

The backend passes a unified state object (`Case`) across the entire lifecycle:

```python
from enum import Enum
from pydantic import BaseModel

class ClaimStatus(str, Enum):
    SURVIVED = "survived"      # Passed scrutiny; supported by evidence and logic
    WEAKENED = "weakened"      # Still stands, but damaged, disputed, or carries heavy caveats
    BROKEN = "broken"          # Critical assumption or premise invalidated
    UNRESOLVED = "unresolved"  # Conflicting or thin evidence; a measured state of uncertainty

class Claim(BaseModel):
    id: str
    statement: str
    load_bearing: bool | None = None  # Critical claim flagged by load-bearing classifier
    status: ClaimStatus | None = None

class TestPlanItem(BaseModel):
    id: str
    target_claim: str                 # References Claim.id
    failure_mode: str                 # "assumption" | "evidence" | "feasibility" | "edge-case"
    objective: str

class EvidenceItem(BaseModel):
    source_url: str
    title: str | None = None
    snippet: str                      # Curated 1-3 sentences relevant to the claim
    retrieved_at: str

class Finding(BaseModel):
    claim_id: str
    test_id: str
    evaluator: str                    # "devils_advocate" | "receipts" | "builder" | "overthinker"
    result: str                       # One-sentence outcome summary
    evidence: list[EvidenceItem] = [] # Empirical citations (Receipts only)
    reasoning: str                    # Detailed analytical critique
    confidence: float                 # 0.0 to 1.0
    contradiction: str | None = None  # Specific logical or empirical flaw surfaced

class DecisionConsequence(BaseModel):
    claim_id: str
    impact: str                       # "high" | "medium" | "low"
    recommended_change: str           # Concrete, tailored strategic pivot or mitigation
    next_validation: str | None = None# Smallest, lowest-cost real-world experiment
    verdict_reasoning: str = ""       # Judicial reconciliation rationale

class Case(BaseModel):
    id: str
    raw_input: str
    context: str | None = None        # Extracted text from uploaded documents or pasted URLs
    claims: list[Claim] = []
    test_plan: list[TestPlanItem] = []
    findings: list[Finding] = []
    consequences: list[DecisionConsequence] = []
    status: str = "extracting"        # extracting | awaiting_confirmation | testing | done | error
```

---

## 4. The 4 Evaluator Personas (In Detail)

The adversarial evaluation panel is built on the principle of **strict structural independence** (derived from multi-agent debate research such as *Free-MAD*): **no evaluator ever sees another evaluator's output during execution**. This prevents groupthink, consensus bias, and cascading hallucinations.

> **Crucial UI Rule:** Internal persona code names (`devils_advocate`, `receipts`, `builder`, `overthinker`) are strictly **masked in the user interface** and presented as objective, CI-style test runners (*Assumption Test*, *Evidence Test*, *Feasibility Test*, *Edge-Case Test*).

---

### Persona 1: Devil's Advocate
* **UI Test Label:** `Assumption Test`
* **Target Failure Mode:** `assumption` (unstated premises, flawed logic, misaligned incentives, optimism bias)
* **Code Implementation:** `backend/core/evaluators/devils_advocate.py`
* **Operational Role & Objective:**
  Devil's Advocate is a pure analytical logician. Its sole job is to aggressively interrogate the target claim by unearthing implicit assumptions, unstated premises, cognitive blind spots, and counter-incentives. It does **not** search the web; its scrutiny is deductive, sharp, and grounded in domain first-principles.
* **Key Analytical Questions:**
  * *"What must secretly be true for this assumption to hold?"*
  * *"Where is the flaw in the human incentive structure?"*
  * *"What cognitive bias or wishful thinking is masking risk here?"*
* **Structured Output Schema (`DevilsAdvocateOutput`):**
  * `result`: A concise 1-sentence verdict summarizing the assumption flaw.
  * `reasoning`: Deep analytical breakdown exposing premise flaws and perverse dynamics.
  * `confidence`: Float (`0.0` to `1.0`).
  * `contradiction`: The fundamental logical contradiction or contrary dynamic identified.

---

### Persona 2: Receipts
* **UI Test Label:** `Evidence Test`
* **Target Failure Mode:** `evidence` (empirical claims, pricing, market size, conversion, user behavior, benchmarks)
* **Code Implementation:** `backend/core/evaluators/receipts.py`
* **Operational Role & Objective:**
  Receipts is the external verification investigator. It is the **only** evaluator connected to the web search and scraping pipeline. It tests whether real-world empirical data, industry benchmarks, market reports, or competitor realities support or refute the claim.
* **Adaptive Scrutiny & Deep Fetching:**
  1. Executes a DuckDuckGo Lite search via Scrapling's `AsyncFetcher` (zero API key cost).
  2. If the claim is flagged as **`load_bearing`** and the snippet is thin (<150 characters or <2 sentences), it triggers an automated deep-page fetch using Scrapling to bypass anti-bot walls on primary competitor or documentation pages.
  3. Curates snippets into 1–3 dense sentences relevant to the claim.
* **The "Zero-Evidence" Rule:**
  A negative finding with no evidence is never allowed to be a confident negative. If search yields zero results, confidence is capped at $\le 0.35$, steering the claim toward `unresolved` rather than a false negative.
* **Structured Output Schema (`ReceiptsAssessment` / `Finding`):**
  * `result`: Summary of empirical alignment or divergence.
  * `reasoning`: Factual synthesis citing specific sources.
  * `evidence`: Array of `EvidenceItem` objects (`source_url`, `title`, `snippet`, `retrieved_at`).
  * `contradiction`: Empirical counter-evidence or conflicting market data found.

---

### Persona 3: Builder
* **UI Test Label:** `Feasibility Test`
* **Target Failure Mode:** `feasibility`, `behavior`, `constraint` (technical viability, latency, scaling, integrations, compliance, platform constraints)
* **Code Implementation:** `backend/core/evaluators/builder.py`
* **Operational Role & Objective:**
  Builder is a pragmatic, battle-hardened senior systems engineer and technical architect. It does not care if the idea sounds great in a slide deck; it evaluates whether it can **actually be implemented as stated** with real-world infrastructure, software architectures, latency limits, API dependencies, and regulatory bounds (e.g., GDPR, HIPAA, SOC2).
* **Key Analytical Questions:**
  * *"What APIs, data pipelines, or system permissions does this actually depend on?"*
  * *"Will latency, rate limits, cold starts, or token costs break unit economics?"*
  * *"What is the operational burden of keeping this system alive?"*
* **Structured Output Schema (`BuilderVerdict`):**
  * `result`: One-sentence feasibility verdict.
  * `reasoning`: Concrete technical and operational realities analyzed.
  * `confidence`: Float (`0.0` to `1.0`).
  * `blocker`: **The single hardest technical or operational blocker** standing in the way (or `null` if ordinary effort).

---

### Persona 4: Overthinker
* **UI Test Label:** `Edge-Case Test`
* **Target Failure Mode:** `edge-case`, `alternative` (catastrophic tail risks, boundary failures, abuse, adversarial exploitation, systemic feedback loops)
* **Code Implementation:** `backend/core/evaluators/overthinker.py`
* **Operational Role & Objective:**
  Overthinker is the paranoid stress-tester. It explores boundary condition breakdowns, degenerate user behavior, adversarial attack vectors (e.g., prompt injection, abuse, fraud), second-order systemic feedback loops, and rare "black swan" tail risks that occur when a system scales.
* **Key Analytical Questions:**
  * *"What happens at extreme boundary conditions (e.g., 0% network, 100x traffic spike, hostile users)?"*
  * *"How could bad actors game or weaponize this mechanism?"*
  * *"What catastrophic cascading failure mode are the founders ignoring?"*
* **Structured Output Schema (`OverthinkerOutput`):**
  * `result`: Concise edge-case vulnerability summary.
  * `reasoning`: Analytical walkthrough of boundary breakdowns and systemic risks.
  * `confidence`: Float (`0.0` to `1.0`).
  * `contradiction`: Specific edge vulnerability or exploit dynamic identified.

---

### The Judicial Reconciler (The "Judge")
While not an isolated test runner, the **Judge** (`reconcile()` in `backend/core/loop.py`) is the central adjudicator that synthesizes findings:
* **Anti-Voting Principle:** Evaluators do not vote, and scores are never averaged.
* **Synthesis Mechanism:** The Judge reviews all evaluator findings for a claim simultaneously. Evidence-backed findings from *Receipts* carry heavy weight; verified architectural blockers from *Builder* or fatal logical flaws from *Devil's Advocate* can break a claim even if search results look positive.
* **4 Reconciled Verdict States:**
  1. `survived` (Emerald `#34d399`): The claim withstood tests; supported by evidence and sound logic.
  2. `weakened` (Amber `#fbbf24`): The claim stands, but carries notable caveats, friction, or unmitigated risks.
  3. `broken` (Rose `#f87171`): The claim is refuted by empirical evidence or a fatal structural blocker.
  4. `unresolved` (Violet `#818cf8`): Evidence was conflicting or absent. This is a **measured outcome of uncertainty**, styled in distinct violet — **never gray or disabled**.

---

## 5. Decision Consequence & Strategic Value Engine

Following judicial reconciliation, Crossfire runs `synthesize_consequences()` in `backend/core/loop.py` to formulate executive-level guidance for broken, weakened, or unresolved claims:

1. **Impact Rating (`impact`):**
   * `high`: Load-bearing claim that is broken or unresolved.
   * `medium`: Claim is weakened.
   * `low`: Surviving or non-load-bearing claim.
2. **Recommended Strategic Pivot (`recommended_change`):**
   * Actionable, concrete commercial or technical adjustments (e.g., *"Shift from a 100% autonomous model to a hybrid AI-first model with sentiment-triggered human escalation"* rather than platitudes like *"Rework the idea"*).
3. **Smallest Next Validation Experiment (`next_validation`):**
   * The cheapest real-world experiment to de-risk open uncertainty before spending capital (e.g., *"Run a 30-day shadow containment test on tier-1 refund requests before altering human headcount"*).

---

## 6. Evidence, Search, & Ingestion Subsystems

* **DuckDuckGo Lite Discovery:** Handled by Scrapling's `AsyncFetcher`. Completely free of API keys, fast, and resilient.
* **Adaptive Scrutiny Deep Fetching:** For load-bearing claims with thin initial search snippets, Scrapling deep-fetches candidate URLs using anti-bot bypass techniques to inspect primary documentation or competitor pricing pages directly.
* **Contextual Snippet Curation:** Extracts 1–3 dense sentences directly answering the claim, preventing prompt bloat and context poisoning.
* **Zero-C-Dependency OCR & PDF Ingestion:**
  * Digital PDFs: Extracted via `pypdf` in $<10$ ms.
  * Scanned/Image PDFs: Converted to memory images via `pymupdf` (PyMuPDF).
  * Direct Image Uploads & Scanned Pages: Processed locally using ONNX-based **RapidOCR** (`rapidocr_onnxruntime`), requiring zero OS-level dependencies (no Tesseract, Ghostscript, poppler, or QPDF).

---

## 7. UI/UX Design System & Principles

* **Executive Dark-First Theme:** Engineered for deep focus and zero glare using a zinc palette (Root Canvas: `#09090b`, Cards: `#18181b`, Borders: `#27272a`, Text: `#f4f4f5`).
* **Zero Fake Telemetry:** No pulsing radar beacons, fake AI loading animations, or unbuilt widget mocks. Real progress is communicated via calm, truthful status bars and SSE updates.
* **Evidence Always One Click Away:** Every claim card in the decision memo opens a slide-over **Evidence Drawer (Sheet)** revealing the full audit trail: why the claim is load-bearing, which tests ran, primary source URLs with quotes, contradictions, and recommended validation experiments.
* **Strict Color Exclusivity:** Verdict colors (Emerald, Amber, Rose, Violet) are strictly reserved for claim verdicts and test outcomes. They are never used for general buttons or generic form badges.

---

## 8. Technology Stack Summary

| Layer | Technologies Used | Key Characteristics |
|---|---|---|
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, Uvicorn | Strict typing, high async concurrency, OpenAPI documentation. |
| **Orchestration** | Native Python `asyncio` (`asyncio.gather`, `asyncio.Queue`) | Lightweight, zero-framework overhead (no LangGraph/CrewAI bloat). |
| **LLM Provider Layer** | Custom `LLMProvider` Protocol (`providers/`) | Native structured outputs (`response_schema`), supporting Gemini, Anthropic, and OpenAI-compatible endpoints. |
| **Web Research** | DuckDuckGo Lite, Scrapling | Keyless web discovery, stealth deep page fetching, and anti-bot bypass. |
| **Ingestion** | PyMuPDF, RapidOCR (ONNX Runtime), pypdf | 100% local, dependency-free text and OCR ingestion. |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS | High performance, single-page application with Server-Sent Events. |
| **UI Primitives** | Radix UI, shadcn/ui, Lucide Icons | Accessible, dark-mode first, keyboard-navigable components. |

---

## 9. Ground Rules for External AI Collaborators

When contributing code, prompts, or design changes to Crossfire, adhere strictly to these engineering constraints:

1. **Preserve Evaluator Isolation:** Evaluators must evaluate only their own target claim and context. Never pass the findings of one evaluator to another during testing.
2. **Enforce Evaluator Masking:** Never expose internal persona names (`devils_advocate`, `receipts`, `builder`, `overthinker`) in client-facing code, UI components, or error messages. Map them strictly to their corresponding Test names.
3. **Protect `unresolved` as an Active Outcome:** Never treat `unresolved` as an error or render it in gray. It represents a valid, measured state of uncertainty where evidence was conflicting or absent.
4. **Demand Concrete Decision Consequences:** When tuning prompts for consequences, never allow output to lapse into generic advice. Strategic pivots and validation experiments must be concrete, operational, and commercially actionable.
