"""
Owner: Dev B. See docs/03-dev-B-evidence-receipts.md. Owns the evidence pipeline.

The only evaluator that can bring an outside source back, and therefore the only
one whose finding can break a claim (Stage 1a evidence gate in core/loop.py).
"""
from __future__ import annotations

import asyncio
import logging
import re

from pydantic import BaseModel, Field

from core.models import Case, Claim, EvidenceItem, Finding, TestPlanItem
from core.textutil import SPECIFICITY_RULE, clamp_sentences, one_line
from evidence.curate import curate_snippet, curate_snippet_llm
from evidence.fetch import fetch_page
from evidence.search import classify_source, search_evidence
from providers.base import LLMProvider

logger = logging.getLogger(__name__)

_STANCES = ("supports", "contradicts", "context")


class CitedSource(BaseModel):
    source_url: str = Field(description="The source URL exactly as given to you")
    stance: str = Field(description="One of: supports, contradicts, context")


class ReceiptsAssessment(BaseModel):
    result: str = Field(description="One line, under 140 characters: what the sources show")
    reasoning: str = Field(description="At most 3 sentences, citing what the sources actually say")
    confidence: float = Field(ge=0.0, le=1.0)
    contradiction: str | None = Field(
        default=None,
        description="What a source directly contradicts, quoted or paraphrased. Null unless a source really says it.",
    )
    cited: list[CitedSource] = Field(
        default_factory=list,
        description="Only the sources you actually used, each with how it bears on the claim.",
    )


RECEIPTS_SYSTEM_PROMPT = (
    "You are the Receipts evaluator in an adversarial decision review. You judge one "
    "claim against sources retrieved from the open web. The decision may be of any kind "
    "— never assume a domain.\n\n"
    "Rules:\n"
    "1. Judge only from the snippets provided. Never fill gaps from memory.\n"
    "2. Finding nothing is not refutation. With no relevant source, say so plainly and "
    "keep confidence at or below 0.35, and leave 'contradiction' null.\n"
    "3. Populate 'contradiction' ONLY when a specific source states something the claim "
    "cannot survive. Name what it says.\n"
    "4. Sources are labelled by class. A government, official or first-party source "
    "outweighs a blog or a forum post saying the opposite.\n"
    "5. In 'cited', list only the sources you actually relied on, each marked "
    "'supports', 'contradicts' or 'context'. Leave out the ones you ignored."
)


def _is_thin_snippet(snippet: str) -> bool:
    """Checks whether a search snippet is too thin to hang a verdict on."""
    s = snippet.strip()
    return len(s) < 150 or len(re.findall(r"(?<=[.!?])\s+", s)) < 2


def _apply_citations(items: list[EvidenceItem], cited: list[CitedSource]) -> list[EvidenceItem]:
    """Keeps the sources the evaluator actually used, stamped with their stance.

    Attaching all four hits regardless of whether anything referenced them is
    what made the drawer four undifferentiated links. If the model cited nothing,
    everything is kept as unstanced context rather than throwing evidence away.
    """
    by_url = {item.source_url: item for item in items}
    kept: list[EvidenceItem] = []
    for citation in cited or []:
        item = by_url.get(citation.source_url)
        if item is None or item in kept:
            continue
        stance = (citation.stance or "").strip().lower()
        item.stance = stance if stance in _STANCES else "context"
        kept.append(item)
    if kept:
        return kept
    for item in items:
        item.stance = "context"
    return items



