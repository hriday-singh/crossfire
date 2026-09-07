# Crossfire Output Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Crossfire memos from citing unverifiable sources or asserting unsourced specifics, and make every memo end with a buildable salvaged version instead of a bullet.

**Architecture:** Two arms landing in one pass. The trust arm verifies that each cited page actually contains its quoted snippet (HTTP only, no LLM) and force-marks any named specific that no evidence supports. The constructive arm splits bundled ideas into separately-killable mechanisms, resolves domain jargon before searching, and assembles a case-level build spec from what survived. Every LLM-touching change is a prompt extension on a call that already runs.

**Tech Stack:** Python 3 / FastAPI / Pydantic / pytest (backend), React + TypeScript + Vite / Vitest + React Testing Library (frontend), Scrapling (page fetch), SerpApi + DuckDuckGo (search).

**Spec:** `docs/superpowers/specs/2026-09-08-crossfire-quality-design.md`

## Global Constraints

- **Never commit.** Per `CLAUDE.md`, the agent stages changes and proposes a conventional-commit message. The user runs `git commit` themselves. Every "Commit" step below means: stage the listed files and print the suggested message.
- **Never run migrations.** No schema migration is required here (cases serialize to JSON via `backend/store.py`), but if one becomes necessary, generate the file only.
- **LLM call budget: ~1.5x current.** No task may add a new LLM call. Prompt extensions on existing calls only.
- **All new model fields are additive with defaults.** `backend/core/models.py` carries a FROZEN banner referencing a Dev B/C sync. Additive-with-default keeps old serialized cases loading; flag the change to the user rather than silently editing past the banner.
- **No new design tokens.** Frontend work reuses `frontend/src/components/ui/` primitives and `frontend/src/globals.css` tokens. No hex values, no one-off spacing, no new components.
- **Frontend testing is mandatory in the same pass** per `frontend/CLAUDE.md` and `frontend/TESTING.md`. `npm run test:all` must pass with zero failures before any frontend task is done. Never weaken or skip an existing assertion.
- **Backend tests** live in `backend/tests/` and run with `pytest` from `backend/`.
- **Calibration values are config, not constants.** Thresholds go in `backend/config.py` with an env alias.

---

### Task 1: Data model additions

**Files:**
- Modify: `backend/core/models.py`
- Modify: `frontend/src/types/crossfire.ts`
- Test: `backend/tests/core/test_models.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `ResolvedTerm(term: str, resolved: str, search_phrasing: str)`; `BuildSpec(what_it_does: str, what_it_omits: str, demo_path: str, cheapest_experiment: str)`; `EvidenceItem.verified: bool`, `EvidenceItem.verification: str`; `Claim.terms: list[ResolvedTerm]`, `Claim.mechanism_of: str | None`; `CaseVerdict.surviving_core: str`, `CaseVerdict.build_spec: BuildSpec | None`. Every later task depends on these names.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/core/test_models.py`:

```python
from core.models import BuildSpec, CaseVerdict, Claim, EvidenceItem, ResolvedTerm


def test_evidence_item_defaults_to_unchecked():
    item = EvidenceItem(source_url="https://example.com", snippet="x", retrieved_at="2026-09-08")
    assert item.verified is False
    assert item.verification == "unchecked"


def test_claim_accepts_terms_and_mechanism():
    claim = Claim(
        id="c1",
        statement="bot books tickets",
        terms=[ResolvedTerm(term="holiday quotas", resolved="Tatkal quota", search_phrasing="IRCTC Tatkal quota timing")],
        mechanism_of="irctc-booking-bot",
    )
    assert claim.terms[0].search_phrasing == "IRCTC Tatkal quota timing"
    assert claim.mechanism_of == "irctc-booking-bot"


def test_claim_defaults_have_no_terms_or_mechanism():
    claim = Claim(id="c1", statement="x")
    assert claim.terms == []
    assert claim.mechanism_of is None


def test_case_verdict_carries_surviving_core_and_build_spec():
    verdict = CaseVerdict(
        decision_state="proceed_with_changes",
        summary="s",
        surviving_core="The prepare-and-race mechanism survives.",
        build_spec=BuildSpec(
            what_it_does="Prepares the booking up to the CAPTCHA.",
            what_it_omits="Automated CAPTCHA solving, because it defeats an anti-bot control.",
            demo_path="Run against a mock booking environment with a countdown.",
            cheapest_experiment="Time a prepared human against the agent on a non-peak window.",
        ),
    )
    assert verdict.surviving_core.startswith("The prepare-and-race")
    assert verdict.build_spec.what_it_omits.startswith("Automated CAPTCHA")


def test_case_verdict_defaults_are_empty():
    verdict = CaseVerdict(decision_state="drop", summary="s")
    assert verdict.surviving_core == ""
    assert verdict.build_spec is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/core/test_models.py -v -k "unchecked or terms_and_mechanism or surviving_core or defaults"`
Expected: FAIL with `ImportError: cannot import name 'ResolvedTerm'`

- [ ] **Step 3: Write minimal implementation**

In `backend/core/models.py`, add above `class Claim`:

```python
class ResolvedTerm(BaseModel):
    """A domain term from the user's input, resolved to what it concretely denotes.

    Imported jargon is why searches came back generic: "holiday quotas" retrieves
    press coverage, "Tatkal quota opening time" retrieves the operator's own rules.
    """

    term: str              # as the user wrote it
    resolved: str          # what it concretely means
    search_phrasing: str   # how to phrase it for a search engine
```

Add above `class CaseVerdict`:

```python
class BuildSpec(BaseModel):
    """The salvaged version, specified concretely enough to start building.

    Assembled from surviving mechanisms and isolated fatal flaws — not invented.
    """

    what_it_does: str
    what_it_omits: str         # the removed mechanism, named, and why
    demo_path: str             # how to show it working without the fatal part
    cheapest_experiment: str
```

Add fields to the existing models:

```python
# on EvidenceItem
    verified: bool = False
    verification: str = "unchecked"   # snippet_matched | snippet_absent
                                      # | unreachable | unchecked

# on Claim
    terms: list[ResolvedTerm] = []
    mechanism_of: str | None = None   # parent idea label shared by sibling claims

# on CaseVerdict
    surviving_core: str = ""          # the part of the idea that lives; empty only on drop
    build_spec: BuildSpec | None = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/core/test_models.py -v`
Expected: PASS, including all pre-existing tests in the file.

- [ ] **Step 5: Mirror the types on the frontend**

In `frontend/src/types/crossfire.ts`, add the two interfaces and the optional fields. Match the existing style in that file (optional fields with `?`, not `| undefined`):

```typescript
export interface ResolvedTerm {
  term: string;
  resolved: string;
  search_phrasing: string;
}

export interface BuildSpec {
  what_it_does: string;
  what_it_omits: string;
  demo_path: string;
  cheapest_experiment: string;
}
```

Then add to the existing interfaces:

```typescript
// on EvidenceItem
  verified?: boolean;
  verification?: "snippet_matched" | "snippet_absent" | "unreachable" | "unchecked";

// on Claim
  terms?: ResolvedTerm[];
  mechanism_of?: string | null;

// on CaseVerdict
  surviving_core?: string;
  build_spec?: BuildSpec | null;
```

- [ ] **Step 6: Run frontend typecheck and tests**

Run: `cd frontend && npm run test:all`
Expected: PASS with zero failures. Optional fields cannot break existing consumers; if anything fails, the type was added as required rather than optional.

- [ ] **Step 7: Commit**

Stage and propose (do not run `git commit`):

```bash
git add backend/core/models.py backend/tests/core/test_models.py frontend/src/types/crossfire.ts
# suggested: feat(models): add evidence verification, resolved terms, mechanisms, build spec
```

Flag to the user: `core/models.py` is FROZEN per its banner. All six fields are additive with defaults and wire-compatible, but the banner asks for a live sync with Dev B/C.

---

### Task 2: Snippet verification module

**Files:**
- Create: `backend/evidence/verify.py`
- Modify: `backend/config.py`
- Test: `backend/tests/evidence/test_verify.py`

**Interfaces:**
- Consumes: `EvidenceItem` from Task 1; `fetch_page(url: str, timeout: float) -> str` from `backend/evidence/fetch.py`.
- Produces: `snippet_matches(snippet: str, page_text: str, threshold: float) -> bool`; `async verify_evidence(items: list[EvidenceItem]) -> list[EvidenceItem]` (returns the same items mutated in place, with `snippet_absent` items removed).

