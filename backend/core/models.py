"""
Owner: Dev A. FROZEN at hour 2 per docs/00-CONTRACTS.md #1.
Everyone imports from here. Don't change field names/types after freeze
without a live sync — Dev B and Dev C both import these directly.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class ClaimStatus(str, Enum):
    SURVIVED = "survived"
    WEAKENED = "weakened"
    BROKEN = "broken"
    UNRESOLVED = "unresolved"


class Claim(BaseModel):
    id: str
    statement: str
    load_bearing: bool | None = None       # set after the load-bearing question runs
    status: ClaimStatus | None = None


class TestPlanItem(BaseModel):
    id: str
    target_claim: str                       # Claim.id
    failure_mode: str                       # what kind of failure this test is built to catch
    objective: str


class EvidenceItem(BaseModel):
    source_url: str
    title: str | None = None
    snippet: str                            # curated, not the full page
    retrieved_at: str


class Finding(BaseModel):
    claim_id: str
    test_id: str
    evaluator: str                          # "devils_advocate" | "receipts" | "builder" | "overthinker"
    result: str
    evidence: list[EvidenceItem] = []
    reasoning: str
    confidence: float
    contradiction: str | None = None


class DecisionConsequence(BaseModel):
    claim_id: str
    impact: str                             # high | medium | low, or a short phrase
    recommended_change: str
    next_validation: str | None = None      # required when status is broken/unresolved and load-bearing
    verdict_reasoning: str = ""             # why Judge reconciled to this status — persisted here,
                                             # not just riding along on the SSE event


class Case(BaseModel):
    id: str
    raw_input: str
    context: str | None = None              # from an ingested doc/URL, once that path exists
    claims: list[Claim] = []
    test_plan: list[TestPlanItem] = []
    findings: list[Finding] = []
    consequences: list[DecisionConsequence] = []
    status: str = "extracting"              # extracting | awaiting_confirmation | testing | done | error
