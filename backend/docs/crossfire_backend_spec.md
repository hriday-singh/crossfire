# Crossfire — Backend Technical Specification

This is the build spec for the backend, written from the confirmed idea-level docs (`Crossfire_Consolidated_Direction.md` and the later `Crossfire_Consolidated_Directionplan.md`) plus the stack decisions locked in during the technical pass:

- Language/framework: Python, FastAPI, Pydantic v2
- Orchestration: plain `asyncio`, no agent framework (CrewAI/LangGraph rejected — see rationale below)
- First LLM provider: Gemini, via `google-genai`. Anthropic and an OpenAI-compatible adapter (covers OpenAI, Ollama, custom endpoints) are stubbed behind the same interface from hour zero, not built out yet.
- Search/discovery: Tavily — cheap, `search_depth="basic"` by default, used only to find candidate URLs and snippets, kept to one query per claim to conserve calls (revised — see section 5)
- Fetch/parse: Scrapling — the deep-verification step for load-bearing claims when a Tavily snippet isn't enough, plus pasted-URL and document ingestion; never used to scrape a search engine's own results page (revised — see section 5)
- Document ingestion: `pypdf`/`pdfplumber` for text-based PDFs only for the hackathon; scanned/image-only PDFs and direct image uploads are out of scope for v1 — the latter was explicitly cut in both source docs and stays cut (revised — see section 6)
- Reliability: `tenacity` for retries/backoff
- Secrets: `.env` via `python-dotenv`
- Frontend pairing: React, talking to the backend over Server-Sent Events for live progress

Three assumptions I'm building this around, since they weren't pinned down explicitly — flag if any are wrong and the affected section changes, nothing else does:

1. Three backend developers, matching the "lock the contracts before anyone branches off" plan in your docs. The module layout below is split so three people can build in parallel without touching each other's files.
2. The demo runs locally on the presenting laptop, not on hosted infrastructure — no deployment/Docker section here. If judges need a live URL, that's a five-minute tunnel (ngrok/Cloudflare Tunnel) in front of the same `uvicorn` process, not a backend design change.
3. This is one repo, `backend/` and `frontend/` as siblings.

---

## 1. Why no agent framework

Worth stating once, in writing, so nobody re-litigates it mid-build: CrewAI and LangGraph were both considered and rejected for v1. The core requirement — each evaluator produces its first finding with zero visibility into the others, then a separate reconciliation step looks at all of them at once — is a two-line `asyncio.gather()` plus a follow-up call. Both frameworks are built around chained or delegated agent conversations, which is the opposite of what "structurally independent" means here, and both add a debugging layer between you and your own code at exactly the moment (a live 48-hour build, most of the team vibe-coding) when that layer costs more than it gives back. If observability becomes a real problem later, add structured logging before reaching for a framework.

## 2. Data contracts

These match section 5 of the direction doc almost exactly, expressed as Pydantic models. Field names can still shift; the shape shouldn't, since three people build against this at once.

```python
from enum import Enum
from pydantic import BaseModel

class ClaimStatus(str, Enum):
    SURVIVED = "survived"
    WEAKENED = "weakened"
    BROKEN = "broken"
    UNRESOLVED = "unresolved"

class Claim(BaseModel):
    id: str
    statement: str
    load_bearing: bool | None = None       # set after the load-bearing question runs
    status: ClaimStatus | None = None

class TestPlanItem(BaseModel):
    id: str
    target_claim: str                       # Claim.id
    failure_mode: str                       # what kind of failure this test is built to catch
    objective: str

class EvidenceItem(BaseModel):
    source_url: str
    title: str | None = None
    snippet: str                            # curated, not the full page — see section 5
    retrieved_at: str

class Finding(BaseModel):
    claim_id: str
    test_id: str
    evaluator: str                          # "devils_advocate" | "receipts" | "builder" | "overthinker"
    result: str
    evidence: list[EvidenceItem] = []
    reasoning: str
    confidence: float
    contradiction: str | None = None

class DecisionConsequence(BaseModel):
    claim_id: str
    impact: str                             # high | medium | low, or a short phrase — TBD in UI pass
    recommended_change: str
    next_validation: str | None = None      # required when status is broken/unresolved and load-bearing
    verdict_reasoning: str = ""              # why Judge reconciled to this status, given the findings — this
                                              # is distinct from any single Finding.reasoning, and the drawer
                                              # needs it persisted here, not just riding along on the SSE event

class Case(BaseModel):
    id: str
    raw_input: str
    context: str | None = None              # from an ingested doc/URL, once that path exists
    claims: list[Claim] = []
    test_plan: list[TestPlanItem] = []
    findings: list[Finding] = []
    consequences: list[DecisionConsequence] = []
    status: str = "extracting"              # extracting | awaiting_confirmation | testing | done | error
```

