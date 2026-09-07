import pytest
from core.models import Claim, ClaimStatus, Finding, TestPlanItem, Case
from core.reconcile import apply_evidence_gate, objection_band, reconcile
from core.evaluators.researcher import run_researcher
from providers.base import LLMProvider

class MockEmptySearchProvider(LLMProvider):
    async def generate(self, system_prompt, messages, response_schema=None, temperature=0.0):
        # When model returns an assessment on empty search
        return Finding(
            claim_id="c1",
            test_id="t1",
            evaluator="researcher",
            result="No evidence found",
            evidence=[],
            reasoning="Could not find any outside sources",
            confidence=0.35,
            contradiction=None,
        )

@pytest.mark.asyncio
async def test_researcher_abstains_with_zero_confidence_when_no_evidence(monkeypatch):
    async def mock_empty_search(claim, query_override=None):
        return []

    monkeypatch.setattr("core.evaluators.researcher.search_evidence", mock_empty_search)
    monkeypatch.setattr("core.evaluators.researcher.search_evidence", mock_empty_search)

    claim = Claim(id="c1", statement="Our core values prioritize customer delight")
    item = TestPlanItem(id="t1", target_claim="c1", failure_mode="evidence", objective="Check sources")
    case = Case(id="case1", raw_input="test", claims=[claim])
    provider = MockEmptySearchProvider()
    
    finding = await run_researcher(item, case, provider)
    assert finding.confidence == 0.0
    assert finding.contradiction is None
    assert "abstain" in finding.result.lower()

def test_steelman_ignores_zero_confidence_abstentions():
    findings = [
        Finding(
            claim_id="c1",
            test_id="t1",
            evaluator="researcher",
            result="Abstain: No empirical evidence found",
            evidence=[],
            reasoning="Non-empirical claim",
            confidence=0.0,
            contradiction=None,
        ),
        Finding(
            claim_id="c1",
            test_id="t2",
            evaluator="builder",
            result="Feasible with standard effort",
            evidence=[],
            reasoning="Buildable",
            confidence=0.05,
            contradiction=None,
        ),
    ]
    # Under evidence gate, with only abstentions (0.0) and trivial objections (< 0.20), weakened must upgrade to survived
    status, reasoning = apply_evidence_gate(ClaimStatus.WEAKENED, "Judge was overly skeptical", findings)
    assert status == ClaimStatus.SURVIVED
    assert "Upgraded from weakened to survived" in reasoning

def test_objection_band_abstained():
    assert objection_band(0.0) == "abstained (neutral)"
    assert objection_band(0.1) == "no objection"
    assert objection_band(0.3) == "minor"
    assert objection_band(0.5) == "substantive"
    assert objection_band(0.8) == "severe"
    assert objection_band(0.95) == "fatal"