**Why a ratio and not a substring test:** `curate_snippet` in `backend/evidence/curate.py` rewrites and joins sentences, so a snippet is rarely a verbatim substring of the page. An exact match would reject honest evidence. Token-set containment answers the actual question — "do the snippet's words come from this page" — which is what a fabricated citation fails.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/evidence/test_verify.py`:

```python
import pytest

from core.models import EvidenceItem
from evidence.verify import snippet_matches, verify_evidence

PAGE = (
    "For Tatkal booking, opening day means one day in advance from date of "
    "departure of train from originating station. For AC classes, Tatkal "
    "Booking commences at 10:00 AM and for Non AC classes at 11:00 AM."
)


def _item(url: str, snippet: str) -> EvidenceItem:
    return EvidenceItem(source_url=url, snippet=snippet, retrieved_at="2026-09-08")


def test_snippet_matches_curated_paraphrase():
    snippet = "For AC classes Tatkal Booking commences at 10:00 AM"
    assert snippet_matches(snippet, PAGE, threshold=0.7) is True


def test_snippet_matches_ignores_case_and_punctuation():
    snippet = "tatkal booking commences at 10:00 am, for ac classes."
    assert snippet_matches(snippet, PAGE, threshold=0.7) is True


def test_snippet_absent_when_words_are_not_on_the_page():
    snippet = "IRCTC has blocked 30 million suspicious user IDs this fiscal year"
    assert snippet_matches(snippet, PAGE, threshold=0.7) is False


def test_empty_page_never_matches():
    assert snippet_matches("anything at all here", "", threshold=0.7) is False


def test_empty_snippet_never_matches():
    assert snippet_matches("", PAGE, threshold=0.7) is False


@pytest.mark.asyncio
async def test_verify_marks_matched_items(monkeypatch):
    async def fake_fetch(url, timeout=5.0):
        return PAGE

    monkeypatch.setattr("evidence.verify.fetch_page", fake_fetch)
    items = [_item("https://contents.irctc.co.in/en/tc.pdf", "Tatkal Booking commences at 10:00 AM")]
    result = await verify_evidence(items)
    assert len(result) == 1
    assert result[0].verified is True
    assert result[0].verification == "snippet_matched"


@pytest.mark.asyncio
async def test_verify_drops_fabricated_citation(monkeypatch):
    async def fake_fetch(url, timeout=5.0):
        return "This is an unrelated project showcase site."

    monkeypatch.setattr("evidence.verify.fetch_page", fake_fetch)
    items = [_item("https://news.csraid.com/en/hub/irctc-blocks-30-million", "IRCTC has blocked 30 million suspicious user IDs")]
    result = await verify_evidence(items)
    assert result == []


@pytest.mark.asyncio
async def test_verify_keeps_unreachable_but_unverified(monkeypatch):
    async def fake_fetch(url, timeout=5.0):
        return ""

    monkeypatch.setattr("evidence.verify.fetch_page", fake_fetch)
    items = [_item("https://contents.irctc.co.in/en/Agent_Policy.pdf", "Tatkal Robot Facility is prohibited")]
    result = await verify_evidence(items)
    assert len(result) == 1
    assert result[0].verified is False
    assert result[0].verification == "unreachable"


@pytest.mark.asyncio
async def test_verify_treats_fetch_exception_as_unreachable(monkeypatch):
    async def fake_fetch(url, timeout=5.0):
        raise ValueError("Fetching private or unsafe URL is disallowed")

    monkeypatch.setattr("evidence.verify.fetch_page", fake_fetch)
    items = [_item("http://127.0.0.1/secret", "anything")]
    result = await verify_evidence(items)
    assert len(result) == 1
    assert result[0].verification == "unreachable"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/evidence/test_verify.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'evidence.verify'`

- [ ] **Step 3: Add the config values**

In `backend/config.py`, alongside the other evidence settings:

```python
    verify_citations: bool = Field(default=True, alias="VERIFY_CITATIONS")
    verify_snippet_threshold: float = Field(default=0.7, alias="VERIFY_SNIPPET_THRESHOLD")
    verify_fetch_timeout_seconds: float = Field(default=5.0, alias="VERIFY_FETCH_TIMEOUT_SECONDS")
    verify_concurrency: int = Field(default=8, alias="VERIFY_CONCURRENCY")
```

Add the same four keys to `.env.example` with their defaults and a one-line comment each.

- [ ] **Step 4: Write minimal implementation**

Create `backend/evidence/verify.py`:

```python
"""Citation integrity: does the page a snippet claims to come from actually contain it?

A well-formed EvidenceItem is not a real one. `news.csraid.com` reached a shipped
memo with a URL, a title and a plausible snippet, and the evidence gate passed it
because the gate checks that evidence exists, not that it is real.

Zero LLM calls. HTTP and string comparison only.
"""
from __future__ import annotations

import asyncio
import logging
import re

from config import settings
from core.models import EvidenceItem
from evidence.fetch import fetch_page

logger = logging.getLogger(__name__)

_WORD = re.compile(r"\w+", re.UNICODE)

# Words that appear on every page and prove nothing about provenance.
_NOISE = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "from",
    "is", "are", "was", "were", "be", "been", "by", "with", "as", "that", "this",
    "it", "its", "not", "no", "but", "if", "then", "than", "so", "such",
}


def _tokens(text: str) -> set[str]:
    return {t for t in (m.group(0).lower() for m in _WORD.finditer(text or "")) if t not in _NOISE}


def snippet_matches(snippet: str, page_text: str, threshold: float) -> bool:
    """True when enough of the snippet's distinctive words appear on the page.

    Containment, not similarity: the page is long and the snippet is short, so a
    symmetric ratio would score every honest match near zero.
    """
    snippet_tokens = _tokens(snippet)
    page_tokens = _tokens(page_text)
    if not snippet_tokens or not page_tokens:
        return False
    overlap = len(snippet_tokens & page_tokens) / len(snippet_tokens)
    return overlap >= threshold


async def _verify_one(item: EvidenceItem, threshold: float, timeout: float) -> EvidenceItem:
    try:
        page_text = await fetch_page(item.source_url, timeout=timeout)
    except Exception as exc:
        # fetch_page raises only on structural refusals (SERP, unsafe URL).
        # Those are our rule, not the source's fault, so they are unreachable.
        logger.info("Citation verification could not fetch %s: %s", item.source_url, exc)
        page_text = ""

    if not page_text:
        item.verified = False
        item.verification = "unreachable"
    elif snippet_matches(item.snippet, page_text, threshold):
        item.verified = True
        item.verification = "snippet_matched"
    else:
        item.verified = False
        item.verification = "snippet_absent"
        logger.warning(
            "Citation dropped: snippet not found on %s (snippet=%.80r)",
            item.source_url,
            item.snippet,
        )
    return item


async def verify_evidence(items: list[EvidenceItem]) -> list[EvidenceItem]:
    """Stamps verification status on each item and drops the fabricated ones.

    `unreachable` is deliberately NOT a failure. Primary sources are exactly the
    ones most likely to be PDFs or bot-walled, and discarding them would leave us
    citing only the sites that are easy to scrape.
    """
    if not items:
        return []
    if not settings.verify_citations:
        return items

    sem = asyncio.Semaphore(max(1, settings.verify_concurrency))

    async def bounded(item: EvidenceItem) -> EvidenceItem:
        async with sem:
            return await _verify_one(
                item,
                settings.verify_snippet_threshold,
                settings.verify_fetch_timeout_seconds,
            )

    verified = await asyncio.gather(*(bounded(i) for i in items))
    return [i for i in verified if i.verification != "snippet_absent"]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/evidence/test_verify.py -v`
Expected: PASS, all 8 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/evidence/verify.py backend/tests/evidence/test_verify.py backend/config.py .env.example
# suggested: feat(evidence): verify cited snippets appear on the page they cite
```

---

### Task 3: Demote unknown-root subdomains in source classification

**Files:**
- Modify: `backend/evidence/search.py:110-150`
- Test: `backend/tests/evidence/test_search.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `classify_source` may now return `"unranked"`; `SOURCE_CLASS_RANK["unranked"] = 5`.

**Context:** `classify_source` today reads the host and returns `primary | institutional | community | blog | web`, and `news.csraid.com` lands on `web` — the same class as a real outlet. The comment above `SOURCE_CLASS_RANK` correctly refuses a domain allowlist; this is not one. It is a shape rule: a bare host earns `web`, a subdomain that is not one of the recognized `_PRIMARY_SUBDOMAINS` earns less, because an arbitrary label in front of an unknown root domain carries no authority on its own. Task 2 is the primary defense; this is the cheap second layer that sorts such hosts last.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/evidence/test_search.py`:

