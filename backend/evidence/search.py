"""
Owner: Dev B. Tavily wrapper — search_depth="basic", one query per claim,
tenacity-wrapped for transient failures. See docs/03-dev-B-evidence-receipts.md.
"""
from __future__ import annotations

from core.models import Claim, EvidenceItem


async def search_evidence(claim: Claim) -> list[EvidenceItem]:
    raise NotImplementedError
