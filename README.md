# Crossfire

[![Powered by SerpApi](https://img.shields.io/badge/Search%20Grounding-Powered%20by%20SerpApi-377FEA?style=flat&logoColor=white)](https://serpapi.com)

Crossfire is a decision-testing engine. It takes a business, technical, or product decision you are about to commit resources to, breaks it down into the specific claims the decision depends on, tests the critical ones independently, and outputs a structured test report with a verdict per claim and concrete next steps.

> **Powered by [SerpApi](https://serpapi.com)**: Real-time search grounding and empirical evidence extraction across all stress-tested claims are powered by SerpApi. Every load-bearing assumption is cross-checked against live web results to identify unproven claims and empirical contradictions.

It is not a chatbot, an idea generator, or an advisory council. You give it a decision; it gives you back claims, tests, empirical evidence, and verdicts.

---

## How it works

When you submit a proposal or decision dilemma, Crossfire runs it through a fixed pipeline:

```
[Proposal / Dilemma]  (text, URL, PDF, or image)
        │
        ▼
1. Claim extraction + input gate + agent selection
   ├── not testable? → returns a redirect, no invented claims
   └── testable?     → up to 5 falsifiable claims + the panel this decision needs
        │
        ▼
2. User confirmation (edit, add, or prune claims and tests before compute is spent)
        │  POST /cases/{id}/confirm → 202 Accepted in <50ms, run continues in background
        │  every stage below streams to the browser over SSE
        ▼
3. Load-bearing ranking (at most half the claims; failure collapses the decision)
        │
        ▼
4. Test plan routing
   ├── load-bearing claim → full active panel
   └── secondary claim    → single pass (Evidence Test preferred)
        │
        ▼
5. Independent test execution (parallel, blind evaluations)
   ├── Assumption Test          (logic, hidden premises, incentive mismatches)
   ├── Evidence Test            (live web search, deep-fetch, empirical benchmarks)
   ├── Feasibility Test         (technical constraints, infrastructure, scaling limits)
   └── Operational Friction Test (adoption inertia, red tape, liability, process drag)
        │
        ▼
6. Judicial reconciliation, per claim, in parallel
        │  evidence gate: "broken" requires a source-traceable contradiction
        ▼
7. Strategic consequence synthesis (impact, pivot, smallest next validation)
        │
        ▼
8. Case verdict (proceed / proceed with changes / hold / drop + next actions)
        │
        ▼
[Decision Memo & Evidence Drawer]
```

### 1. Claim extraction, input gate, and agent selection
Crossfire parses your input into up to five discrete, checkable claims. Input can be typed directly or ingested from a URL, PDF, or image.

If the input is not testable, Crossfire does not manufacture claims out of it — the case comes back asking you to name the specific decision you are weighing and what you would do if it went wrong.

The same model that reads the decision also picks which tests it needs, with a one-sentence rationale per pick. There is no keyword table: a fixed keyword map can only encode the scenarios someone thought of in advance, and identical words mean different things in different domains. You can also pin the panel manually.

### 2. Confirmation and streaming
Before running any tests or searches, the system displays the claims and the selected panel so you can edit, remove, or add. This prevents the engine from spending compute investigating misread intent.

Confirming does not block. The request returns immediately and the run continues as a background task, publishing every load-bearing flag, verdict, consequence, and progress message to the browser over Server-Sent Events as it happens.

### 3. Load-bearing ranking
A claim is load-bearing if its failure would materially change the decision. For example, in an automated compliance product, "Regulators accept automated audit trails" is load-bearing; "Users prefer weekly email digests" is not. Crossfire ranks the claims rather than flagging each in isolation, and at most half of them come back load-bearing — that is the constraint that forces prioritisation instead of treating everything as critical.

### 4. Adaptive test routing
Load-bearing claims get the full active panel. Secondary claims get a single pass, preferring the Evidence Test, because it is the only test that can return an outside source and a sourced contradiction is the only thing that can break a claim. That asymmetry is where the compute budget actually goes.

### 5. Isolated test panel
Tests run in parallel. To prevent groupthink, each executes in strict isolation: no evaluator sees what another evaluator found during the run. A test that fails outright becomes a low-confidence finding rather than taking down the run.

* **Devil's Advocate (Assumption Test):** Evaluates deductive logic, unstated premises, cognitive blind spots, and misaligned incentives without searching the web.
* **Researcher (Evidence Test):** Queries public sources and competitor documentation via SerpApi, falling back to DuckDuckGo Lite through Scrapling when no key is configured or the quota is exhausted. Results are ranked by source class (primary, institutional, press, community, blog). If initial snippets are thin on load-bearing claims, it deep-fetches candidate pages. If no public evidence exists, confidence is capped at 0.35 to avoid confident false negatives.
* **Builder (Feasibility Test):** Evaluates technical and operational viability, including required APIs, data access, latency budgets, unit economics, threat model, and regulatory boundaries (GDPR, HIPAA, SOC2).
* **Operator (Operational Friction Test):** Stress-tests the operational frictions that kill decisions after the tech works — adoption inertia, enterprise gatekeeping and procurement, regulatory liability, and process drag.

### 6. Judicial reconciliation & Steel Man Re-Architecture
Evaluators do not vote, and scores are never averaged. The **Steel Man** acts as judicial reconciler and solutions architect, reviewing the findings across all tests for each claim in parallel:

* **The Evidence Gate:** A claim can only be marked **broken** if some finding carries both empirical evidence and a contradiction traceable to a source. Reasoning alone can weaken a claim; it can never break one. An unsupported "broken" verdict is downgraded to "weakened" and the downgrade is recorded in the reasoning.
* **Break to Rebuild Protocol:** If a claim breaks or weakens, the Steel Man does not just reject the idea—it identifies the **Fatal Flaw**, constructs a **Salvaged Claim** (the minimal viable re-architecture of the assumption that preserves the core strategic upside while mitigating fatal exposure), and documents the **Trade-off Acknowledged**.

### 7. Strategic consequences
For any claim that does not cleanly survive, Crossfire synthesizes concrete recommendations:
* **Impact rating:** High, medium, or low based on whether the claim was load-bearing.
* **Strategic pivot:** A concrete operational adjustment rather than generic advice.
* **Smallest next validation:** The lowest-cost real-world experiment to de-risk remaining uncertainty before spending capital.

### 8. Case verdict
The run closes with a single decision state — **proceed**, **proceed with changes**, **hold**, or **drop** — the claims sorted into survived, broken, and unproven, and two to three deduplicated next actions anchored to the specific claims that triggered them.

Every synthesis step has a deterministic fallback. If the model fails at ranking, consequences, or the final verdict, a rule-based version ships instead. The report degrades in polish, never in existence.

---

## Verdict states

Every claim receives one of four reconciled states:

| Status | Meaning |
|---|---|
| **Survived** | The claim held under logical scrutiny and aligns with available evidence. |
| **Weakened** | The claim remains plausible but carries caveats, friction, or unmitigated risks. |
| **Broken** | The claim was refuted by empirical evidence or invalidated by a fatal blocker. |
| **Unresolved** | Evidence was conflicting or unavailable. |

`Unresolved` is an active, measured outcome of uncertainty, not a failure or disabled state. Crossfire reports when it cannot verify a claim rather than guessing or defaulting to consensus.

---

## Core doubts

### Isn't this just a wrapper around an AI model?
No. A wrapper is one prompt in, one answer out. Crossfire never lets a single model call answer the question directly. It runs a fixed process: pull out the claims, test the important ones independently (some pulling real evidence off the web), then a separate step weighs it all and decides. That's a process, not a prompt with a personality on it.

### How is this better than just using one AI model directly?
One model, one voice, one pass. What it checks depends entirely on how you phrased the question. Crossfire forces the same investigation every time: find the claims that matter, test them independently so they can't just agree with each other, back it with real evidence, and hand you a claim-by-claim verdict you can point to. A raw answer gives you none of that structure.

### What stops the different tests from just agreeing with each other?
Every test runs blind. Each one forms its own finding without seeing what the others found. Only after all of them are done does a separate step look at everything together and decide. That's what stops it turning into an echo chamber, and it's backed by real research on why AI agents debating each other tend to just agree with each other or dig into their own view.

---

## Getting started

### Prerequisites
* **Python:** 3.11 or newer
* **Node.js:** 18 or newer (with `npm`)
* An LLM endpoint (Gemini API key, Anthropic API key, local Ollama instance, or an OpenAI-compatible proxy)

### 1. Clone the repository
```bash
git clone https://github.com/hriday-singh/crossfire.git
cd crossfire
```

### 2. Configure and run the backend

```bash
cd backend

# Create and activate a Python virtual environment
# Windows (PowerShell):
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Linux / macOS:
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

Set up your environment variables:
```bash
# Copy the template
cp .env.example .env
```

Open `backend/.env` and select your LLM provider:

#### Option A: Direct Gemini API (Recommended for quick start)
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
LLM_MODEL=gemini-2.5-flash
```

#### Option B: Anthropic
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here
LLM_MODEL=claude-3-5-sonnet-latest
```

#### Option C: Local or OpenAI-compatible endpoint (Ollama / vLLM / Local Proxy)
```env
LLM_PROVIDER=openai_compat
LLM_BASE_URL=http://localhost:8081/v1
LLM_MODEL=gemini-2.5-flash
LLM_API_KEY=
```

> **Note on search:** Web retrieval uses SerpApi when `SERPAPI_API_KEY` is set, and automatically falls back to DuckDuckGo Lite via Scrapling when it is not, or when the SerpApi quota is exhausted. The fallback runs locally with no API keys or search subscriptions required, so search works out of the box.

Start the backend server:
```bash
uvicorn main:app --reload --port 8000
```
Verify the backend is running by visiting `http://localhost:8000/health`.

### 3. Configure and run the frontend

In a new terminal window:
```bash
cd frontend

# Install Node dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`. Vite is configured to proxy API requests (`/cases`, `/ingest`, `/health`) directly to the backend on port 8000.

### 4. Running tests

#### Backend tests
Run unit and integration tests with pytest:
```bash
cd backend
pytest
```

#### Frontend tests
Run unit tests and TypeScript type checks:
```bash
cd frontend
npm run test:all
```

---

## Additional questions

### What is Crossfire, in one line?
It takes a decision you're about to commit to, breaks it into the claims it depends on, tests the important ones independently, and gives you a verdict per claim: survived, weakened, broken, or unresolved, plus what to do next. Not a chat, not an opinion, a test report.

### How is this not just an AI assistant or chatbot?
An assistant chats with you and answers whatever you ask. Crossfire doesn't converse. You give it one decision, it gives you back claims, tests, evidence, and verdicts. No persona, no back and forth. Closer to a test report than a conversation.

### How is this better than someone writing a really good prompt themselves?
A good prompt is only as good as the person who wrote it, that one time. Ask it differently, or forget to ask about the thing that matters, and you get nothing. Crossfire runs the same process every time regardless: find what actually matters, test it independently, back it with evidence, give a verdict. It doesn't rely on you knowing what to ask.

### How is this different from just using Claude or ChatGPT with search turned on?
Search-enabled chat still reasons in one continuous thread. Once it finds something that fits the answer it's already building, it tends to keep building on it. Crossfire runs separate, independent checks that can't see each other's results until a final step weighs the evidence, actively looks for what argues against a claim and not just what supports it, and is honest when it genuinely can't tell, unresolved is a real answer, not a cop-out. You get a structured verdict, not a paragraph.

### How is this different from a research platform, like Perplexity?
A research platform tells you what's out there on a topic. Crossfire tells you whether your specific decision survives. It doesn't just gather information, it decides which claims in your plan actually matter, tests those, and ends with a verdict and a next step, not a report you still have to interpret yourself.

### How is this different from an AI council, like The AI Council app?
Those tools send your question to several models, let them see and react to each other's answers, then merge everything into one final answer with a single confidence score. That's still one opinion at the end, just an averaged one, and letting the models see each other's answers before merging is exactly what makes them converge and agree instead of catching what the other missed. Crossfire never merges into one answer or one score. It decides which claims your decision actually depends on, tests each one independently with zero visibility into what the others found, and gives you a verdict per claim, survived, weakened, broken, or unresolved, plus what that means for your decision and what to check next. A confidence score tells you how much agreement there was. A verdict tells you what to actually do.

---

## Repository layout

```
crossfire/
├── backend/
│   ├── api/             # FastAPI routes, request models, and SSE endpoints
│   ├── core/
│   │   ├── evaluators/  # Devil's Advocate, Researcher (SerpApi), Builder, and Operator runners
│   │   ├── agent_panel.py # Agent catalog, failure-mode routing, and test-plan construction
│   │   ├── reconcile.py # Steel Man: per-claim reconciliation, evidence gate, Break to Rebuild re-architecture
│   │   ├── baseline.py  # Single-prompt control answer for side-by-side comparison
│   │   ├── loop.py      # Pipeline orchestrator: extraction, ranking, synthesis
│   │   └── models.py    # Pydantic data contracts (Case, Claim, Finding, CaseVerdict)
│   ├── evidence/        # SerpApi + Scrapling search and web-page retrieval engine
│   ├── events.py        # Per-case SSE event queues
│   ├── ingestion/       # PDF and image ingestion (PyMuPDF, RapidOCR)
│   ├── providers/       # LLM provider adapters (Gemini, Anthropic, OpenAI-compatible)
│   ├── config.py        # Environment settings and validation
│   └── main.py          # FastAPI application entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # Screen layouts, Claim cards, Evidence drawer, FAQ drawer
│   │   ├── context/     # State management and SSE event listeners
│   │   ├── lib/         # FAQ content and UI utilities
│   │   └── tests/       # Vitest component and reducer tests
│   ├── package.json
│   └── vite.config.ts   # Vite configuration with backend proxy
├── docs/                # Architecture specifications and implementation records
└── README.md
```

---

## Configuration options

The backend can be configured via environment variables in `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `openai_compat` | Provider backend: `gemini`, `anthropic`, or `openai_compat` |
| `LLM_BASE_URL` | `http://localhost:8081/v1` | Base URL used when `LLM_PROVIDER=openai_compat` |
| `LLM_MODEL` | `gemini-3.7-flash` | Model identifier passed to the active provider |
| `SERPAPI_API_KEY` | `""` | Enables SerpApi search; falls back to DuckDuckGo Lite when empty or out of quota |
| `LLM_API_KEY` | `""` | Optional universal API key override |
| `EVALUATOR_CONCURRENCY` | `8` | Maximum concurrent evaluator calls during the test stage |
| `EVALUATOR_TIMEOUT_SECONDS` | `60.0` | Timeout per evaluator call before marking a test timed out |
| `DEMO_MODE` | `false` | When `true`, returns canned fixtures for offline testing |
