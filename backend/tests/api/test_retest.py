"""
Unit and integration tests for interactive claim re-testing and counter-evidence appeal loop (POST /cases/{id}/claims/{claim_id}/retest).
"""
import pytest
from httpx import ASGITransport, AsyncClient

import store
from main import app
from api.routes import get_llm_provider
from core.models import Case, Claim, ClaimStatus, Finding
from core.reconcile import SteelManVerdict
from core.synthesis import CaseVerdictOutput, NextActionOutput, StrategicConsequenceOutput


class FakeRetestProvider:
    async def generate(self, system_prompt: str, messages: list[dict], response_schema=None):
        name = getattr(response_schema, "__name__", "")
        if name == "SteelManVerdict":
            return SteelManVerdict(
                status="survived",
                reasoning="The salvaged claim addresses all previous failure modes.",
                fatal_flaw=None,
                salvaged_claim=None,
                tradeoff_acknowledged=None,
            )
        if name == "StrategicConsequenceOutput":
            return StrategicConsequenceOutput(
                impact="low",
                recommended_change="Proceed with updated human-in-the-loop workflow.",
                next_validation=None,
            )
        if name == "CaseVerdictOutput":
            return CaseVerdictOutput(
                decision_state="proceed",
                headline="Decision holds with revised premises.",
                summary="Decision holds safely after adopting the salvaged approach.",
                next_actions=[],
            )
        return "Generic response"


@pytest.fixture
def case_with_salvaged_claim():
    case = Case(
        id="case-retest-1",
        raw_input="Deploy automated legal advice robot",
        status="done",
        claims=[
            Claim(
                id="c-broken",
                statement="Robot can provide legal counsel directly to consumers without attorney",
                load_bearing=True,
                status=ClaimStatus.BROKEN,
                fatal_flaw="Statutory bar on unauthorized practice of law",
                salvaged_claim="Robot drafts preliminary memos for licensed supervising attorneys",
                tradeoff_acknowledged="Requires attorney overhead",
            )
        ],
        findings=[
            Finding(
                claim_id="c-broken",
                test_id="t1",
                evaluator="builder",
                result="Regulatory wall",
                reasoning="Bar association prohibits direct advice",
                confidence=0.95,
                contradiction="Unauthorized practice of law",
            )
        ],
    )
    store.set(case)
    return case


@pytest.mark.asyncio
async def test_retest_claim_not_found_returns_404(sample_case):
    store.set(sample_case)
    app.dependency_overrides[get_llm_provider] = lambda: FakeRetestProvider()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/cases/{sample_case.id}/claims/non-existent-claim/retest",
                json={"action": "test_salvaged"},
            )
            assert resp.status_code == 404
            assert "not found" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_retest_salvaged_claim_updates_statement_and_reconciles(case_with_salvaged_claim):
    app.dependency_overrides[get_llm_provider] = lambda: FakeRetestProvider()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/cases/{case_with_salvaged_claim.id}/claims/c-broken/retest",
                json={"action": "test_salvaged"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == case_with_salvaged_claim.id
            retested_claim = next(c for c in data["claims"] if c["id"] == "c-broken")
            assert retested_claim["statement"] == "Robot drafts preliminary memos for licensed supervising attorneys"
            assert retested_claim["status"] == "survived"
            assert data["case_verdict"]["decision_state"] == "proceed"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_retest_counter_evidence_appends_finding_and_reconciles(case_with_salvaged_claim):
    app.dependency_overrides[get_llm_provider] = lambda: FakeRetestProvider()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/cases/{case_with_salvaged_claim.id}/claims/c-broken/retest",
                json={
                    "action": "counter_evidence",
                    "counter_evidence": "State Bar Ethics Opinion 2026-1 specifically authorizes AI paralegal drafting.",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            user_findings = [f for f in data["findings"] if f["evaluator"] == "user_receipt"]
            assert len(user_findings) == 1
            assert "Ethics Opinion 2026-1" in user_findings[0]["reasoning"]
            assert user_findings[0]["evidence"][0]["stance"] == "supports"
    finally:
        app.dependency_overrides.clear()
