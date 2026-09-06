"""
Owner: Dev A. Hour-by-hour build order in docs/02-dev-A-core-loop-providers.md.
RESEARCH FIRST before implementing classify_load_bearing (docs/dev-a/research/01-load-bearing.md)
and reconcile (docs/dev-a/research/02-reconcile.md) — decide there first, then implement here.
"""
from __future__ import annotations

from core.models import Case, Claim, ClaimStatus, DecisionConsequence, Finding, TestPlanItem
from providers.base import LLMProvider


async def extract_claims(raw_input: str, provider: LLMProvider) -> Case:
    raise NotImplementedError


async def classify_load_bearing(claim: Claim, case: Case, provider: LLMProvider) -> bool:
    raise NotImplementedError


def build_test_plan(case: Case) -> list[TestPlanItem]:
    raise NotImplementedError


async def reconcile(
    claim: Claim, findings: list[Finding], provider: LLMProvider
) -> tuple[ClaimStatus, str]:
    raise NotImplementedError


def build_consequences(case: Case) -> list[DecisionConsequence]:
    raise NotImplementedError


async def run_pipeline(case_id: str) -> None:
    raise NotImplementedError