async def run_receipts(
    item: TestPlanItem,
    case: Case,
    provider: LLMProvider,
    *,
    use_llm_curation: bool = False,
) -> Finding:
    """Executes the Receipts evaluation for one TestPlanItem.

    - Retrieves candidate evidence via search_evidence() (keyword query, source-ranked)
    - Adaptive Scrutiny: deep-fetches (fetch_page) only when the claim is
      load-bearing and the snippet is thin (< 150 chars / < 2 sentences)
    - Curates every snippet down to 1-3 sentences
    - Keeps only the sources the evaluator says it used, each with a stance
    - Degrades to a low-confidence finding on zero evidence, never a confident negative
    """
    claim = next((c for c in case.claims if c.id == item.target_claim), None)
    if claim is None:
        claim = Claim(id=item.target_claim, statement=item.objective)

    case_id = getattr(case, "id", None)
    if case_id:
        try:
            from config import get_settings
            from core.activity import emit_activity
            from evidence.search import build_query
            cfg = get_settings()
            has_serp = bool(getattr(cfg, "SERPAPI_API_KEY", "") or getattr(cfg, "serpapi_api_key", ""))
            provider_label = "SerpApi (Google)" if has_serp else "DuckDuckGo Lite"
            await emit_activity(
                case_id,
                tag="Evidence Test",
                text=f'Querying {provider_label}: "{build_query(claim.statement)}"',
                claim_id=claim.id,
                action="search",
            )
        except Exception:
            pass

    evidence_items = await search_evidence(claim)

    if case_id and evidence_items:
        try:
            import urllib.parse
            top_host = urllib.parse.urlparse(evidence_items[0].source_url).hostname or "external site"
            provider_tag = getattr(evidence_items[0], "provider", "web")
            if provider_tag == "serpapi":
                provider_display = "SerpApi"
            elif provider_tag == "duckduckgo":
                provider_display = "DuckDuckGo Lite"
            elif provider_tag == "fixture":
                provider_display = "Verified Fixture"
            else:
                provider_display = "Web Search"
            from core.activity import emit_activity
            await emit_activity(
                case_id,
                tag="Evidence Test",
                text=f"Found {len(evidence_items)} candidate sources via {provider_display} (top: {top_host})",
                claim_id=claim.id,
                action="results",
            )
        except Exception:
            pass

    # Adaptive Scrutiny: deep-fetch top 1-2 URLs only if load_bearing and snippet is thin
    if claim.load_bearing is True and evidence_items:
        for ev in evidence_items[:2]:
            if _is_thin_snippet(ev.snippet):
                try:
                    import urllib.parse
                    domain = urllib.parse.urlparse(ev.source_url).hostname or ev.source_url
                    from core.activity import emit_activity
                    await emit_activity(
                        case_id,
                        tag="Evidence Test",
                        text=f"Deep-fetching {domain} to inspect policy text...",
                        claim_id=claim.id,
                        action="fetch",
                    )
                except Exception:
                    pass
                full_text = await fetch_page(ev.source_url)
                if full_text:
                    ev.snippet = full_text

    async def _curate_single(ev: EvidenceItem) -> EvidenceItem | None:
        if use_llm_curation:
            curated = await curate_snippet_llm(ev.snippet, claim.statement, provider=provider)
        else:
            curated = curate_snippet(ev.snippet, claim.statement)
        if not curated:
            return None
        return EvidenceItem(
            source_url=ev.source_url,
            title=ev.title,
            snippet=curated,
            retrieved_at=ev.retrieved_at,
            # Demo fixtures and any non-search source arrive unclassed; the judge
            # weighs by class, so classify here rather than trusting the caller.
            source_class=(
                ev.source_class
                if ev.source_class != "unranked"
                else classify_source(ev.source_url)
            ),
        )

    curated_results = await asyncio.gather(*(_curate_single(ev) for ev in evidence_items))
    curated_items: list[EvidenceItem] = [ev for ev in curated_results if ev is not None]

    if case_id and curated_items:
        try:
            from core.activity import emit_activity
            await emit_activity(
                case_id,
                tag="Evidence Test",
                text=f"Analyzing {len(curated_items)} source{'s' if len(curated_items) != 1 else ''} against claim...",
                claim_id=claim.id,
                action="evaluating",
            )
        except Exception:
            pass

    if curated_items:
        evidence_str = "\n\n".join(
            f"Source: {ev.source_url}\nClass: {ev.source_class}\n"
            f"Title: {ev.title or 'N/A'}\nSnippet: {ev.snippet}"
            for ev in curated_items
        )
    else:
        evidence_str = "No external evidence found or search returned empty results."

    response = await provider.generate(
        system_prompt=f"{RECEIPTS_SYSTEM_PROMPT}\n\n{SPECIFICITY_RULE}",
        messages=[
            {
                "role": "user",
                "content": (
                    f"Claim: {claim.statement}\n"
                    f"Objective: {item.objective}\n\n"
                    f"Retrieved sources:\n{evidence_str}"
                ),
            }
        ],
        response_schema=ReceiptsAssessment,
    )

    if isinstance(response, Finding):
        # Already a Finding (canned test fixture) — keep it, but hold the invariant.
        evidence = curated_items or response.evidence
        return Finding(
            claim_id=claim.id,
            test_id=item.id,
            evaluator="receipts",
            result=one_line(response.result),
            evidence=evidence,
            reasoning=clamp_sentences(response.reasoning),
            confidence=response.confidence if evidence else min(response.confidence, 0.35),
            contradiction=response.contradiction if evidence else None,
        )

    if isinstance(response, ReceiptsAssessment):
        evidence = _apply_citations(curated_items, response.cited)
        has_valid_citations = bool(
            response.cited and any(c.source_url in {e.source_url for e in evidence} for c in response.cited)
        )
        # Without a source, a negative is an absence of evidence, not a refutation.
        return Finding(
            claim_id=claim.id,
            test_id=item.id,
            evaluator="receipts",
            result=one_line(response.result),
            evidence=evidence,
            reasoning=clamp_sentences(response.reasoning),
            confidence=response.confidence if evidence else min(response.confidence, 0.35),
            contradiction=response.contradiction if (evidence and has_valid_citations) else None,
        )

    return Finding(
        claim_id=claim.id,
        test_id=item.id,
        evaluator="receipts",
        result="Evidence evaluation completed",
        evidence=curated_items,
        reasoning=clamp_sentences(str(response)),
        confidence=0.5 if curated_items else 0.2,
        contradiction=None,
    )