`Case` is the one object the whole backend passes around. Every module below either reads it, appends to it, or streams a diff of it — nothing operates on parallel, disconnected state.

## 3. Provider interface

One protocol, three eventual adapters, one wired now:

```python
class LLMProvider(Protocol):
    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel: ...
```

`GeminiProvider` is the only concrete implementation for the hackathon. It wraps `google-genai`, and when `response_schema` is set, it uses Gemini's native structured-output mode rather than hand-parsed JSON. `AnthropicProvider` and `OpenAICompatibleProvider` are empty classes implementing the same protocol, so adding a second provider later is "write one class," not "restructure every call site." Every evaluator and every internal step (claim extraction, load-bearing check, reconciliation) calls through this interface — nothing talks to `google-genai` directly outside this one module.

Note this is deliberately just a text/structured-output interface — no `tools=[...]` parameter, since search and fetch are handled by your own Tavily/Scrapling pipeline (section 5), not by provider-native tool calls. Keeping the provider interface tool-free is also what makes swapping providers later completely mechanical.

## 4. Core loop, as an actual call sequence

Corrected from an earlier draft that glossed over a real race condition: if `POST /confirm` awaited the whole pipeline before responding, and the frontend only opened its SSE connection after that response came back, every event fired during the run (15-30 seconds) would already be gone. The fix is to decouple the HTTP response from the actual work entirely:

```
POST /cases                     -> extract_claims()            -> Case(status=awaiting_confirmation)

GET  /cases/{id}/stream         -> opens immediately, reads from an asyncio.Queue keyed by case_id
                                    (the frontend should open this before firing confirm, though the
                                     queue buffers regardless of when a consumer attaches)

POST /cases/{id}/confirm        -> validates claims, asyncio.create_task(run_pipeline(case_id)),
                                    returns 202 Accepted immediately — does NOT await the pipeline

run_pipeline() [background task] -> classify_load_bearing()
                                  -> build_test_plan()
                                  -> run_evaluators()  [asyncio.gather, independent]
                                  -> reconcile()        [Judge, sees all findings at once]
                                  -> build_consequences()
                                  -> Case(status=done), queue closed and discarded

GET  /cases/{id}                -> full Case, for the evidence drawer, any time after status=done
```

Each step of `run_pipeline()` pushes its event onto the case's queue as it happens; the `/stream` route just `get()`s from that same queue and re-emits as SSE. Close and drop the queue once `run_complete` fires (or after a timeout with no consumer) so a multi-run demo session doesn't leak memory.

`run_evaluators()` is the independence-critical part:

```python
async def run_evaluators(case: Case, plan: list[TestPlanItem]) -> list[Finding]:
    tasks = [dispatch(item, case) for item in plan]   # each evaluator sees only its own claim + context
    return await asyncio.gather(*tasks, return_exceptions=True)
```

`dispatch()` routes each `TestPlanItem` to the right evaluator function by `failure_mode` (assumption / evidence / feasibility / edge-case), not by "which agent is free." Receipts is the one evaluator that runs the evidence sub-pipeline in section 5 before it ever calls the LLM; the others call the provider directly with the claim and context.

Reconciliation (`reconcile()`) is a single call that receives every `Finding` for a claim at once and returns the `ClaimStatus`. This is the only place a status gets decided — no evaluator sets its own claim's status, exactly as the docs specify (evidence quality and criticality, never a vote).

## 5. Evidence pipeline (Receipts)

Revised again to a cleaner division of labor: Tavily is discovery only, Scrapling is inspection only, and Scrapling never touches a search engine's own results page (scraping a SERP directly is brittle and CAPTCHA-prone — that's what the Tavily API exists to avoid in the first place). The two tools do different jobs and only Scrapling is free to lean on harder, since it's local and has no per-call cost the way Tavily's API does.

```
claim.statement
   -> Tavily search (1 query, search_depth="basic", tenacity-wrapped)   [cheap: discovery only]
   -> 3-4 candidate URLs + titles + snippets

   if claim.load_bearing and the snippet isn't strong enough to hang a verdict on:
       -> Scrapling fetch on the top 1-2 candidate URLs (stealthy fetcher, bypasses anti-bot walls
          standard requests/httpx would fail on — e.g. a competitor's own pricing or product page)
       -> full page text for those sources, replacing the thin snippet for this claim

   -> curate: extract the 1-3 sentences actually relevant to the claim, from whichever text is available
      (Tavily's snippet, or the deeper Scrapling fetch when load-bearing status triggered it)
   -> EvidenceItem list  (only the curated snippet enters the LLM prompt, never the full page)
```

