"""
Owner: Dev A. Add once loop + evidence path are solid (hour 18+). Optional.
"""
from __future__ import annotations

from core.models import Case, Finding, TestPlanItem
from providers.base import LLMProvider


async def run_builder(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    raise NotImplementedError
