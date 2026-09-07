"""
Unit tests for iterative search loop and query reformulation.
"""
import pytest
from unittest.mock import AsyncMock, patch
from core.models import Case, Claim, EvidenceItem, TestPlanItem
from core.evaluators.receipts import run_researcher
from evidence.search import reformulate_query, build_query


class MockQueryProvider:
    def __init__(self, query_text="AcmeCorp messaging SLA broker limits"):
        self.query_text = query_text

    async def generate(self, system_prompt, messages, response_schema=None):
        schema_name = getattr(response_schema, "__name__", "")
        if schema_name == "ReformulatedQuery" or "query" in getattr(response_schema, "model_fields", {}):
            return response_schema(query=self.query_text)
        from core.evaluators.receipts import ResearcherAssessment
        return ResearcherAssessment(
            result="Empirical limits verified via documentation.",
            reasoning="The official docs state that limits apply as tested.",
            confidence=0.85,
            contradiction=None,
            cited=[]
        )


@pytest.mark.asyncio
async def test_reformulate_query_rule_based_fallback():
    statement = "We can offer unlimited instant zero-latency database sync across 10 global regions."
    previous = "unlimited instant zero-latency database sync 10 global"
    reformulated = await reformulate_query(statement, previous, provider=None)
    assert "unlimited" not in reformulated.lower()
    assert "instant" not in reformulated.lower()
    assert len(reformulated.split()) <= 6


@pytest.mark.asyncio
async def test_reformulate_query_llm_provider():
    statement = "AcmeCorp guarantees 99.999% SLA on their distributed messaging broker."
    previous = "AcmeCorp guarantees 99.999 SLA distributed messaging broker"
    provider = MockQueryProvider("AcmeCorp messaging SLA broker limits")
    reformulated = await reformulate_query(statement, previous, provider=provider)
    assert reformulated == "AcmeCorp messaging SLA broker limits"


@pytest.mark.asyncio
async def test_run_researcher_triggers_iterative_search_on_empty():
    claim = Claim(id="c-test", statement="Stripe offers unlimited instant chargebacks without documentation.")
    case = Case(id="case-test", raw_input="Test", claims=[claim])
    item = TestPlanItem(id="t-test", target_claim=claim.id, failure_mode="evidence", objective="Verify claim")

    refreshed_evidence = [
        EvidenceItem(
            source_url="https://stripe.com/docs/disputes",
            title="Stripe Dispute Policies",
            snippet="Chargebacks are subject to card network regulations and evidence requirements.",
            retrieved_at="2026-09-07T00:00:00Z"
        )
    ]

    call_count = 0
    async def mock_search(clm, query_override=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return []  # Initial search yields 0
        return refreshed_evidence  # Iterative search yields evidence!

    provider = MockQueryProvider("Stripe dispute documentation requirements")
    with patch("core.evaluators.receipts.search_evidence", side_effect=mock_search):
        finding = await run_researcher(item, case, provider)

    assert call_count == 2
    assert finding.confidence > 0.35
    assert len(finding.evidence) >= 1
    assert "https://stripe.com/docs/disputes" in [e.source_url for e in finding.evidence]