```python
from evidence.search import SOURCE_CLASS_RANK, classify_source, rank_by_source_class
from core.models import EvidenceItem


def test_unknown_root_subdomain_is_unranked():
    assert classify_source("https://news.csraid.com/en/hub/irctc-blocks-30-million") == "unranked"


def test_bare_unknown_host_is_still_web():
    assert classify_source("https://csraid.com/") == "web"


def test_www_prefix_is_not_treated_as_a_subdomain():
    assert classify_source("https://www.millenniumpost.in/nation/bots-article") == "web"


def test_recognized_primary_subdomain_still_wins():
    assert classify_source("https://docs.stripe.com/api") == "primary"


def test_gov_subdomain_still_primary():
    assert classify_source("https://www.newsonair.gov.in/aadhaar-tatkal") == "primary"


def test_unranked_sorts_last():
    items = [
        EvidenceItem(source_url="https://news.csraid.com/x", snippet="s", retrieved_at="t"),
        EvidenceItem(source_url="https://indianexpress.com/article/x", snippet="s", retrieved_at="t"),
    ]
    ranked = rank_by_source_class(items)
    assert ranked[0].source_url.startswith("https://indianexpress.com")
    assert ranked[-1].source_class == "unranked"
    assert SOURCE_CLASS_RANK["unranked"] > SOURCE_CLASS_RANK["blog"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/evidence/test_search.py -v -k "unranked or bare_unknown or www_prefix"`
Expected: FAIL — `assert 'web' == 'unranked'`

- [ ] **Step 3: Write minimal implementation**

In `backend/evidence/search.py`, add to `SOURCE_CLASS_RANK`:

```python
    "unranked": 5,       # a subdomain of a root domain we have no signal about
```

Add near the other host tuples:

```python
# Labels that are structural rather than editorial: they do not turn an unknown
# root domain into a publisher.
_NEUTRAL_SUBDOMAINS = ("www", "m", "amp", "en", "web")
```

At the end of `classify_source`, replace `return "web"` with:

```python
    # An arbitrary label in front of an unknown root domain carries no authority
    # of its own. `news.csraid.com` is not a newsroom because it says "news".
    if len(labels) > 2 and labels[0] not in _NEUTRAL_SUBDOMAINS:
        return "unranked"
    return "web"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/evidence/test_search.py -v`
Expected: PASS, including every pre-existing test in the file. If an existing test asserted `"web"` for a multi-label host, check whether that host is genuinely a publisher — if it is, add its root to a recognized tuple rather than weakening the new rule.

- [ ] **Step 5: Commit**

```bash
git add backend/evidence/search.py backend/tests/evidence/test_search.py
# suggested: fix(evidence): stop treating unknown-root subdomains as ordinary web sources
```

---

### Task 4: Require verified evidence to break a claim

**Files:**
- Modify: `backend/core/loop.py` (evidence path, after search/curate, before `run_evaluators`)
- Modify: `backend/core/reconcile.py:261-263` (`has_sourced_contradiction`)
- Test: `backend/tests/core/test_reconcile.py`, `backend/tests/core/test_loop.py`

**Interfaces:**
- Consumes: `verify_evidence` from Task 2; `EvidenceItem.verification` from Task 1.
- Produces: `has_sourced_contradiction` now requires at least one item whose `verification == "snippet_matched"`.

**Context:** `apply_evidence_gate` already refuses to let a claim reach `broken` without a sourced contradiction, and `has_sourced_contradiction` is the predicate it uses. Today that predicate is `f.evidence and f.contradiction` — presence, not validity. This is the one-line change that makes Task 2 actually bind.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/core/test_reconcile.py`:

```python
from core.models import EvidenceItem, Finding
from core.reconcile import has_sourced_contradiction


def _finding(verification: str) -> Finding:
    return Finding(
        claim_id="c1",
        test_id="t1",
        evaluator="researcher",
        result="refuted",
        reasoning="r",
        contradiction="The operator's own policy forbids it.",
        evidence=[
            EvidenceItem(
                source_url="https://example.com",
                snippet="s",
                retrieved_at="2026-09-08",
                verification=verification,
                verified=(verification == "snippet_matched"),
            )
        ],
    )


def test_verified_evidence_supports_a_break():
    assert has_sourced_contradiction([_finding("snippet_matched")]) is True


def test_unreachable_evidence_does_not_support_a_break():
    assert has_sourced_contradiction([_finding("unreachable")]) is False


def test_unchecked_evidence_does_not_support_a_break():
    assert has_sourced_contradiction([_finding("unchecked")]) is False


