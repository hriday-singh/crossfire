import pytest
from core.textutil import is_empirical_claim
from core.agent_panel import build_test_plan
from core.models import Case, Claim

def test_is_empirical_claim_classification():
    # Empirical claims
    assert is_empirical_claim("The API will scale to 10k QPS on AWS ECS") is True
    assert is_empirical_claim("Competitor X charges /month for this feature") is True
    assert is_empirical_claim("90% of enterprises require SOC 2 compliance") is True
    assert is_empirical_claim("PostgreSQL handles 50,000 writes/sec with jsonb") is True
    assert is_empirical_claim("Students will trust an AI submitting applications on their behalf") is True

    # Non-empirical / deductive / internal claims
    assert is_empirical_claim("The onboarding screen should use a dark theme") is False
    assert is_empirical_claim("We believe code simplicity is more important than speed") is False
    assert is_empirical_claim("If component A fails, component B handles the exception by definition") is False
    assert is_empirical_claim("The founder should lead product design decisions") is False

def test_build_test_plan_selective_dispatch():
    case = Case(
        id="case-selective",
        raw_input="Test proposal",
        claims=[
            Claim(id="c1", statement="The API will scale to 10k QPS", load_bearing=True),
            Claim(id="c2", statement="The onboarding screen should use a dark theme", load_bearing=True),
            Claim(id="c3", statement="The button color should be blue", load_bearing=False),
        ],
    )
    plan = build_test_plan(case, panel=True)
    c1_modes = [p.failure_mode for p in plan if p.target_claim == "c1"]
    c2_modes = [p.failure_mode for p in plan if p.target_claim == "c2"]
    c3_modes = [p.failure_mode for p in plan if p.target_claim == "c3"]

    # Empirical load-bearing claim gets all evaluators including evidence (receipts)
    assert "evidence" in c1_modes
    assert "assumption" in c1_modes
    assert "feasibility" in c1_modes
    assert "operational_friction" in c1_modes

    # Non-empirical load-bearing claim gets reasoning evaluators, but NOT receipts/evidence
    assert "evidence" not in c2_modes
    assert "assumption" in c2_modes
    assert "feasibility" in c2_modes
    assert "operational_friction" in c2_modes

    # Non-empirical secondary claim gets multi-persona reasoning evaluators, but NOT receipts/evidence
    assert "evidence" not in c3_modes
    assert set(c3_modes) == {"assumption", "feasibility", "operational_friction"}
