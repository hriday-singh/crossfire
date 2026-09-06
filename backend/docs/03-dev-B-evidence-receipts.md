# Dev B — Evidence Pipeline + Receipts

You own the tool-chained part of the system: two external APIs with different failure modes, a retry layer, a demo fallback switch, and the one evaluator ("Receipts") that has to actually go get evidence before it says anything. This is the piece the whole product's credibility rests on — a negative finding with no traceable evidence behind it is the exact failure the architecture exists to prevent.

**Files you own:**
```
evidence/search.py      evidence/fetch.py       evidence/curate.py
core/evaluators/receipts.py
ingestion/pdf.py         (stretch, hour 35+ only, if the rest of this is solid)
```

**Never touch:** `providers/`, `core/models.py`, `core/loop.py`, `api/`, other evaluators.

**Reads but doesn't modify:** `providers/base.py` (import `LLMProvider`, call through it — never touch `google-genai` directly), `core/models.py` (import `EvidenceItem`, `Finding`, `Claim`).

---

## Hour 0-2

- [ ] Read `docs/00-CONTRACTS.md` fully. Flag now, not at hour 20, if `EvidenceItem` or `Finding`'s shape doesn't fit what you're about to build.

## Hour 2-11 (→ Checkpoint 1)

- [ ] `evidence/search.py`: `search_evidence(claim: Claim) -> list[EvidenceItem]`. DuckDuckGo Lite search via Scrapling AsyncFetcher, **one query per claim** (zero external API keys required), wrapped in `tenacity` retry for transient failures.
- [ ] `evidence/curate.py`: a curation step — start with a simple keyword/relevance heuristic (upgrade to a cheap LLM call later if time allows). Input: raw text + the claim. Output: 1-3 sentences actually relevant to the claim. **Nothing beyond this curated snippet should ever reach an evaluator's prompt.**
- [ ] `core/evaluators/receipts.py`: `run_receipts(claim, plan_item, case) -> Finding`. Calls `search_evidence`, curates, then calls through `LLMProvider` (imported from `providers/base.py`) with the claim + curated evidence to produce a `Finding`.
- [ ] **Tests:** `search_evidence` returns a well-formed `list[EvidenceItem]` (mock the DuckDuckGo search); curation truncates arbitrary input text to 1-3 sentences and doesn't pass the full page through; `run_receipts` on a fixture claim + fixture evidence produces a `Finding` with non-empty `evidence`.

**→ Update `PROGRESS.md` per box, not in a batch.**

## Hour 11-35 (→ Checkpoint 2)

- [ ] `evidence/fetch.py`: Scrapling wrapper, used for two things — (a) deep-verification when a claim is `load_bearing` and the snippet isn't strong enough to hang a verdict on (fetch the top 1-2 candidate URLs, full page text replaces the thin snippet), and (b) pasted-URL ingestion.
- [ ] Wire the adaptive-scrutiny branch into `receipts.py`: only pay for a Scrapling deep-fetch when `claim.load_bearing` is true and the search snippet is thin.
- [ ] Demo fallback, as an **explicit switch**, not string-matching on query text:
  ```python
  # evidence/search.py
  DEMO_FIXTURES: dict[str, list[EvidenceItem]] = {
      "claim-abc123": [...],   # pre-captured, reproducible evidence for the one demo-critical claim
  }

  async def search_evidence(claim: Claim) -> list[EvidenceItem]:
      if settings.DEMO_MODE and claim.id in DEMO_FIXTURES:
          return DEMO_FIXTURES[claim.id]
      # ... standard DuckDuckGo search via Scrapling
  ```
  Keyed by the actual `claim_id` from the demo's prepared case — never a fuzzy text match.
- [ ] Failure handling: a dead DuckDuckGo result or a Scrapling fetch that genuinely can't beat a wall → drop that source, don't retry into a crash. `Receipts` still produces a `Finding`, just with fewer/zero `EvidenceItem`s — that's a data point that should push the claim toward `unresolved`, not an exception to catch upstream.
- [ ] If time allows: upgrade curation from keyword heuristic to a short, low-token LLM call ("pick the 1-3 sentences relevant to `<claim>` from this text").
- [ ] Stretch, only if the above is solid and hour 35 shows slack: `ingestion/pdf.py` — `pypdf`/`pdfplumber` text extraction, same curation step, feeds `Case.context`. Reject scanned/image-only PDFs with a clear error — no OCR path.
- [ ] **Tests:** load-bearing + thin-snippet claim triggers the Scrapling path (mock both calls, assert `fetch` was called); non-load-bearing claim never triggers `fetch`; `DEMO_MODE=True` + matching `claim_id` returns the fixture and makes zero real API calls; a DuckDuckGo search failure and a Scrapling failure each degrade to a `Finding` with empty evidence rather than raising.

**→ Update `PROGRESS.md`. Checkpoint 2.**

## Hour 35-48

- [ ] Only if asked / if there's slack: help Dev A stress-test the internal eval set against your evidence pipeline specifically (thin-evidence cases, dead-link cases).
