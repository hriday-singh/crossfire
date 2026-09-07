"""
Unit tests for core.synthesis (modularized synthesis layer).
"""
import pytest
from uuid import uuid4
from core.models import Case, Claim, ClaimStatus, DecisionConsequence
from core.synthesis import (
    build_consequences,
    _fallback_decision_state,
    synthesize_case_verdict,
    synthesize_consequences,
    CaseVerdictOutput,
    NextActionOutput,
    StrategicConsequenceOutput,
)
from providers.base import LLMProvider


class MockProvider:
    async def generate(self, system_prompt, messages, response_schema=None):
        schema_name = getattr(response_schema, "__name__", "")
        if schema_name == "CaseVerdictOutput":
            return CaseVerdictOutput(
                decision_state="proceed_with_changes",
                summary="The core claim survived with minor operational caveats.",
                next_actions=[NextActionOutput(action="Test the integration API next week.", claim_ids=[])]
            )
        return StrategicConsequenceOutput(
            impact="medium",
            recommended_change="Adjust the quota threshold before launch.",
            next_validation="Run a 48-hour load test."
        )


def test_build_consequences_maps_salvaged_claim_and_tradeoffs():
    cid = str(uuid4())
    claim = Claim(
        id=cid,
        statement="We can support 100k concurrent users on a $20 server.",
        status=ClaimStatus.BROKEN,
        load_bearing=True,
        fatal_flaw="Memory limit reached at 500 connections.",
        salvaged_claim="Support 1k concurrent users per node with horizontal autoscaling.",
        tradeoff_acknowledged="Increases monthly hosting budget by $150."
    )
    case = Case(
        id=str(uuid4()),
        raw_input="Deploy ultra-cheap hosting",
        claims=[claim],
        status="testing"
    )
    consequences = build_consequences(case)
    assert len(consequences) == 1
    c = consequences[0]
    assert c.impact == "high"
    assert "Salvaged claim:" in c.recommended_change
    assert "Trade-off:" in c.recommended_change
    assert c.salvaged_claim == claim.salvaged_claim
    assert c.tradeoff_acknowledged == claim.tradeoff_acknowledged
    assert c.next_validation == f"Directly test: {claim.statement}"


def test_fallback_decision_state_broken_load_bearing():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.BROKEN, load_bearing=True)
    c2 = Claim(id="c2", statement="Claim 2", status=ClaimStatus.SURVIVED, load_bearing=False)
    case = Case(id="c", raw_input="Test", claims=[c1, c2])
    assert _fallback_decision_state(case) == "drop"


def test_fallback_decision_state_unresolved_load_bearing():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.UNRESOLVED, load_bearing=True)
    case = Case(id="c", raw_input="Test", claims=[c1])
    assert _fallback_decision_state(case) == "hold"


def test_fallback_decision_state_weakened():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.WEAKENED, load_bearing=True)
    case = Case(id="c", raw_input="Test", claims=[c1])
    assert _fallback_decision_state(case) == "proceed_with_changes"


def test_fallback_decision_state_all_survived():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.SURVIVED, load_bearing=True)
    case = Case(id="c", raw_input="Test", claims=[c1])
    assert _fallback_decision_state(case) == "proceed"


@pytest.mark.asyncio
async def test_synthesize_case_verdict_llm():
    c1 = Claim(id="c1", statement="Claim 1", status=ClaimStatus.SURVIVED, load_bearing=True)
    case = Case(id="c", raw_input="Test proposal", claims=[c1], consequences=[])
    provider = MockProvider()
    verdict = await synthesize_case_verdict(case, provider)
    # The mock returns "proceed_with_changes", but the only load-bearing claim
    # survived, so the derived ladder floor is "proceed" and `clamp_decision_state`
    # refuses the downgrade. A checked decision that held up has to be able to say
    # so — `proceed` was returned 0/15 times in the 2026-09-07 corpus.
    assert verdict.decision_state == "proceed"
    assert "survived with minor" in verdict.summary
    assert len(verdict.next_actions) == 1


def test_build_consequences_preserves_all_steelman_fields():
    from core.models import Case, Claim, ClaimStatus
    from core.synthesis import build_consequences
    claim = Claim(
        id="c1",
        statement="High load system",
        status=ClaimStatus.BROKEN,
        load_bearing=True,
        fatal_flaw="Single point of failure in DB",
        salvaged_claim="Use read replicas",
        tradeoff_acknowledged="Adds replication lag",
    )
    case = Case(id="case-1", raw_input="Deploy system", claims=[claim])
    consequences = build_consequences(case)
    assert len(consequences) == 1
    c = consequences[0]
    assert c.fatal_flaw == "Single point of failure in DB"
    assert c.salvaged_claim == "Use read replicas"
    assert c.tradeoff_acknowledged == "Adds replication lag"
    assert "Salvaged claim: Use read replicas" in c.recommended_change