This is the same adaptive-scrutiny principle already in your docs — spend the extra fetch only where a wrong answer would change the decision — applied to the evidence pipeline specifically, and it keeps Tavily usage to one cheap call per claim regardless of how deep the verification goes, since the expensive part (a full page fetch) is Scrapling's job, not an extra paid search. A claim like "a competitor already does this" is the clearest example: Tavily finds the competitor's URL, Scrapling fetches the actual page once that URL is load-bearing, and curation pulls the exact sentence rather than trusting a search snippet to be precise enough.

The curation step itself is a small, cheap operation — either a simple keyword/relevance heuristic, or (if time allows) one short, low-token LLM call whose only job is "pick the 1-3 sentences relevant to <claim> from this text." Either way, nothing beyond the curated `EvidenceItem.snippet` reaches the Receipts evaluator's context window.

Failure handling: if Tavily returns nothing, or a Scrapling deep-fetch fails (dead link, a wall it genuinely can't beat), that source is dropped, not retried into a crash — Receipts still produces a `Finding`, just with fewer or zero `EvidenceItem`s, which is exactly what should push a claim toward `unresolved` rather than a forced verdict. `tenacity` covers transient failures on both tools; a source that's genuinely gone is a data point, not an error.

**Demo fallback.** Your own docs already require this: live search can't be the single point of failure holding up the demo's one load-bearing claim. Implement it as an explicit switch, not implicit string-matching on the query text (a keyword match on the demo's wording is fragile and mixes staging concerns into production search code):

```python
# evidence/search.py
DEMO_FIXTURES: dict[str, list[EvidenceItem]] = {
    "claim-abc123": [...],   # pre-captured, reproducible evidence for the one demo-critical claim
}

async def search_evidence(claim: Claim) -> list[EvidenceItem]:
    if settings.DEMO_MODE and claim.id in DEMO_FIXTURES:
        return DEMO_FIXTURES[claim.id]
    # ... standard Tavily call
```

`DEMO_MODE` is a `.env`-driven flag, and the fixture is keyed by the actual `claim_id` from the demo's prepared case, not a fuzzy text match — flip it off for the internal eval set in section 11, on for the live pitch.

## 6. Document & Image Ingestion (RapidOCR & PyMuPDF)

RapidOCR (`rapidocr_onnxruntime`) and PyMuPDF (`pymupdf`) provide system-dependency-free OCR for images (screenshots, JPEGs, PNGs) and scanned/photo PDFs without native system packages (no Tesseract, Ghostscript, poppler, or QPDF required).

```
uploaded PDF -> pypdf extracts digital text layer directly (<10ms)
             -> if digital text is present (>20 chars):
                -> curate_snippet bounds context to <= 2,000 chars -> Case.context
             -> if scanned or image-only (<20 chars):
                -> pymupdf renders pages to 150 DPI PNG images in memory
                -> RapidOCR extracts text from rendered page images
                -> curate_snippet bounds context -> Case.context

uploaded image (PNG/JPG) -> RapidOCR extracts text from image bytes
                         -> curate_snippet bounds context -> Case.context
```

This eliminates the need for expensive multimodal raw image token calls while keeping OCR processing 100% local, fast, and free of OS-level C dependencies.

A pasted URL follows a different path from a Tavily-found source, since there's no Tavily result to curate from here: straight to the same Scrapling fetch used for load-bearing deep-verification in section 5, then the same curation step. Both feed `Case.context`, not a new field — a document or URL is context for the case, never a second product, per your own docs.

## 7. SSE event schema

One endpoint, one event stream per case, so the frontend never has to poll:

```
event: claim_map_ready       data: {"claims": [...]}
event: awaiting_confirmation data: {}
event: test_started          data: {"test_id": "...", "target_claim_id": "...", "evaluator": "devils_advocate"}
event: finding_ready         data: {"finding": {...}, "target_claim_id": "..."}
event: verdict_ready         data: {"claim_id": "...", "status": "...", "verdict_reasoning": "..."}
event: consequence_ready     data: {"consequence": {...}}
event: run_complete          data: {"case_id": "..."}
event: error                 data: {"stage": "...", "message": "..."}
```

`target_claim_id` on `test_started`/`finding_ready` and `evaluator` on `test_started` are redundant with fields already nested inside `Finding`/`TestPlanItem`, but lifting them to the top level of the event means the React dashboard can animate the right claim card without unpacking a nested object first — cheap to add, no downside. `verdict_reasoning` on `verdict_ready` mirrors the field added to `DecisionConsequence` in section 2 — it's persisted on the `Case`, not just passed through the stream, so the evidence drawer still has it after the run finishes and the stream is gone.

This maps directly onto the "Assumption Test: 2 of 3 held"-style live view and the claim-confirmation checkpoint your docs both call out as a real feature, not UI polish — the confirmation gate is a genuine pause in the backend's state machine (`awaiting_confirmation`), not something faked client-side.

## 8. Module layout (for three people building in parallel)

```
backend/
  main.py                  # FastAPI app, route wiring only
  api/
    routes.py              # POST /cases, POST /cases/{id}/confirm, GET /cases/{id}, GET /cases/{id}/stream
    schemas.py             # request/response models (thin wrappers around Case)
  core/
    models.py              # Case, Claim, TestPlanItem, Finding, DecisionConsequence (section 2)
    loop.py                # extract_claims, classify_load_bearing, build_test_plan, reconcile, build_consequences
    evaluators/
      devils_advocate.py
      receipts.py           # owns the evidence pipeline (section 5)
      builder.py             # added once the loop + evidence path are solid
      overthinker.py          # stretch
  providers/
    base.py                 # the LLMProvider protocol
    gemini.py                # concrete adapter, wired first
    anthropic.py              # stub
    openai_compat.py           # stub, also covers Ollama/custom endpoints
  evidence/
    search.py                 # Tavily wrapper (search_depth="basic", one query per claim), demo fixtures
    fetch.py                  # Scrapling wrapper — load-bearing deep-verification (section 5) AND
                               # pasted-URL ingestion (section 6) share this one module
    curate.py                 # snippet curation (shared by receipts.py and ingestion/)
  ingestion/
    pdf.py                    # pypdf/pdfplumber text extraction only; rejects scanned/image-only PDFs
                               # (no image-upload path — out of scope, see section 6)
  store.py                    # in-memory dict[case_id -> Case] for the hackathon; swap for SQLite only if needed
  config.py                   # .env loading, incl. DEMO_MODE
tests/
  eval_set/                   # the 5-10 hand-picked cases from section 15, one pytest case each
```

Suggested three-way split, matching this layout directly onto the hour-by-hour plan: one person owns `providers/` + `core/loop.py` (the spine everything else calls into), one owns `evidence/` + `evaluators/receipts.py` (the tool-chained part with the most moving pieces), one owns `api/` + the SSE wiring + `evaluators/devils_advocate.py` and `overthinker.py` (the more self-contained, prompt-only evaluators). `core/models.py` gets written first, by whoever, and frozen before the other two branch off — that's the hour 0-2 lock your docs already call for.

## 9. Config

```
GEMINI_API_KEY=
TAVILY_API_KEY=
# added later, not now:
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
```

`.env`, loaded once in `config.py`, never logged, never committed (add it to `.gitignore` in the same commit that creates it).

## 10. Storage

A `dict[str, Case]` in `store.py` is genuinely enough — no accounts, no cross-run persistence, no concurrency concerns beyond what a single-process demo needs. Don't reach for SQLite or Redis unless you specifically need multiple simultaneous demo runs not to collide, which isn't a stated requirement anywhere in the docs.

## 11. Testing

`tests/eval_set/` turns section 15's internal validation directly into pytest: one test function per hand-picked case, asserting the property it was chosen for (an obvious flaw should end up `broken`, a fine idea like "a calculator app" should mostly `survive`, a mixed-evidence case should land `unresolved` rather than forced either way). This is the same check the docs describe as running informally from around hour 18-20 — writing it as pytest from the start just means it's re-runnable instead of eyeballed each time.

## 12. What's deliberately not here

No auth, no user accounts, no multi-tenant isolation, no deployment/CI pipeline, no rate limiting beyond what `tenacity` gives you for outbound calls, no database migrations. All of these are correctly out of scope per section 20/14 of the direction docs, and adding any of them now would be exactly the "future-proofing a 48-hour build can't afford" the docs warn against.

---

Open question for you before frontend: the SSE contract in section 7 is what React will build against. Anything about that event shape you want to adjust before we move on, or is this ready to hand to whoever's writing the frontend?
