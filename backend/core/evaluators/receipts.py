"""
Owner: Dev B. See docs/03-dev-B-evidence-receipts.md. Owns the evidence pipeline.
"""
from __future__ import annotations

from core.models import Case, Finding, TestPlanItem
from providers.base import LLMProvider


async def run_receipts(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    raise NotImplementedError
