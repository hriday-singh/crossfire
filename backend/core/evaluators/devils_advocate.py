"""
Owner: Dev C. See docs/04-dev-C-api-sse-evaluators.md.
"""
from __future__ import annotations

from core.models import Case, Finding, TestPlanItem
from providers.base import LLMProvider


async def run_devils_advocate(item: TestPlanItem, case: Case, provider: LLMProvider) -> Finding:
    raise NotImplementedError