def test_contradiction_without_evidence_still_does_not_break():
    finding = Finding(
        claim_id="c1", test_id="t1", evaluator="devils_advocate",
        result="refuted", reasoning="r", contradiction="Akamai blocks it.", evidence=[],
    )
    assert has_sourced_contradiction([finding]) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/core/test_reconcile.py -v -k "unreachable_evidence or unchecked_evidence"`
Expected: FAIL — `assert True is False`, because presence alone currently satisfies the predicate.

- [ ] **Step 3: Write minimal implementation**

In `backend/core/reconcile.py`, replace `has_sourced_contradiction`:

```python
def has_sourced_contradiction(findings: list[Finding]) -> bool:
    """A claim only breaks on a contradiction traceable to a source we could read.

    Presence of an EvidenceItem is not proof of one. A fabricated citation is a
    well-formed object; only `snippet_matched` means we fetched the page and found
    the quoted words on it. `unreachable` sources still inform the memo — they just
    cannot carry a kill.
    """
    return any(
        (f.contradiction or "").strip()
        and any(e.verification == "snippet_matched" for e in f.evidence)
        for f in findings
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/core/test_reconcile.py -v`
Expected: PASS. Pre-existing tests that construct `EvidenceItem` without a `verification` will now see `"unchecked"` and stop supporting a break. Where a test's intent is "this claim breaks on evidence", set `verification="snippet_matched"` on its fixture — that is a fixture correction, not a weakened assertion. Where the intent is "absence of evidence is not refutation", leave it.

- [ ] **Step 5: Wire verification into the pipeline**

In `backend/core/loop.py`, at the point where searched-and-curated evidence is assembled for a claim (immediately before it is handed to `run_evaluators`), add:

```python
from evidence.verify import verify_evidence

# ... after evidence is gathered for a claim:
evidence_items = await verify_evidence(evidence_items)
```

Follow the surrounding stage-event convention: if the code around it publishes progress via `events.publish`, publish a `verification` stage event with the counts (`matched`, `unreachable`, `dropped`) so the live feed shows it.

- [ ] **Step 6: Write the pipeline test**

Add to `backend/tests/core/test_loop.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_pipeline_verifies_evidence_before_evaluators(monkeypatch):
    """Fabricated citations must not reach the panel at all."""
    seen: dict[str, list] = {}

    async def fake_verify(items):
        seen["input"] = list(items)
        return [i for i in items if "csraid" not in i.source_url]

    monkeypatch.setattr("core.loop.verify_evidence", fake_verify)
    # Drive the existing pipeline fixture used elsewhere in this file, then assert:
    #   - fake_verify was called (seen["input"] is populated)
    #   - no finding's evidence contains a csraid URL
```

Complete the test body using the pipeline fixture already established in `test_loop.py`; do not invent a new harness.

- [ ] **Step 7: Run the backend suite**

Run: `cd backend && pytest -v`
Expected: PASS with zero failures.

- [ ] **Step 8: Commit**

```bash
git add backend/core/reconcile.py backend/core/loop.py backend/tests/core/test_reconcile.py backend/tests/core/test_loop.py
# suggested: fix(reconcile): require verified evidence before a claim can break
```

---

### Task 5: Mark unsourced specifics as unverified

**Files:**
- Create: `backend/core/grounding.py`
- Modify: `backend/core/evaluators/_reasoning.py` (shared prompt rule)
- Modify: `backend/core/reconcile.py` (apply the scan; bar unverified findings from `deciding_factor`)
- Test: `backend/tests/core/test_grounding.py`

**Interfaces:**
- Consumes: `Finding` from Task 1.
- Produces: `find_unsourced_specifics(text: str, evidence: list[EvidenceItem]) -> list[str]`; `mark_unsourced(finding: Finding) -> Finding`; `has_unsourced_specifics(finding: Finding) -> bool`.

**Context:** "Akamai edge bot protection" and "Section 143 criminalizes this" are the same bug — the panel invents checkable-sounding specifics because sounding rigorous is rewarded and being checkable is not. The prompt layer alone leaks, so there is a code layer behind it. The code layer is deliberately crude; over-marking costs a little confidence, under-marking costs the memo.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/core/test_grounding.py`:

```python
from core.grounding import find_unsourced_specifics, has_unsourced_specifics, mark_unsourced
from core.models import EvidenceItem, Finding


def _ev(snippet: str) -> EvidenceItem:
    return EvidenceItem(source_url="https://example.com", snippet=snippet, retrieved_at="2026-09-08")


def test_flags_a_vendor_name_no_source_mentions():
    text = "Akamai edge bot protection blocks headless sessions."
    assert "Akamai" in find_unsourced_specifics(text, [_ev("an anti-bot system and CDN")])


def test_does_not_flag_a_vendor_the_evidence_names():
    text = "Akamai edge bot protection blocks headless sessions."
    assert find_unsourced_specifics(text, [_ev("IRCTC deployed Akamai bot manager")]) == []


def test_flags_a_statute_reference():
    text = "This violates Section 143 of the Indian Railways Act."
    found = find_unsourced_specifics(text, [_ev("unauthorised agents are punishable")])
    assert "Section 143" in found


def test_flags_a_bare_percentage():
    text = "Bots accounted for 58% of booking requests."
    assert "58%" in find_unsourced_specifics(text, [_ev("more than half of requests")])


def test_does_not_flag_a_percentage_the_evidence_carries():
    text = "Bots accounted for 58% of booking requests."
    assert find_unsourced_specifics(text, [_ev("bots made 58% of booking attempts")]) == []


def test_ordinary_prose_is_not_flagged():
    text = "The booking window is short and demand is high."
    assert find_unsourced_specifics(text, [_ev("demand exceeds supply")]) == []


def test_mark_unsourced_annotates_the_contradiction():
    finding = Finding(
        claim_id="c1", test_id="t1", evaluator="devils_advocate", result="refuted",
        reasoning="r", contradiction="Akamai edge bot protection blocks it.",
        evidence=[_ev("an anti-bot system and CDN")],
    )
    marked = mark_unsourced(finding)
    assert "[unverified]" in marked.contradiction
    assert has_unsourced_specifics(marked) is True


def test_mark_unsourced_leaves_grounded_findings_alone():
    finding = Finding(
        claim_id="c1", test_id="t1", evaluator="researcher", result="refuted",
        reasoning="r", contradiction="Tatkal opens at 10:00 AM for AC classes.",
        evidence=[_ev("For AC classes, Tatkal Booking commences at 10:00 AM")],
    )
    marked = mark_unsourced(finding)
    assert "[unverified]" not in (marked.contradiction or "")
    assert has_unsourced_specifics(marked) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/core/test_grounding.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.grounding'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/core/grounding.py`:

```python
"""Force every checkable specific in a finding to be checkable.

The panel's job is to argue. Its failure mode is inventing a vendor, a statute or
a number to make an argument land — "Akamai edge bot protection", "Section 143
criminalises this" — neither of which any source we retrieved supports.

Crude on purpose. A wrongly marked specific costs a little confidence; a
fabricated specific presented as fact costs the whole memo.
"""
from __future__ import annotations

import re

from core.models import EvidenceItem, Finding

UNVERIFIED_MARKER = "[unverified]"

# A capitalised token that is not sentence-initial, or a run of them: vendor and
# product names.
_PROPER = re.compile(r"(?<![.!?]\s)(?<!^)\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,})*)\b", re.MULTILINE)
# Statute-shaped references.
_STATUTE = re.compile(r"\b((?:Section|Article|Clause|Rule)\s+\d+[A-Za-z]?)\b")
# Percentages and quantities with a unit or scale word.
_QUANTITY = re.compile(r"\b(\d[\d,.]*\s*(?:%|percent|million|billion|crore|lakh|thousand))\b", re.IGNORECASE)

# Capitalised words that are grammar, not claims.
_STOP_PROPER = {
    "The", "This", "That", "These", "Those", "There", "Their", "They", "It", "Its",
    "If", "When", "While", "Because", "However", "Therefore", "Furthermore",
    "Day", "One", "Two", "Three", "First", "Second", "Third",
}


def _evidence_text(evidence: list[EvidenceItem]) -> str:
    return " ".join(f"{e.title or ''} {e.snippet}" for e in evidence).lower()


def find_unsourced_specifics(text: str, evidence: list[EvidenceItem]) -> list[str]:
    """Returns the checkable specifics in `text` that no evidence snippet supports."""
    haystack = _evidence_text(evidence)
    candidates: list[str] = []
    for match in _STATUTE.finditer(text or ""):
        candidates.append(match.group(1))
    for match in _QUANTITY.finditer(text or ""):
        candidates.append(match.group(1))
    for match in _PROPER.finditer(text or ""):
        token = match.group(1)
        if token in _STOP_PROPER:
            continue
        candidates.append(token)

    unsourced: list[str] = []
    for candidate in candidates:
        if candidate.lower() in haystack:
            continue
        if candidate not in unsourced:
            unsourced.append(candidate)
    return unsourced


def _annotate(text: str | None, evidence: list[EvidenceItem]) -> str | None:
    if not text:
        return text
    if UNVERIFIED_MARKER in text:
        return text
    if find_unsourced_specifics(text, evidence):
        return f"{text.rstrip()} {UNVERIFIED_MARKER}"
    return text


def mark_unsourced(finding: Finding) -> Finding:
    """Appends the unverified marker to any finding text carrying unsourced specifics."""
    finding.contradiction = _annotate(finding.contradiction, finding.evidence)
    finding.reasoning = _annotate(finding.reasoning, finding.evidence) or finding.reasoning
    return finding


def has_unsourced_specifics(finding: Finding) -> bool:
    """True when this finding must not be allowed to carry the case verdict."""
    return UNVERIFIED_MARKER in (finding.contradiction or "") or UNVERIFIED_MARKER in (finding.reasoning or "")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/core/test_grounding.py -v`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Add the prompt rule**

In `backend/core/evaluators/_reasoning.py`, add to the shared instruction block that every evaluator persona composes with:

```
GROUNDING RULE — every named specific must be checkable.
If you name a vendor, a product, a statute, a named system, or a quantity, it
must either appear in the evidence you were given, or you must write it followed
by [unverified]. "Akamai blocks this" with no source in hand is not an argument,
it is a decoration. Reasoning without specifics is fine and is what you are for;
inventing a specific to make reasoning sound like research is not.
```

- [ ] **Step 6: Apply the scan and bar unverified findings from deciding_factor**

In `backend/core/reconcile.py`, run `mark_unsourced` over each finding before it is ranked, and exclude findings where `has_unsourced_specifics` is true from `deciding_factor` selection:

```python
from core.grounding import has_unsourced_specifics, mark_unsourced

# before ranking:
findings = [mark_unsourced(f) for f in findings]

# when picking the deciding factor, prefer grounded findings:
candidates = [f for f in rank_findings(findings) if not has_unsourced_specifics(f)]
```

If no grounded candidate exists, fall back to the existing selection rather than emitting no deciding factor — a `gate_fired` verdict with a weak factor is more honest than a silent omission.

- [ ] **Step 7: Test the reconcile integration**

Add to `backend/tests/core/test_reconcile.py` a test asserting that a finding whose contradiction names an unsourced vendor is not chosen as `deciding_factor` when a grounded alternative exists, and that it still is chosen when no alternative exists.

- [ ] **Step 8: Run the backend suite**

Run: `cd backend && pytest -v`
Expected: PASS with zero failures.

- [ ] **Step 9: Commit**

```bash
git add backend/core/grounding.py backend/tests/core/test_grounding.py backend/core/evaluators/_reasoning.py backend/core/reconcile.py backend/tests/core/test_reconcile.py
# suggested: feat(reconcile): mark unsourced specifics unverified and bar them from the verdict
```

---

### Task 6: Reachable pivot verdict and surviving core

**Files:**
- Modify: `backend/core/reconcile.py` (case verdict assembly)
- Test: `backend/tests/core/test_verdict_presentation.py`

**Interfaces:**
- Consumes: `CaseVerdict.surviving_core` from Task 1.
- Produces: `resolve_decision_state(claims: list[Claim]) -> str`.

**Context:** The losing run emitted "Drop automated ticketing bot completely" while two of three claims were merely WEAKENED, each carrying a salvage. `proceed_with_changes` already exists in the schema; nothing forced it. This is a code rule, not a prompt request, because a prompt asked to be less confident will simply be less confident at random.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/core/test_verdict_presentation.py`:

```python
from core.models import Claim, ClaimStatus
from core.reconcile import resolve_decision_state


def _claim(cid: str, status: ClaimStatus, load_bearing: bool, salvage: str | None = None) -> Claim:
    return Claim(id=cid, statement="s", status=status, load_bearing=load_bearing, salvaged_claim=salvage)


def test_drop_requires_every_load_bearing_claim_broken():
    claims = [
        _claim("c1", ClaimStatus.BROKEN, True),
        _claim("c2", ClaimStatus.WEAKENED, True, salvage="Hand the CAPTCHA to the human."),
    ]
    assert resolve_decision_state(claims) == "proceed_with_changes"


def test_all_load_bearing_broken_still_drops():
    claims = [
        _claim("c1", ClaimStatus.BROKEN, True),
        _claim("c2", ClaimStatus.BROKEN, True),
        _claim("c3", ClaimStatus.WEAKENED, False),
    ]
    assert resolve_decision_state(claims) == "drop"


def test_weakened_without_salvage_does_not_force_pivot():
    claims = [_claim("c1", ClaimStatus.BROKEN, True), _claim("c2", ClaimStatus.WEAKENED, True)]
    assert resolve_decision_state(claims) in ("drop", "hold")


def test_all_survived_proceeds():
    claims = [_claim("c1", ClaimStatus.SURVIVED, True), _claim("c2", ClaimStatus.SURVIVED, True)]
    assert resolve_decision_state(claims) == "proceed"


def test_unresolved_load_bearing_holds():
    claims = [_claim("c1", ClaimStatus.UNRESOLVED, True), _claim("c2", ClaimStatus.SURVIVED, True)]
    assert resolve_decision_state(claims) == "hold"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/core/test_verdict_presentation.py -v -k resolve_decision_state`
Expected: FAIL with `ImportError: cannot import name 'resolve_decision_state'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/core/reconcile.py`:

```python
def resolve_decision_state(claims: list[Claim]) -> str:
    """Derives the case decision from claim outcomes, in code.

    `drop` is the strongest thing this tool can say and it was being reached for
    while survivable mechanisms were still standing. It now requires that nothing
    load-bearing survived: one weakened-but-salvageable load-bearing claim means
    the honest answer is "change it", not "abandon it".
    """
    load_bearing = [c for c in claims if c.load_bearing]
    scope = load_bearing or claims
    if not scope:
        return "hold"

    if any(c.status is ClaimStatus.UNRESOLVED for c in scope):
        return "hold"
    if all(c.status is ClaimStatus.SURVIVED for c in scope):
        return "proceed"
    if any(c.status is ClaimStatus.WEAKENED and (c.salvaged_claim or "").strip() for c in scope):
        return "proceed_with_changes"
    if all(c.status is ClaimStatus.BROKEN for c in scope):
        return "drop"
    return "proceed_with_changes"
```

Call it where `CaseVerdict.decision_state` is currently assigned, overriding the model-supplied value.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/core/test_verdict_presentation.py -v`
Expected: PASS.

- [ ] **Step 5: Populate surviving_core**

In the synthesis prompt that already produces `CaseVerdict.headline` and `summary` (`backend/core/synthesis.py`), add `surviving_core` to the requested structured output with this instruction:

```
surviving_core: one sentence naming the part of the idea that is still standing
after the panel finished. Not a consolation prize and not a summary of the whole
proposal — the specific mechanism that survived. Leave it empty ONLY when the
decision is drop and genuinely nothing survived.
```

Add a code guard: when `decision_state != "drop"` and `surviving_core` came back empty, fall back to the statement of the highest-confidence surviving or weakened-with-salvage claim rather than shipping an empty lead.

- [ ] **Step 6: Test the guard**

Add a test in `backend/tests/core/test_synthesis.py` asserting `surviving_core` is non-empty whenever `decision_state != "drop"`, including when the model returns it empty.

- [ ] **Step 7: Run the backend suite and commit**

Run: `cd backend && pytest -v` — Expected: PASS.

```bash
git add backend/core/reconcile.py backend/core/synthesis.py backend/tests/core/test_verdict_presentation.py backend/tests/core/test_synthesis.py
# suggested: fix(verdict): require every load-bearing claim broken before drop, name the surviving core
```

---

### Task 7: Cross-claim deduplication

**Files:**
- Modify: `backend/core/reconcile.py`
- Test: `backend/tests/core/test_reconcile.py`

**Interfaces:**
- Consumes: `Finding` from Task 1.
- Produces: `dedupe_across_claims(findings: list[Finding], threshold: float = 0.75) -> list[Finding]`.

**Context:** The Akamai objection appeared verbatim under all three claims in the losing memo. Nothing is wrong with each instance individually; the repetition is what made it read as padding rather than analysis.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/core/test_reconcile.py`:

```python
from core.models import Finding
from core.reconcile import dedupe_across_claims


def _f(claim_id: str, contradiction: str, confidence: float) -> Finding:
    return Finding(
        claim_id=claim_id, test_id=f"t-{claim_id}", evaluator="devils_advocate",
        result="refuted", reasoning="r", contradiction=contradiction, confidence=confidence,
    )


def test_near_duplicate_objections_collapse_to_the_strongest():
    findings = [
        _f("c1", "Edge bot protection and mandatory OTP block automated sessions.", 0.5),
        _f("c2", "Mandatory OTP and edge bot protection block automated sessions.", 0.8),
        _f("c3", "Demand mathematically exceeds the seat supply in the database.", 0.6),
    ]
    result = dedupe_across_claims(findings)
    kept = [f.contradiction for f in result]
    assert len(result) == 2
    assert any("mathematically exceeds" in (c or "") for c in kept)
    assert sum(1 for c in kept if "bot protection" in (c or "")) == 1


def test_the_surviving_duplicate_is_the_strongest_one():
    findings = [
        _f("c1", "Edge bot protection blocks automated sessions.", 0.3),
        _f("c2", "Edge bot protection blocks automated sessions.", 0.9),
    ]
    result = dedupe_across_claims(findings)
    assert len(result) == 1
    assert result[0].confidence == 0.9


def test_findings_on_the_same_claim_are_never_deduped_against_each_other():
    findings = [
        _f("c1", "Edge bot protection blocks automated sessions.", 0.3),
        _f("c1", "Edge bot protection blocks automated sessions.", 0.9),
    ]
    assert len(dedupe_across_claims(findings)) == 2


def test_distinct_objections_all_survive():
    findings = [
        _f("c1", "The operator prohibits it in its own agent policy.", 0.7),
        _f("c2", "Aadhaar OTP is now mandatory for this quota.", 0.6),
    ]
    assert len(dedupe_across_claims(findings)) == 2


def test_empty_input_returns_empty():
    assert dedupe_across_claims([]) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/core/test_reconcile.py -v -k dedupe`
Expected: FAIL with `ImportError: cannot import name 'dedupe_across_claims'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/core/reconcile.py`:

```python
def _objection_tokens(finding: Finding) -> set[str]:
    text = (finding.contradiction or "") + " " + (finding.reasoning or "")
    return {t for t in re.findall(r"\w+", text.lower()) if len(t) > 3}


def dedupe_across_claims(findings: list[Finding], threshold: float = 0.75) -> list[Finding]:
    """Collapses the same objection restated against several claims.

    Deliberately scoped across claims only. Two evaluators independently landing on
    the same objection for ONE claim is corroboration and stays; the same objection
    pasted under every claim is padding and goes.
    """
    if not findings:
        return []

    ordered = sorted(findings, key=lambda f: f.confidence if f.confidence is not None else -1.0, reverse=True)
    kept: list[Finding] = []
    for finding in ordered:
        tokens = _objection_tokens(finding)
        if not tokens:
            kept.append(finding)
            continue
        duplicate = False
        for existing in kept:
            if existing.claim_id == finding.claim_id:
                continue
            other = _objection_tokens(existing)
            if not other:
                continue
            overlap = len(tokens & other) / min(len(tokens), len(other))
            if overlap >= threshold:
                duplicate = True
                break
        if not duplicate:
            kept.append(finding)
    # Identity, not equality: two Findings with the same field values are equal
    # under pydantic, and dropping both would be a silent data loss.
    kept_ids = {id(f) for f in kept}
    return [f for f in findings if id(f) in kept_ids]
```

Ensure `import re` is present at the top of the module. Call `dedupe_across_claims` on the findings that feed the memo, not on the findings that feed the per-claim status ruling — a claim's own verdict must still see every objection raised against it.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/core/test_reconcile.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/core/reconcile.py backend/tests/core/test_reconcile.py
# suggested: feat(reconcile): collapse the same objection restated across claims
```

---

### Task 8: Term resolution and mechanism decomposition in extraction

**Files:**
- Modify: `backend/core/loop.py:66-150` (`extract_claims` prompt and structured output)
- Modify: `backend/evidence/search.py:170-195` (`build_query`)
- Test: `backend/tests/core/test_loop.py`, `backend/tests/evidence/test_search.py`

**Interfaces:**
- Consumes: `ResolvedTerm`, `Claim.terms`, `Claim.mechanism_of` from Task 1.
- Produces: `build_query(statement: str, terms: list[ResolvedTerm] | None = None) -> str` — the added parameter is optional and defaults to today's behavior, so every existing caller keeps working.

**Context:** Two failures share this stage. "Holiday quotas" was never unpacked, so searches were phrased in the user's words and reached general press instead of the operator's own timing rules. And the proposal — fire at the exact second, solve the CAPTCHA, guarantee a confirmed ticket — is three mechanisms that fail independently, extracted as three flat assertions and then killed as one thing.

Both are prompt extensions on the extraction call. If output quality degrades from asking one call to do both, split term resolution out first; it is the more separable of the two.

- [ ] **Step 1: Write the failing test for query building**

Add to `backend/tests/evidence/test_search.py`:

```python
from core.models import ResolvedTerm
from evidence.search import build_query


def test_build_query_prefers_resolved_search_phrasing():
    terms = [ResolvedTerm(
        term="holiday quotas",
        resolved="Tatkal quota; 10:00 IST AC, 11:00 IST non-AC, T-1 day",
        search_phrasing="IRCTC Tatkal quota opening time rules",
    )]
    query = build_query("The bot books tickets when holiday quotas open", terms=terms)
    assert "Tatkal" in query


def test_build_query_without_terms_is_unchanged():
    statement = "The bot books tickets when holiday quotas open"
    assert build_query(statement) == build_query(statement, terms=None)


def test_build_query_ignores_terms_that_do_not_appear_in_the_statement():
    terms = [ResolvedTerm(term="waitlist clearing", resolved="RAC", search_phrasing="RAC confirmation odds")]
    query = build_query("The bot solves the CAPTCHA automatically", terms=terms)
    assert "RAC" not in query
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/evidence/test_search.py -v -k build_query_prefers`
Expected: FAIL with `TypeError: build_query() got an unexpected keyword argument 'terms'`

- [ ] **Step 3: Implement the query change**

In `backend/evidence/search.py`, change the signature and prepend matched phrasings:

```python
def build_query(statement: str, terms: list["ResolvedTerm"] | None = None) -> str:
    """Turns a full-sentence claim into a short keyword query.

    When extraction resolved a domain term that appears in this statement, the
    resolved phrasing leads. A search engine given the user's words returns
    coverage about the user's words; given the operator's words it returns the
    operator's rules.
    """
    lowered = (statement or "").lower()
    lead: list[str] = []
    for term in terms or []:
        if term.term and term.term.lower() in lowered and term.search_phrasing:
            lead.append(term.search_phrasing)

    if lead:
        remainder = _keywords(statement, budget=max(0, _MAX_QUERY_TERMS - len(" ".join(lead).split())))
        return " ".join([*lead, *remainder]).strip() or (statement or "").strip()
    return " ".join(_keywords(statement, budget=_MAX_QUERY_TERMS)) or (statement or "").strip()
```

Extract the existing token-filtering body of `build_query` into a helper `_keywords(statement: str, budget: int) -> list[str]` so both branches share it. Do not duplicate the stopword logic.

Update `search_evidence` to pass `claim.terms` through to `build_query`.

- [ ] **Step 4: Run the search tests**

Run: `cd backend && pytest tests/evidence/test_search.py -v`
Expected: PASS, including every pre-existing `build_query` test — the no-terms path must be byte-identical to today.

- [ ] **Step 5: Extend the extraction prompt**

In `backend/core/loop.py`, add to the `extract_claims` instruction block:

```
RESOLVE THE DOMAIN TERMS.
For each piece of domain jargon in the input, emit a term with: the phrase as the
user wrote it, what it concretely denotes, and how you would phrase it for a
search engine. "Holiday quotas" is not searchable; "IRCTC Tatkal quota opening
time" is. If you cannot resolve a term confidently, omit it — an unresolved term
is harmless, a wrongly resolved one sends every search to the wrong place.

SPLIT BUNDLED MECHANISMS.
An idea often bundles several mechanisms that fail independently. "Logs in at the
exact second, solves the CAPTCHA, and guarantees a confirmed ticket" is three: the
timing race, the CAPTCHA bypass, and the confirmation guarantee. Each can be true
or false without the others. Emit one claim per mechanism and give the siblings a
shared mechanism_of label naming the parent idea. Do not split a single mechanism
into restatements of itself — the test is whether one could fail while another
holds.
```

Add `terms` and `mechanism_of` to the structured output schema the extraction call requests.

- [ ] **Step 6: Write the extraction tests**

Add to `backend/tests/core/test_loop.py`, using the existing stub-provider pattern in that file:

```python
@pytest.mark.asyncio
async def test_extraction_carries_resolved_terms_through_to_claims():
    """A stubbed provider returning terms must land them on the Claim."""
    # Use the stub provider already defined in this file; return a payload with
    # terms=[{term, resolved, search_phrasing}] and assert case.claims[0].terms[0].resolved


@pytest.mark.asyncio
async def test_sibling_mechanisms_share_a_mechanism_of_label():
    # Stub a payload with three claims sharing mechanism_of="irctc-booking-bot"
    # and assert the grouping survives into the Case
```

Complete both bodies against the stub-provider harness already present in `test_loop.py`; do not build a new one.

- [ ] **Step 7: Run the backend suite and commit**

Run: `cd backend && pytest -v` — Expected: PASS.

```bash
git add backend/core/loop.py backend/evidence/search.py backend/tests/core/test_loop.py backend/tests/evidence/test_search.py
# suggested: feat(extraction): resolve domain terms and split bundled mechanisms
```

---

### Task 9: Build spec in synthesis

**Files:**
- Modify: `backend/core/synthesis.py`
- Test: `backend/tests/core/test_synthesis.py`

**Interfaces:**
- Consumes: `BuildSpec`, `CaseVerdict.build_spec` from Task 1; `Claim.mechanism_of` from Task 8; `surviving_core` from Task 6.
- Produces: `build_spec_material(case: Case) -> dict` — the constrained input handed to the synthesis prompt.

**Context:** The losing memo's "what to change" was a bullet. The competing answer's was a buildable artifact with a demo path. This is the largest single value gap and it costs zero extra calls, because synthesis already runs.

**The constraint matters more than the prompt.** An open "what would you build instead" question is exactly how the Akamai invention happened. The prompt gets the surviving mechanisms and the isolated fatal flaws as its material and is told to assemble from them.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/core/test_synthesis.py`:

```python
from core.models import Case, Claim, ClaimStatus
from core.synthesis import build_spec_material


def test_material_carries_surviving_mechanisms_and_fatal_flaws():
    case = Case(
        id="case1",
        raw_input="A bot that races the quota opening, solves the CAPTCHA, and guarantees a seat",
        claims=[
            Claim(id="c1", statement="Fires at the exact second the quota opens",
                  status=ClaimStatus.SURVIVED, load_bearing=True, mechanism_of="booking-bot"),
            Claim(id="c2", statement="Solves the CAPTCHA automatically",
                  status=ClaimStatus.BROKEN, load_bearing=True, mechanism_of="booking-bot",
                  fatal_flaw="Defeats an anti-bot control the operator explicitly prohibits."),
        ],
    )
    material = build_spec_material(case)
    assert "Fires at the exact second" in str(material["surviving"])
    assert "Defeats an anti-bot control" in str(material["fatal_flaws"])
    assert "Solves the CAPTCHA" in str(material["omitted"])


def test_material_is_empty_when_nothing_survived():
    case = Case(
        id="case2",
        raw_input="x",
        claims=[Claim(id="c1", statement="s", status=ClaimStatus.BROKEN, load_bearing=True)],
    )
    material = build_spec_material(case)
    assert material["surviving"] == []


def test_material_excludes_unresolved_claims_from_surviving():
    case = Case(
        id="case3",
        raw_input="x",
        claims=[Claim(id="c1", statement="unknown", status=ClaimStatus.UNRESOLVED, load_bearing=True)],
    )
    assert build_spec_material(case)["surviving"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/core/test_synthesis.py -v -k build_spec_material`
Expected: FAIL with `ImportError: cannot import name 'build_spec_material'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/core/synthesis.py`:

```python
def build_spec_material(case: Case) -> dict:
    """The only material the build-spec prompt is allowed to work from.

    Handing the model an open "what would you build instead" is how a memo ends up
    naming a CDN vendor nobody sourced. It assembles from what the panel actually
    established: what survived, what died, and why.
    """
    surviving = [
        {"claim_id": c.id, "statement": c.statement, "mechanism_of": c.mechanism_of}
        for c in case.claims
        if c.status is ClaimStatus.SURVIVED
        or (c.status is ClaimStatus.WEAKENED and (c.salvaged_claim or "").strip())
    ]
    omitted = [
        {"claim_id": c.id, "statement": c.statement, "why": c.fatal_flaw or ""}
        for c in case.claims
        if c.status is ClaimStatus.BROKEN
    ]
    fatal_flaws = [c.fatal_flaw for c in case.claims if (c.fatal_flaw or "").strip()]
    salvages = [c.salvaged_claim for c in case.claims if (c.salvaged_claim or "").strip()]
    return {
        "surviving": surviving,
        "omitted": omitted,
        "fatal_flaws": fatal_flaws,
        "salvages": salvages,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/core/test_synthesis.py -v -k build_spec_material`
Expected: PASS.

- [ ] **Step 5: Extend the synthesis prompt**

Add `build_spec` to the structured output the synthesis call already requests, passing `build_spec_material(case)` as its input, with:

```
BUILD SPEC — assemble, do not invent.
You are given what survived, what died, and why. Produce the version worth
building from exactly that material:
- what_it_does: the salvaged product, concretely enough that someone could start.
- what_it_omits: name the removed mechanism and say why it was removed.
- demo_path: how to show this working WITHOUT the removed mechanism.
- cheapest_experiment: the smallest real-world test that would settle whether the
  surviving mechanism is worth anything.
Do not introduce a vendor, a statute, a number, or a competitor that is not in the
material you were given. If nothing survived, return null rather than inventing a
consolation product.
```

- [ ] **Step 6: Test the null case**

Add a test asserting `build_spec` is `None` when `decision_state == "drop"` and `build_spec_material(case)["surviving"]` is empty — the tool must be able to say "nothing here" rather than manufacture a pivot.

- [ ] **Step 7: Run the backend suite and commit**

Run: `cd backend && pytest -v` — Expected: PASS.

```bash
git add backend/core/synthesis.py backend/tests/core/test_synthesis.py
# suggested: feat(synthesis): assemble a buildable spec from surviving mechanisms
```

---

### Task 10: Memo restructure

**Files:**
- Modify: `frontend/src/lib/exportMemo.ts`
- Test: `frontend/src/tests/exportMemo.test.ts`

**Interfaces:**
- Consumes: every field from Task 1, plus `surviving_core` (Task 6) and `build_spec` (Task 9).
- Produces: `formatDecisionMemoMarkdown(currentCase: Case) -> string`, same signature, new section order.

**Presentation constraints — these are not optional.** The memo keeps its existing markdown vocabulary exactly: the `# EXECUTIVE DECISION MEMO` meta header with Date / Subject / Context, `##` numbered top-level sections separated by `---` rules, `>` blockquotes for the verdict and callouts, `###` subsections with bold inline labels, claim anchors in the established `_(claim 1, 3)_` form, bullet lists for the scoreboard, and the generated-by footer. This task changes **which blocks appear and in what order**, for legibility. It is not a redesign and introduces no new formatting devices.

**New section order:**

1. Verdict — headline, `surviving_core`, summary, deciding factor, next actions
2. What the idea actually is — mechanisms grouped by `mechanism_of`, resolved terms
3. What survives, what dies — one table across all claims
4. The load-bearing kills — full depth, only for claims that moved the verdict
5. The version I'd build — `build_spec`
6. Cheapest next experiment — `build_spec.cheapest_experiment`
7. Sources — each tagged verified / unreachable

Claims that did not move the verdict appear as rows in section 3 and get no block of their own. That is where the padding was.

**Boilerplate removal:** `exportMemo.ts:132-137` emits one of two fixed "Strategic Importance" strings keyed on `load_bearing`, which is why that line read identically under every claim. Replace it with `claim.load_bearing_reason`, which already exists on the model and is already generated per claim. When it is empty, omit the subsection entirely rather than substituting filler.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/tests/exportMemo.test.ts`, following the fixture style already in that file:

```typescript
describe("memo restructure", () => {
  it("leads the verdict with the surviving core", () => {
    const md = formatDecisionMemoMarkdown(caseWithSurvivingCore);
    const verdictIdx = md.indexOf("## 1.");
    const coreIdx = md.indexOf("The prepare-and-race mechanism survives");
    expect(coreIdx).toBeGreaterThan(verdictIdx);
    expect(md.indexOf("## 2.")).toBeGreaterThan(coreIdx);
  });

  it("groups sibling mechanisms under their parent idea", () => {
    const md = formatDecisionMemoMarkdown(caseWithMechanisms);
    expect(md).toContain("Solves the CAPTCHA automatically");
    expect(md).toContain("Fires at the exact second");
  });

  it("renders resolved terms so the reader sees what the jargon meant", () => {
    const md = formatDecisionMemoMarkdown(caseWithTerms);
    expect(md).toContain("holiday quotas");
    expect(md).toContain("Tatkal");
  });

  it("gives a full block only to claims that moved the verdict", () => {
    const md = formatDecisionMemoMarkdown(caseWithOneDecidingClaim);
    const fullBlocks = md.match(/^#### /gm) ?? [];
    expect(fullBlocks.length).toBe(1);
  });

  it("uses the generated load_bearing_reason instead of boilerplate", () => {
    const md = formatDecisionMemoMarkdown(caseWithLoadBearingReason);
    expect(md).not.toContain("the core economic or distribution model of the proposal fails");
    expect(md).toContain("Without the timing race there is no product");
  });

  it("omits the importance line entirely when there is no reason", () => {
    const md = formatDecisionMemoMarkdown(caseWithoutLoadBearingReason);
    expect(md).not.toContain("Strategic Importance");
  });

  it("tags each source with its verification status", () => {
    const md = formatDecisionMemoMarkdown(caseWithMixedVerification);
    expect(md).toContain("verified");
    expect(md).toContain("unreachable");
  });

  it("renders the build spec with its omission named", () => {
    const md = formatDecisionMemoMarkdown(caseWithBuildSpec);
    expect(md).toContain("Prepares the booking up to the CAPTCHA");
    expect(md).toContain("Automated CAPTCHA solving");
  });

  it("omits the build spec section when there is no build spec", () => {
    const md = formatDecisionMemoMarkdown(caseWithoutBuildSpec);
    expect(md).not.toContain("The version I");
  });

  it("keeps the established meta header and section rules", () => {
    const md = formatDecisionMemoMarkdown(caseWithSurvivingCore);
    expect(md.startsWith("# EXECUTIVE DECISION MEMO")).toBe(true);
    expect(md).toContain("**Date:**");
    expect(md).toContain("**Subject:**");
    expect(md).toContain("\n---\n");
    expect(md).toContain("*Generated via Crossfire");
  });
});
```

Build each fixture from the `Case` shape already used by the existing tests in this file. Do not introduce a new fixture factory.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/tests/exportMemo.test.ts`
Expected: FAIL on the new cases; existing cases still pass.

- [ ] **Step 3: Rewrite the memo builder**

Restructure `formatDecisionMemoMarkdown` to the seven-section order above. Keep every existing helper and every existing formatting device. Specific changes:

- Move `surviving_core` into section 1, directly under the headline blockquote.
- Add section 2, grouping claims by `mechanism_of` (claims with no label form their own group), and listing `terms` as `- **term** — resolved` bullets.
- Add section 3 as a markdown table: claim, status, one-line reason.
- Section 4 iterates only claims that are load-bearing AND not `survived`, using `####` for each claim block so section 3 rows and section 4 blocks are distinguishable.
- Replace the hardcoded importance strings with `claim.load_bearing_reason`, omitting the subsection when empty.
- Tag each source line with its `verification` value, defaulting to `unchecked` when the field is absent so old cases still render.
- Add sections 5 and 6 from `build_spec`, omitting both when it is null.
- Collect all evidence into a single section 7 sources list, deduped by URL.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/tests/exportMemo.test.ts`
Expected: PASS. If a pre-existing assertion about section numbering now fails, that is the intended specification change — update the assertion to the new order. Do not delete it.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npm run test:all`
Expected: PASS with zero failures and a clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/exportMemo.ts frontend/src/tests/exportMemo.test.ts
# suggested: feat(memo): restructure around the verdict and the buildable version
```

---

### Task 11: Verdict and claim screens

**Files:**
- Modify: `frontend/src/components/features/VerdictBlock.tsx`
- Modify: `frontend/src/components/features/ClaimCard.tsx`
- Modify: `frontend/src/components/features/EvidenceDrawer.tsx`
- Test: `frontend/src/tests/VerdictBlock.test.tsx`, `frontend/src/tests/ClaimCard.test.tsx`, `frontend/src/tests/EvidenceDrawer.test.tsx`

**Interfaces:**
- Consumes: `surviving_core`, `build_spec` (`CaseVerdict`), `mechanism_of`, `terms` (`Claim`), `verification` (`EvidenceItem`).
- Produces: no new exports.

**Presentation constraints:** Reuse `components/ui/badge.tsx` and `components/ui/card.tsx` with existing token classes from `globals.css`. No new hex values, no new spacing values, no new primitives. Verify at both mobile and desktop widths. The verification badge is a `badge` variant that already exists — pick the closest existing semantic variant rather than adding one.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/tests/VerdictBlock.test.tsx`:

```typescript
it("renders the surviving core under the headline", () => {
  render(<VerdictBlock verdict={{ ...baseVerdict, surviving_core: "The prepare-and-race mechanism survives." }} />);
  expect(screen.getByText(/prepare-and-race mechanism survives/i)).toBeInTheDocument();
});

it("does not render a surviving core block when it is empty", () => {
  render(<VerdictBlock verdict={{ ...baseVerdict, surviving_core: "" }} />);
  expect(screen.queryByTestId("surviving-core")).not.toBeInTheDocument();
});

it("renders the build spec with its omission and demo path", () => {
  render(<VerdictBlock verdict={{ ...baseVerdict, build_spec: sampleBuildSpec }} />);
  expect(screen.getByText(/Prepares the booking up to the CAPTCHA/i)).toBeInTheDocument();
  expect(screen.getByText(/Automated CAPTCHA solving/i)).toBeInTheDocument();
  expect(screen.getByText(/mock booking environment/i)).toBeInTheDocument();
});

it("omits the build spec block when there is none", () => {
  render(<VerdictBlock verdict={{ ...baseVerdict, build_spec: null }} />);
  expect(screen.queryByTestId("build-spec")).not.toBeInTheDocument();
});
```

Add to `frontend/src/tests/ClaimCard.test.tsx`:

```typescript
it("shows the parent mechanism label when the claim has one", () => {
  render(<ClaimCard claim={{ ...baseClaim, mechanism_of: "booking-bot" }} />);
  expect(screen.getByText(/booking-bot/i)).toBeInTheDocument();
});

it("renders resolved terms for the claim", () => {
  render(<ClaimCard claim={{ ...baseClaim, terms: [{ term: "holiday quotas", resolved: "Tatkal quota", search_phrasing: "q" }] }} />);
  expect(screen.getByText(/Tatkal quota/i)).toBeInTheDocument();
});

it("renders unchanged for a claim with neither field", () => {
  render(<ClaimCard claim={baseClaim} />);
  expect(screen.queryByTestId("mechanism-label")).not.toBeInTheDocument();
  expect(screen.queryByTestId("resolved-terms")).not.toBeInTheDocument();
});
```

Add to `frontend/src/tests/EvidenceDrawer.test.tsx`:

```typescript
it("badges a verified source", () => {
  render(<EvidenceDrawer evidence={[{ ...baseEvidence, verification: "snippet_matched", verified: true }]} />);
  expect(screen.getByText(/verified/i)).toBeInTheDocument();
});

it("badges an unreachable source without calling it fabricated", () => {
  render(<EvidenceDrawer evidence={[{ ...baseEvidence, verification: "unreachable" }]} />);
  expect(screen.getByText(/unreachable/i)).toBeInTheDocument();
  expect(screen.queryByText(/fabricated/i)).not.toBeInTheDocument();
});

it("renders an old case with no verification field", () => {
  const { verification, ...legacy } = baseEvidence as never;
  render(<EvidenceDrawer evidence={[legacy]} />);
  expect(screen.getByText(baseEvidence.title!)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/tests/VerdictBlock.test.tsx src/tests/ClaimCard.test.tsx src/tests/EvidenceDrawer.test.tsx`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement the components**

- `VerdictBlock`: render `surviving_core` in a `card` directly under the headline with `data-testid="surviving-core"`, omitted when empty. Render `build_spec` as a `card` with `data-testid="build-spec"` containing four labeled lines (what it does, what it omits, demo path, cheapest experiment), omitted when null.
- `ClaimCard`: render `mechanism_of` as a `badge` with `data-testid="mechanism-label"`; render `terms` as a compact definition list with `data-testid="resolved-terms"`. Both omitted when absent.
- `EvidenceDrawer`: render a `badge` per evidence item showing its `verification`, defaulting to `unchecked` when the field is missing so old cases render unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/tests/VerdictBlock.test.tsx src/tests/ClaimCard.test.tsx src/tests/EvidenceDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify responsive rendering**

Check the verdict and claim views at a mobile width (375px) and a desktop width (1440px). The new build-spec card must not force horizontal scroll on mobile, and the mechanism badge must not overflow its claim header. Fix with existing flex/grid token classes only.

- [ ] **Step 6: Run the full frontend suite**

Run: `cd frontend && npm run test:all`
Expected: PASS with zero failures and a clean typecheck.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/features/VerdictBlock.tsx frontend/src/components/features/ClaimCard.tsx frontend/src/components/features/EvidenceDrawer.tsx frontend/src/tests/VerdictBlock.test.tsx frontend/src/tests/ClaimCard.test.tsx frontend/src/tests/EvidenceDrawer.test.tsx
# suggested: feat(ui): surface surviving core, build spec, mechanisms and source verification
```

---

### Task 12: Calibration run

**Files:**
- Modify: `backend/config.py` (threshold defaults only, if the run says so)
- Modify: `docs/superpowers/specs/2026-09-08-crossfire-quality-design.md` (record the settled values)

**Interfaces:**
- Consumes: everything above.
- Produces: settled values for `VERIFY_SNIPPET_THRESHOLD` and `VERIFY_FETCH_TIMEOUT_SECONDS`.

**Context:** The corpus is run by the user, not by the agent. This task is a handoff, not an autonomous step. `verify_snippet_threshold` defaults to 0.7 as a guess; only a corpus run can say whether that rejects honest snippets or admits fabricated ones.

- [ ] **Step 1: Report the measurements needed**

Ask the user to run the corpus and report, across all evidence items: the count of each `verification` value, and any item marked `snippet_absent` whose source is in fact legitimate.

- [ ] **Step 2: Interpret**

- `unreachable` dominating means the gate is doing little — raise `verify_fetch_timeout_seconds` before touching the threshold, since most failures will be slow PDFs rather than absent snippets.
- Legitimate sources marked `snippet_absent` means the threshold is too high — lower it in steps of 0.05.
- Nothing ever marked `snippet_absent` across a full corpus means the threshold is too low to catch anything, or verification is not actually running. Check the stage event counts before lowering confidence in the feature.

- [ ] **Step 3: Record and commit**

Update the defaults in `backend/config.py`, record the settled values and the corpus date in section 5 of the spec.

```bash
git add backend/config.py docs/superpowers/specs/2026-09-08-crossfire-quality-design.md
# suggested: chore(evidence): settle citation verification thresholds against the corpus
```

---

## Sequencing

Tasks 1 through 12 are written in dependency order and can be executed straight through.

Two independent tracks exist if parallel execution is wanted:

- **Trust:** 1 → 2 → 3 → 4 → 5 → 6
- **Constructive:** 1 → 8 → 7 → 9

Both converge on 10 → 11 → 12. Task 1 gates everything; Task 10 consumes every field the others produce and must land last among the code tasks.
