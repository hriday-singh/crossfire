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
[User Input / Docs / URLs / Markdown]
           │
           ▼
1. Claim Extraction (`POST /cases`) ──► Generates 2–5 discrete, falsifiable claims
   └── nothing testable? ──► 1b. Zero-Claim Recovery: one clarifying question, the
                             missing pieces, how the input was read, and up to 3
                             *provisional* claims traceable to the user's own words.
                             `POST /cases/{id}/clarify` merges the answer, re-extracts,
                             and auto-launches the run on success.
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
   ├── Researcher (Evidence Test + Live Web Search via SerpApi / Scrapling)
   ├── Builder (Feasibility Test)
   └── Operator (Operational Friction Test)
           │
           ▼
5.5 Cross-Examination Probes ──► Each load-bearing claim's strongest *unsourced* blocker
     gets one targeted search (authority-scoped when it asserts a published rule)
           │
           ▼
6. Judicial Reconciliation & Re-Architecture (Steel Man) ──► Reconciles findings + Break to Rebuild protocol
           │
           ▼
7. Strategic Consequence Synthesis ──► Tailored pivot recommendations + smallest next validation experiments
           │
           ▼
8. Case Verdict ──► decision_state + headline + deciding factor + 2–3 claim-anchored next actions
           │
           ▼
