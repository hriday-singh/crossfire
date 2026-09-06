"""
Owner: Dev B. See docs/03-dev-B-evidence-receipts.md. Owns the evidence pipeline.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from pydantic import BaseModel

from core.models import Case, Claim, EvidenceItem, Finding, TestPlanItem
from evidence.curate import curate_snippet
from evidence.fetch import fetch_page
from evidence.search import search_evidence
from providers.base import LLMProvider

logger = logging.getLogger(__name__)


class ReceiptsAssessment(BaseModel):
    result: str
    reasoning: str
    confidence: float
    contradiction: str | None = None


def _is_thin_snippet(snippet: str) -> bool:
    """Checks whether a search snippet is too thin to hang a verdict on."""
    s = snippet.strip()
    return len(s) < 150 or len(re.findall(r"(?<=[.!?])\s+", s)) < 2


async def run_receipts(
    first: TestPlanItem | Claim,
    second: Case | TestPlanItem,
    provider: LLMProvider,
) -> Finding:
    """Executes the Receipts evaluation for a given claim and test plan item.

    - Resolves claim and test plan item from flexible parameter order
    - Retrieves candidate evidence via search_evidence()
    - Adaptive Scrutiny: triggers Scrapling deep-fetch (fetch_page) only when
      claim.load_bearing is True and the snippet is thin (< 150 chars / < 2 sentences)
    - Curates snippets using curate_snippet() (1-3 sentences max)
    - Evaluates evidence strictly via LLMProvider (never touches google-genai directly)
    - Degrades gracefully on zero evidence (produces a low-confidence Finding)
    """
    # 1. Resolve arguments
    if isinstance(first, Claim) and isinstance(second, TestPlanItem):
        claim = first
        item = second
    elif isinstance(first, TestPlanItem) and isinstance(second, Case):
        item = first
        case = second
        found = next((c for c in case.claims if c.id == item.target_claim), None)
        claim = found if found is not None else Claim(id=item.target_claim, statement=item.objective)
    elif isinstance(first, TestPlanItem) and isinstance(second, Claim):
        item = first
        claim = second
    else:
        # Generic fallback
        claim = getattr(first, "statement", None) and first  # type: ignore
        item = second  # type: ignore
        if not isinstance(claim, Claim):
            claim = Claim(id=getattr(item, "target_claim", "claim-unknown"), statement=getattr(item, "objective", ""))

    # 2. Search evidence (Tavily)
    evidence_items = await search_evidence(claim)

    # 3. Adaptive Scrutiny: deep-fetch top 1-2 URLs only if load_bearing and snippet is thin
    if claim.load_bearing is True and evidence_items:
        for ev in evidence_items[:2]:
            if _is_thin_snippet(ev.snippet):
                full_text = await fetch_page(ev.source_url)
                if full_text:
                    ev.snippet = full_text

    # 4. Curate all snippets (enforcing 1-3 sentences max)
    curated_items: list[EvidenceItem] = []
    for ev in evidence_items:
        curated = curate_snippet(ev.snippet, claim.statement)
        if curated:
            curated_items.append(
                EvidenceItem(
                    source_url=ev.source_url,
                    title=ev.title,
                    snippet=curated,
                    retrieved_at=ev.retrieved_at,
                )
            )

    # 5. Build prompt for Receipts evaluator
    system_prompt = (
        "You are the 'Receipts' evaluator in the Crossfire verification pipeline. "
        "Your task is to objectively evaluate whether real-world evidence supports or refutes "
        "the given claim.\n\n"
        "Rules:\n"
        "1. Base your evaluation strictly on the provided evidence snippets.\n"
        "2. If no evidence is provided or evidence is inconclusive, state this clearly in reasoning "
        "and keep confidence low (<= 0.35).\n"
        "3. If evidence directly supports the claim, state how and assign confidence (0.6 - 0.95).\n"
        "4. If evidence contradicts the claim, explain the contradiction and populate the contradiction field.\n"
        "5. A negative finding with no evidence is never a confident negative."
    )

    if curated_items:
        evidence_str = "\n\n".join(
            f"Source: {ev.source_url}\nTitle: {ev.title or 'N/A'}\nSnippet: {ev.snippet}"
            for ev in curated_items
        )
    else:
        evidence_str = "No external evidence found or search returned empty results."

    messages = [
        {
            "role": "user",
            "content": (
                f"Claim ID: {claim.id}\n"
                f"Claim Statement: {claim.statement}\n"
                f"Test Plan Objective: {item.objective}\n\n"
                f"Curated Evidence:\n{evidence_str}"
            ),
        }
    ]

    # 6. Call LLMProvider
    response = await provider.generate(
        system_prompt=system_prompt,
        messages=messages,
        response_schema=ReceiptsAssessment,
    )

    # 7. Normalize result to Finding
    if isinstance(response, Finding):
        # Already a Finding instance (e.g. from canned test fixture)
        return Finding(
            claim_id=claim.id,
            test_id=item.id,
            evaluator="receipts",
            result=response.result,
            evidence=curated_items or response.evidence,
            reasoning=response.reasoning,
            confidence=response.confidence if (curated_items or response.evidence) else min(response.confidence, 0.35),
            contradiction=response.contradiction,
        )

    if isinstance(response, ReceiptsAssessment):
        confidence = response.confidence
        if not curated_items:
            # Bound confidence if zero evidence
            confidence = min(confidence, 0.35)
        return Finding(
            claim_id=claim.id,
            test_id=item.id,
            evaluator="receipts",
            result=response.result,
            evidence=curated_items,
            reasoning=response.reasoning,
            confidence=confidence,
            contradiction=response.contradiction,
        )

    # Fallback for plain string / unexpected response
    res_str = str(response)
    confidence = 0.5 if curated_items else 0.2
    return Finding(
        claim_id=claim.id,
        test_id=item.id,
        evaluator="receipts",
        result="Evidence evaluation completed",
        evidence=curated_items,
        reasoning=res_str,
        confidence=confidence,
        contradiction=None,
    )

