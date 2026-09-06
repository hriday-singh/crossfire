"""
Owner: Dev B. Evidence pipeline & Researcher evaluator (formerly Receipts).
See docs/03-dev-B-evidence-receipts.md.

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
from evidence.search import (
    build_competitor_query,
    build_query,
    classify_source,
    search_evidence,
    source_class_to_tier,
)
from providers.base import LLMProvider

logger = logging.getLogger(__name__)

_STANCES = ("supports", "contradicts", "context")

_UNIQUENESS_PATTERN = re.compile(
    r"\b(unique|only|first|cheaper than|unmatched|sole|exclusive|proprietary|superior to|nobody else|no other)\b",
    re.IGNORECASE,
)


def _is_uniqueness_claim(statement: str) -> bool:
    """Detects if a claim asserts uniqueness or competitive superiority."""
    return bool(_UNIQUENESS_PATTERN.search(statement or ""))


class CitedSource(BaseModel):
    source_url: str = Field(description="The source URL exactly as given to you")
    stance: str = Field(description="One of: supports, contradicts, context")
    tier: int | None = Field(
        default=None,
        description="Authority tier: 1 (primary/gov/official), 2 (neutral reporting/forums), 3 (marketing copy/landing pages)",
    )


class ResearcherAssessment(BaseModel):
    result: str = Field(
        description="One line, under 140 characters: what the sources show. Downgrade to 'weakened' if core evidence is >18-24 months old."
    )
    reasoning: str = Field(
        description="At most 3 sentences, citing what the sources actually say. If only Tier 3 sources exist, explicitly flag 'Marketing Mirage'."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0. Capped at <= 0.5 for Marketing Mirage (only Tier 3), and <= 0.35 if zero evidence.",
    )
    contradiction: str | None = Field(
        default=None,
        description="What a source directly contradicts, or note 'Data Staleness' if core evidence is >18-24 months old. Null unless a source really says it.",
    )
    cited: list[CitedSource] = Field(
        default_factory=list,
        description="Only the sources you actually used, each with how it bears on the claim.",
    )


# Backward compatibility alias
ReceiptsAssessment = ResearcherAssessment


RESEARCHER_SYSTEM_PROMPT = (
    "You are the Researcher evaluator in an adversarial decision review (formerly Receipts). You judge one "
    "claim against sources retrieved from the open web. The decision may be of any kind "
    "— never assume a domain.\n\n"
    "You must strictly adhere to these four analytical search and synthesis constraints:\n"
    "1. Adversarial Query Generation (The 'Debunk' Search): Actively seek disconfirming evidence to counter "
    "LLM confirmation bias. When assessing evidence or formulating search probes, never search for naive validation "
    "(e.g., 'Product X conversion rate'). Actively probe for complaints, churn, bugs, failure modes, and customer "
    "dissatisfaction (e.g., 'Product X high churn reddit', 'Product X alternative better'). Prioritize critical "
    "counter-evidence over SEO-optimized marketing copy.\n"
    "2. Source Authority Tiering (The 'Mirage' Flag): Enforce a strict domain authority tiering system for all evidence:\n"
    "   - Tier 1: Primary documentation, regulatory/SEC filings, official API docs, government registers, statutory laws.\n"
    "   - Tier 2: Neutral third-party reporting, technical benchmarks, independent journalism, neutral community forums (Reddit, StackOverflow).\n"
    "   - Tier 3: Company landing pages, vendor self-reported claims, sponsored blog posts, SEO marketing copy.\n"
    "   RULE: If only Tier 3 evidence is found to support a claim, you MUST explicitly flag this as a 'Marketing Mirage' "
    "in your reasoning and cap your confidence score at <= 0.5.\n"
    "3. Temporal Decay (Data Freshness Enforcement): Factor in the publication date or freshness of web snippets. "
    "Estimate or extract the publication year/date of the evidence. RULE: If the core evidence supporting a claim is more "
    "than 18-24 months old, you must automatically downgrade the verdict to 'weakened' and explicitly note "
    "'Data Staleness' in the contradiction field.\n"
    "4. Competitor Triangulation: When evaluating claims of uniqueness, sole advantage, superior pricing, or novel "
    "capabilities, never look only at the subject's own domain or claims. Cross-examine the claim against the closest "
    "known market leader or competitor to verify whether the capability is already offered or disproven.\n\n"
    "Core Invariants:\n"
    "1. Judge only from the snippets provided. Never fill gaps from memory.\n"
    "2. Finding nothing is not refutation. With no relevant source, say so plainly and keep confidence at or below 0.35, "
    "and leave 'contradiction' null.\n"
    "3. Populate 'contradiction' ONLY when a specific source states something the claim cannot survive, or when noting 'Data Staleness'.\n"
    "4. A Tier 1 primary/official source outweighs a Tier 2 forum or Tier 3 blog post saying the opposite.\n"
    "5. In 'cited', list only the sources you actually relied on, each marked 'supports', 'contradicts' or 'context'. Leave out the ones you ignored."
)

# Backward compatibility alias
RECEIPTS_SYSTEM_PROMPT = RESEARCHER_SYSTEM_PROMPT



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



async def run_researcher(
    item: TestPlanItem,
    case: Case,
    provider: LLMProvider,
    *,
    use_llm_curation: bool = False,
) -> Finding:
    """Executes the Researcher evaluation for one TestPlanItem.

    - Retrieves candidate evidence via search_evidence() (keyword query, source-ranked)
    - Competitor Triangulation: performs a secondary search for competitor alternatives
      when a claim asserts uniqueness or competitive advantages
    - Adaptive Scrutiny: deep-fetches (fetch_page) only when the claim is
      load-bearing and the snippet is thin (< 150 chars / < 2 sentences)
    - Curates every snippet down to 1-3 sentences
    - Formats evidence with Source Authority Tiers (Tier 1: primary, Tier 2: neutral, Tier 3: marketing)
    - Invariant guards:
      - Zero evidence -> confidence <= 0.35, contradiction = None
      - Source Authority Tiering (Marketing Mirage) -> if only Tier 3 sources present,
        cap confidence at <= 0.5 and flag 'Marketing Mirage' in reasoning
      - Temporal Decay -> if core evidence is >18-24 months old, downgrade result to 'weakened'
        and note 'Data Staleness' in contradiction
    """
    claim = next((c for c in case.claims if c.id == item.target_claim), None)
    if claim is None:
        claim = Claim(id=item.target_claim, statement=item.objective)

    case_id = getattr(case, "id", None)
    if case_id:
        try:
            from core.activity import emit_activity
            from evidence.search import build_query
            await emit_activity(
                case_id,
                tag="Evidence Test",
                text=f'Querying DuckDuckGo: "{build_query(claim.statement)}"',
                claim_id=claim.id,
                action="search",
            )
        except Exception:
            pass

    evidence_items = await search_evidence(claim)

    # Competitor Triangulation: if the claim asserts uniqueness or competitive superiority,
    # perform a secondary search targeting market leaders or alternatives.
    if _is_uniqueness_claim(claim.statement):
        comp_query = build_competitor_query(claim.statement)
        if case_id:
            try:
                from core.activity import emit_activity
                await emit_activity(
                    case_id,
                    tag="Evidence Test",
                    text=f'Competitor Triangulation: Searching alternatives "{comp_query}"',
                    claim_id=claim.id,
                    action="search",
                )
            except Exception:
                pass
        try:
            comp_items = await search_evidence(claim, query_override=comp_query)
            existing_urls = {ev.source_url for ev in evidence_items}
            for item_ev in comp_items:
                if item_ev.source_url not in existing_urls:
                    evidence_items.append(item_ev)
                    existing_urls.add(item_ev.source_url)
        except Exception as exc:
            logger.warning(f"Competitor triangulation search failed: {exc}")

    if case_id and evidence_items:
        try:
            import urllib.parse
            top_host = urllib.parse.urlparse(evidence_items[0].source_url).hostname or "external site"
            from core.activity import emit_activity
            await emit_activity(
                case_id,
                tag="Evidence Test",
                text=f"Found {len(evidence_items)} candidate sources (top: {top_host})",
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
                try:
                    full_text = await fetch_page(ev.source_url)
                    if full_text:
                        ev.snippet = full_text
                except Exception as exc:
                    logger.debug(f"Deep fetch skipped or failed for {ev.source_url}: {exc}")



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
            f"Source: {ev.source_url}\nClass: {ev.source_class} (Tier {source_class_to_tier(ev.source_class, ev.source_url)})\n"
            f"Title: {ev.title or 'N/A'}\nSnippet: {ev.snippet}"
            for ev in curated_items
        )
    else:
        evidence_str = "No external evidence found or search returned empty results."

    response = await provider.generate(
        system_prompt=f"{RESEARCHER_SYSTEM_PROMPT}\n\n{SPECIFICITY_RULE}",
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
        response_schema=ResearcherAssessment,
    )

    if isinstance(response, Finding):
        # Already a Finding (canned test fixture) — keep it, but hold invariants.
        evidence = curated_items or response.evidence
        res_text = response.result
        reas_text = response.reasoning
        conf = response.confidence if evidence else min(response.confidence, 0.35)
        contra = response.contradiction if evidence else None

        if evidence:
            all_tier_3 = all(source_class_to_tier(e.source_class, e.source_url) == 3 for e in evidence)
            if all_tier_3 or "marketing mirage" in reas_text.lower():
                conf = min(conf, 0.5)
                if "marketing mirage" not in reas_text.lower():
                    reas_text = f"Marketing Mirage: {reas_text}"

        if contra and "data staleness" in contra.lower():
            if "weakened" not in res_text.lower():
                res_text = f"Weakened: {res_text}"

        return Finding(
            claim_id=claim.id,
            test_id=item.id,
            evaluator="researcher",
            result=one_line(res_text),
            evidence=evidence,
            reasoning=clamp_sentences(reas_text),
            confidence=conf,
            contradiction=contra,
        )

    if isinstance(response, ResearcherAssessment):
        evidence = _apply_citations(curated_items, response.cited)
        has_valid_citations = bool(
            response.cited and any(c.source_url in {e.source_url for e in evidence} for c in response.cited)
        )
        res_text = response.result
        reas_text = response.reasoning
        conf = response.confidence if evidence else min(response.confidence, 0.35)
        contra = response.contradiction if (evidence and has_valid_citations) else None

        # Source Authority Tiering: If only Tier 3 sources are found/cited, enforce Marketing Mirage
        if evidence:
            all_tier_3 = all(source_class_to_tier(e.source_class, e.source_url) == 3 for e in evidence)
            if all_tier_3 or "marketing mirage" in reas_text.lower():
                conf = min(conf, 0.5)
                if "marketing mirage" not in reas_text.lower():
                    reas_text = f"Marketing Mirage: {reas_text}"

        # Temporal Decay: If core evidence is >18-24 months old, downgrade to 'weakened' and note 'Data Staleness'
        if contra and "data staleness" in contra.lower():
            if "weakened" not in res_text.lower():
                res_text = f"Weakened: {res_text}"
        elif "data staleness" in reas_text.lower() and evidence:
            if not contra:
                contra = "Data Staleness: Core evidence is outdated (>18-24 months)."
            if "weakened" not in res_text.lower():
                res_text = f"Weakened: {res_text}"

        return Finding(
            claim_id=claim.id,
            test_id=item.id,
            evaluator="researcher",
            result=one_line(res_text),
            evidence=evidence,
            reasoning=clamp_sentences(reas_text),
            confidence=conf,
            contradiction=contra,
        )

    return Finding(
        claim_id=claim.id,
        test_id=item.id,
        evaluator="researcher",
        result="Evidence evaluation completed",
        evidence=curated_items,
        reasoning=clamp_sentences(str(response)),
        confidence=0.5 if curated_items else 0.2,
        contradiction=None,
    )


# Backward compatibility alias
run_receipts = run_researcher