[Final Decision Memo & Evidence Drawer] (`GET /cases/{id}`) ──► optional Prompt Fixer rewrite
```

### Key API & Lifecycle Endpoints:
1. `POST /cases`: Ingests raw input, pasted URLs, or documents (PDFs/images via OCR) and extracts 2 to 5 falsifiable claim statements (`status: awaiting_confirmation`, or `needs_input` with a recovery payload).
2. `POST /cases/{id}/clarify`: Answers a zero-claim recovery question, merges it into the original input, re-extracts, and auto-launches the pipeline when claims now exist.
3. `GET /cases/{id}/stream`: Opens an SSE listener keyed by `case_id`. The history is append-only, so a late or reconnecting listener replays every missed event before joining live.
4. `POST /cases/{id}/confirm`: Locks user-approved claims, responds with `202 Accepted` immediately, and schedules the asynchronous pipeline in the background.
5. `GET /cases/{id}`: Returns the complete, hydrated `Case` object for rendering the interactive Decision Memo and Evidence Drawer.
6. `POST /cases/{id}/improve_prompt`: Prompt Fixer — rewrites the original decision statement around the claims that broke or weakened.
7. `POST /ingest/url` · `/ingest/pdf` · `/ingest/image` · `/ingest/markdown`: Produce the `context` field from an external source.
8. `POST /baseline`: Single-prompt control answer for side-by-side comparison.
9. `/providers/*`: Provider, API key, model-enablement, fallback-order, and connectivity-test management (see §6b).

**SSE events:** `claim_map_ready`, `needs_input`, `load_bearing_ready`, `test_started`, `finding_ready`, `verdict_ready`, `consequence_ready`, `case_verdict`, `telemetry_ready`, `activity`, `run_complete`, `error`.

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

class WeakenedKind(str, Enum):
    QUALIFIED = "qualified"    # Holds under narrower conditions
    CONTESTED = "contested"    # Disputed by a live counter-position

class Claim(BaseModel):
    id: str
    statement: str
    provisional: bool = False              # Inferred during zero-claim recovery; must be human-accepted
    load_bearing: bool | None = None       # Critical claim flagged by load-bearing ranking
    load_bearing_reason: str | None = None # Why this claim is load-bearing or secondary
    status: ClaimStatus | None = None
    weakened_kind: WeakenedKind | None = None  # Derived, only when status is WEAKENED
    confidence: float | None = None        # Synthetic claim confidence: 0.0 (broken) to 1.0 (validated)
    fatal_flaw: str | None = None              # Steel Man fatal flaw analysis
    salvaged_claim: str | None = None          # Minimal viable re-architecture
    tradeoff_acknowledged: str | None = None   # Explicit concession/trade-off
    missing_input: str | None = None       # UNRESOLVED only: the exact number/document that would settle it
    salvage_scope: str | None = None       # "parameter" (same decision, new setting) | "redesign"
                                           # Decides drop vs proceed_with_changes on a broken claim

class TestPlanItem(BaseModel):
    id: str
    target_claim: str                 # References Claim.id
    failure_mode: str                 # "assumption" | "evidence" | "feasibility" | "operational_friction"
    objective: str

class EvidenceItem(BaseModel):
    source_url: str
    title: str | None = None
    snippet: str                      # Curated 1-3 sentences relevant to the claim
    retrieved_at: str
    stance: str = "context"           # supports | contradicts | context — how it bears on the claim
    source_class: str = "unranked"    # primary | institutional | press | community | blog | unranked
    provider: str = "duckduckgo"      # serpapi | duckduckgo | fixture

class Finding(BaseModel):
    claim_id: str
    test_id: str
    evaluator: str                    # "devils_advocate" | "researcher" | "builder" | "operator"
    result: str                       # One-sentence outcome summary
    evidence: list[EvidenceItem] = [] # Empirical citations (Researcher and cross-examination probes)
    reasoning: str                    # Detailed analytical critique
    confidence: float | None = None   # OBJECTION STRENGTH, not evaluator certainty: how hard this
                                      # finding argues AGAINST the claim (0.0 = no objection). One
                                      # shared scale across all four personas, so rank_findings can
                                      # sort them against each other.
    contradiction: str | None = None  # Specific logical or empirical flaw surfaced

class NextAction(BaseModel):
    action: str
    claim_ids: list[str] = []         # The claims that forced this action

class DecidingFactor(BaseModel):
    """The single finding that actually moved the case verdict. Derived, not generated."""
    claim_id: str
    evaluator: str
    the_fact: str                     # The number, rule, cost or contradiction, verbatim
    source_url: str | None = None
    source_title: str | None = None
    gate_fired: bool = False          # Evidence gate downgraded broken -> weakened here

class CaseVerdict(BaseModel):
    decision_state: str               # proceed | proceed_with_changes | hold | drop
    headline: str = ""                # The call in one line, <= 70 chars
    summary: str
    deciding_factor: DecidingFactor | None = None
    survived: list[str] = []          # Claim ids
    broken: list[str] = []
    weakened: list[str] = []
    unproven: list[str] = []          # weakened + unresolved
    next_actions: list[NextAction] = []  # 2-3 merged, deduped, claim-anchored

class DecisionConsequence(BaseModel):
    claim_id: str
    impact: str                       # "high" | "medium" | "low"
    recommended_change: str           # Concrete, tailored strategic pivot or mitigation
    next_validation: str | None = None# Smallest, lowest-cost real-world experiment
    verdict_reasoning: str = ""       # Judicial reconciliation rationale
    fatal_flaw: str | None = None
    salvaged_claim: str | None = None
    tradeoff_acknowledged: str | None = None

class AgentTokenUsage(BaseModel):
    agent: str                        # extractor, load_bearing, devils_advocate, builder, researcher,
                                      # operator, cross_examination, steelman, synthesis
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0

class CaseTelemetry(BaseModel):
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_tokens: int = 0
    total_estimated_cost_usd: float = 0.0
    agent_breakdown: list[AgentTokenUsage] = []
    duration_ms: float = 0.0

class Case(BaseModel):
    id: str
    raw_input: str
    context: str | None = None        # Extracted text from uploaded documents or pasted URLs
    claims: list[Claim] = []
    test_plan: list[TestPlanItem] = []
    findings: list[Finding] = []
    consequences: list[DecisionConsequence] = []
    case_verdict: CaseVerdict | None = None
    status: str = "extracting"        # extracting | needs_input | awaiting_confirmation | testing | done | error
    gate_message: str | None = None   # The clarifying question when the input was not testable
    clarify_missing: list[str] = []   # What is absent, 2-3 short fragments
    clarify_interpretation: str | None = None  # "Reading it as: ..."
    clarify_round: int = 0            # 0 = first extraction, 1+ = after a clarify answer
    agent_mode: str = "auto"          # "auto" | "custom"
    selected_agents: list[str] = ["devils_advocate", "researcher", "builder", "operator"]
    agent_rationales: dict[str, str] = {}      # Why each agent was auto-selected
    telemetry: CaseTelemetry | None = None     # Token usage and cost accounting
```

**Persistence:** the `Case` is not held in process memory. `backend/store.py` writes it to SQLite (`backend/crossfire.db`, schema under `migrations/`), so a backend restart mid-run does not lose the case and interrupted runs are reconciled on startup via `recover_interrupted_cases()`.

---

## 4. The 4 Evaluator Personas (In Detail)

The adversarial evaluation panel is built on the principle of **strict structural independence** (derived from multi-agent debate research such as *Free-MAD*): **no evaluator ever sees another evaluator's output during execution**. This prevents groupthink, consensus bias, and cascading hallucinations.

> **Crucial UI Rule:** Internal persona code names (`devils_advocate`, `researcher` / `receipts`, `builder`, `operator` / `overthinker`) are strictly **masked in the user interface** and presented as objective, CI-style test runners (*Assumption Test*, *Evidence Test*, *Feasibility Test*, *Operational Friction Test*).

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

### Persona 2: Researcher (formerly Receipts)
* **UI Test Label:** `Evidence Test`
* **Target Failure Mode:** `evidence` (empirical claims, pricing, market size, conversion, user behavior, benchmarks)
* **Code Implementation:** `backend/core/evaluators/receipts.py` (with bidirectional normalization to `researcher`)
* **Operational Role & Objective:**
  Researcher is the empirical verification investigator. It is connected to the live search and scraping pipeline via **SerpApi** (with DuckDuckGo Lite via Scrapling as fallback). It tests whether real-world empirical data, industry benchmarks, market reports, or competitor realities support or refute the claim.
* **Adaptive Scrutiny & Deep Fetching:**
  1. Executes real-time web search via **SerpApi** (or DuckDuckGo Lite via Scrapling's `AsyncFetcher` if SerpApi quota is depleted).
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

### Persona 4: Operator (formerly Overthinker)
* **UI Test Label:** `Operational Friction Test`
* **Target Failure Mode:** `operational_friction`, `adoption`, `bureaucracy` (legacy: `edge-case`)
* **Code Implementation:** `backend/core/evaluators/operator.py` (with bidirectional normalization to `overthinker`)
* **Operational Role & Objective:**
  Operator stress-tests the things that kill decisions *after* the tech is built: adoption inertia, enterprise gatekeeping, change management resistance, procurement friction, compliance/regulatory liability, and organizational drag.
* **Key Analytical Questions:**
  * *"Who has the power to say 'no' even if the software works perfectly (CISO, compliance, procurement)?"*
  * *"What operational behavior change is required from users, and why will they resist it?"*
  * *"Where will red tape, audit trails, or liability concerns stall deployment?"*
* **Structured Output Schema (`OperatorAssessment` / `Finding`):**
  * `result`: Concise operational friction summary.
  * `reasoning`: Analytical walkthrough of organizational barriers, adoption inertia, and regulatory bottlenecks.
  * `confidence`: Float (`0.0` to `1.0`).
  * `contradiction`: Specific operational contradiction or deployment blocker identified.

---

### The Judicial Reconciler: Steel Man ("Break to Rebuild")
While not an isolated test runner, the **Steel Man** (`reconcile()` in `backend/core/reconcile.py`, gated by `apply_evidence_gate()` and `apply_steelman_gate()`) is the judicial adjudicator and solutions architect. It runs once per claim, in parallel, bounded by `STEELMAN_CONCURRENCY`:
* **Anti-Voting Principle:** Evaluators do not vote, and scores are never averaged.
* **Synthesis Mechanism:** The Steel Man reviews all evaluator findings for a claim simultaneously. Evidence-backed findings from *Researcher* carry heavy weight; verified architectural blockers from *Builder* or fatal logical flaws from *Devil's Advocate* can break a claim even if search results look positive.
* **The Break to Rebuild Protocol:**
  When a claim breaks or weakens, the Steel Man does not merely issue a rejection. It formulates:
  1. `fatal_flaw`: The precise empirical, logical, or architectural reason the claim cannot stand as written.
  2. `salvaged_claim`: The minimal viable re-architecture of the assumption that preserves the strategic upside while mitigating fatal risk.
  3. `tradeoff_acknowledged`: The explicit concession made (e.g. trading full autonomy for 1-click human ratification).
* **4 Reconciled Verdict States:**
  1. `survived` (Emerald `#34d399`): The claim withstood tests; supported by evidence and sound logic.
  2. `weakened` (Amber `#fbbf24`): The claim stands, but carries notable caveats, friction, or unmitigated risks.
  3. `broken` (Rose `#f87171`): The claim is refuted by empirical evidence or a fatal structural blocker.
  4. `unresolved` (Violet `#a78bfa`): Evidence was conflicting or absent. This is a **measured outcome of uncertainty**, styled in distinct violet — **never gray or disabled**. When it lands here, `missing_input` names the exact number, document, or measurement that would settle it.

* **Programmatic enforcement, not prompt trust:** `apply_steelman_gate()` runs the evidence gate first (a `broken` verdict with no source-traceable contradiction is downgraded to `weakened`, with the downgrade written into the reasoning), then nulls the salvage fields on `survived` and `unresolved` verdicts so a chatty model cannot attach a "fix" to a claim that never broke.
* **Failure isolation:** one claim's reconciliation failing marks only that claim `unresolved`. *Every* claim failing means the provider is down, and the run raises a real `error` event instead of serving a page of fake uncertainty.

---

## 5. Decision Consequence & Strategic Value Engine

Following judicial reconciliation, Crossfire runs `build_consequences()` and `synthesize_consequences()` in `backend/core/synthesis.py` to formulate executive-level guidance for broken, weakened, or unresolved claims. The deterministic build runs first and the LLM pass only upgrades its language, so a failed synthesis call degrades the memo in polish, never in existence:

1. **Impact Rating (`impact`):**
   * `high`: Load-bearing claim that is broken or unresolved.
   * `medium`: Claim is weakened.
   * `low`: Surviving or non-load-bearing claim.
2. **Recommended Strategic Pivot (`recommended_change`):**
   * Actionable, concrete commercial or technical adjustments (e.g., *"Shift from a 100% autonomous model to a hybrid AI-first model with sentiment-triggered human escalation"* rather than platitudes like *"Rework the idea"*).
3. **Smallest Next Validation Experiment (`next_validation`):**
   * The cheapest real-world experiment to de-risk open uncertainty before spending capital (e.g., *"Run a 30-day shadow containment test on tier-1 refund requests before altering human headcount"*).
4. **The salvage becomes the recommendation.** When the Steel Man returned a `salvaged_claim`, the recommended change *is* that salvage plus its trade-off, not a generic "rework the assumption" template.

The run then closes with `synthesize_case_verdict()`: one `decision_state` (`proceed` | `proceed_with_changes` | `hold` | `drop`), a generated headline, the `DecidingFactor` naming the single finding that moved the call, and 2–3 deduplicated claim-anchored next actions. `_fallback_decision_state()` derives the state from claim statuses if the synthesis call fails.

Afterwards, `backend/core/reformulate.py` (`POST /cases/{id}/improve_prompt`) rewrites the user's original decision statement around the claims that broke or weakened, so the next run tests the re-architected decision rather than the one already known to fail.

---

## 6. Evidence, Search, & Ingestion Subsystems

* **Two-Tier Search:** SerpApi when `SERPAPI_API_KEY` is set, with automatic fallback to **DuckDuckGo Lite** via Scrapling's `AsyncFetcher` on HTTP 429 or a missing key. Every `EvidenceItem` records which provider returned it and a `source_class` (primary, institutional, press, community, blog); results are re-ranked by that class.
* **Cross-Examination Probes:** Before adjudication, each load-bearing claim's single strongest *unsourced* blocker gets one targeted search (`backend/core/cross_examination.py`). Blockers asserting a published rule are routed through `build_authority_query` so a compliance objection is answered by the body that publishes the rule, not by a vendor setup guide. The probe reports what the sources actually say — `contradicts`, `supports`, or `context`.
* **Adaptive Scrutiny Deep Fetching:** For load-bearing claims with thin initial search snippets, Scrapling deep-fetches candidate URLs using anti-bot bypass techniques to inspect primary documentation or competitor pricing pages directly.
* **Contextual Snippet Curation:** Extracts 1–3 dense sentences directly answering the claim, preventing prompt bloat and context poisoning.
* **Zero-C-Dependency OCR & PDF Ingestion:**
  * Digital PDFs: Extracted via `pypdf` in $<10$ ms.
  * Scanned/Image PDFs: Converted to memory images via `pymupdf` (PyMuPDF).
  * Direct Image Uploads & Scanned Pages: Processed locally using ONNX-based **RapidOCR** (`rapidocr_onnxruntime`), requiring zero OS-level dependencies (no Tesseract, Ghostscript, poppler, or QPDF).

---

## 6b. Provider Layer: Keys, Pools, and Model Fallback

A full panel over 5 claims is roughly 20 concurrent LLM calls, before ranking, probes, reconciliation, and synthesis. On free tiers that is a rate limit, not a workload — so the provider layer is part of the architecture, not configuration trivia. Full reference: `docs/PROVIDERS.md`.

* **Providers (`backend/providers/catalog.py`):** the bundled keyless Gemini proxy (`gemini_proxy`, default), Google Gemini, OpenAI, Anthropic, local Ollama, and any number of user-registered OpenAI-compatible endpoints (`custom:<slug>`). Only Anthropic needs its own adapter — everything else is the OpenAI-compatible client against a different base URL. No vendor SDKs anywhere in `providers/`.
* **Encrypted keyring (`keyring.py`):** API keys are Fernet-encrypted in local SQLite and entered through the UI, not a committed config file. The master key is generated at `backend/.crossfire_key` on first use, or pinned with `CROSSFIRE_SECRET_KEY`.
* **Key pool (`pool.py`):** several keys per provider, each individually enable/disable-able, sharded across concurrent calls with a per-key in-flight cap (`KEY_POOL_MAX_INFLIGHT`).
* **Model-level fallback chain (`routing.py`):** one target per enabled model, primary first, **all sharing one key pool** — a 429 on model A retries on model B immediately, with no key-rotation round trip. Retryable statuses (408/409/425/429/5xx) rotate and honour `Retry-After`; 401/403 are fatal and stop that target rather than burning attempts.
* **Currently pinned:** execution is locked to the bundled Gemini proxy (`catalog.LOCKED_PROVIDER`). Every other provider stays visible and configurable in the UI and takes effect the moment the pin is lifted — unpinning is one function in `build_chain()`.
* **Cost telemetry (`core/telemetry.py`):** prompt and completion tokens are attributed per agent, costed, stored on the case as `CaseTelemetry`, and streamed as a `telemetry_ready` event. Adaptive scrutiny is a cost argument, so the cost is measured rather than asserted.

---

## 7. UI/UX Design System & Principles

* **Dark-First Theme:** Engineered for deep focus and zero glare. Root canvas `#0e0e11`, surfaces `#1f1f22`, borders `#414751`, text `#e4e1e6`, with a blue primary (`#60a5fa`). Every value is a CSS variable in `frontend/src/globals.css` surfaced through Tailwind tokens — components never hardcode a hex.
* **Truthful Telemetry Only:** the live activity feed, progress, and stage narration are driven by real SSE events (`activity`, `test_started`, `finding_ready`). Animation is presentational framing around real state, never a simulated counter standing in for one.
* **Evidence Always One Click Away:** Every claim card in the decision memo opens a slide-over **Evidence Drawer (Sheet)** revealing the full audit trail: why the claim is load-bearing, which tests ran, primary source URLs with quotes, contradictions, and recommended validation experiments.
* **Strict Color Exclusivity:** Verdict colors (Emerald, Amber, Rose, Violet) are strictly reserved for claim verdicts and test outcomes. They are never used for general buttons or generic form badges.

---

## 8. Technology Stack Summary

| Layer | Technologies Used | Key Characteristics |
|---|---|---|
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, Uvicorn | Strict typing, high async concurrency, OpenAPI documentation. |
| **Orchestration** | Native Python `asyncio` (`asyncio.gather`, `asyncio.Queue`) | Lightweight, zero-framework overhead (no LangGraph/CrewAI bloat). |
| **LLM Provider Layer** | Custom `LLMProvider` Protocol (`providers/`) | Native structured outputs (`response_schema`); Gemini, Anthropic, OpenAI-compatible, Ollama, and custom endpoints over raw HTTP — no vendor SDKs. |
| **Persistence** | SQLite (`store.py`, `providers/keyring.py`), Fernet | Case durability across restarts, encrypted API keys at rest, SQL migrations under `migrations/` (generated, never auto-applied). |
| **Web Research** | SerpApi, DuckDuckGo Lite, Scrapling | Two-tier search with keyless fallback, stealth deep page fetching, and anti-bot bypass. |
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
5. **Never Fabricate a Provisional Claim:** Zero-claim recovery may only infer claims traceable to words the user actually wrote — no invented numbers, dates, prices, vendors, jurisdictions, or statistics. An empty list is the correct output when nothing is inferable, and `provisional=True` claims must be human-accepted before they can be tested.
6. **Enforce Invariants in Code, Not in Prompts:** the evidence gate, the salvage-field rules, and the load-bearing cap are all applied programmatically after the model answers. A new rule belongs in a gate function, not only in a system prompt.
7. **Every Stage Keeps a Deterministic Floor:** ranking, consequences, and the case verdict each have a rule-based fallback. A change that removes the fallback path is a regression even if the happy path improves.
8. **Test Both Sides in the Same Pass:** backend changes ship with pytest coverage; anything under `frontend/` follows `frontend/TESTING.md` and must pass `npm run test:all` (Vitest plus `tsc --noEmit`) before it is considered done.
9. **Never Apply Migrations:** schema changes are generated as SQL files under `migrations/` and applied by a human, never by an agent or by CI.
