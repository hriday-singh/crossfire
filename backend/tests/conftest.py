"""
Shared pytest fixtures for the Crossfire backend test suite.

These import from the modules the contract in docs/00-CONTRACTS.md defines
(`core.models`, `providers.base`). Until those files exist, every test here
fails on import — that's expected on day one, not a bug. Once Dev A lands
`core/models.py` and `providers/base.py` at hour 2, these fixtures start
working for everyone immediately, which is the point of freezing that file
first: nobody has to wait to start writing real tests against real shapes.

Run with: pytest (from the backend/ root, so `core`, `providers`, etc.
resolve as top-level packages). Needs `pytest-asyncio` for the async tests
below (`pip install pytest pytest-asyncio`, and either mark async tests with
`@pytest.mark.asyncio` or set `asyncio_mode = "auto"` in pytest.ini).
"""
from __future__ import annotations

import os

import pytest


@pytest.fixture(autouse=True, scope="session")
def _isolated_sqlite(tmp_path_factory):
    """store.clear() really does DELETE FROM cases. Without this the suite wipes
    the developer's actual backend/crossfire.db on every run."""
    os.environ["SQLITE_DB_PATH"] = str(tmp_path_factory.mktemp("store") / "test.db")
    yield


import events

@pytest.fixture(autouse=True)
def reset_events_fixture():
    events.reset()
    yield
    events.reset()


from core.models import (
    Case,
    Claim,
    ClaimStatus,
    DecisionConsequence,
    EvidenceItem,
    Finding,
    TestPlanItem,
)


class FakeLLMProvider:
    """A minimal LLMProvider stand-in. Satisfies the Protocol in providers/base.py
    without ever calling a real API — use this in every test that needs "an LLM"
    but isn't specifically testing the Gemini/Anthropic adapter itself.

    Configure it with `responses`, a list consumed in order, one per call to
    `generate()`. Each entry is either a plain string or a BaseModel instance
    (for calls that pass `response_schema`).
    """

    def __init__(self, responses: list):
        self._responses = list(responses)
        self.calls: list[dict] = []

    async def generate(self, system_prompt, messages, response_schema=None):
        self.calls.append(
            {
                "system_prompt": system_prompt,
                "messages": messages,
                "response_schema": response_schema,
            }
        )
        if not self._responses:
            raise AssertionError("FakeLLMProvider ran out of queued responses")
        return self._responses.pop(0)


@pytest.fixture(autouse=True)
def _isolate_process_state():
    """`store` and `events` are module-global dicts by design (in-memory, no DB).
    Without this, a case_id reused across tests inherits the previous test's
    queued events and Case."""
    import events
    import store

    store._cases.clear()
    events._queues.clear()
    events._closed_cases.clear()
    yield
    store._cases.clear()
    events._queues.clear()
    events._closed_cases.clear()



@pytest.fixture
def fake_provider():
    """Empty by default — pass `responses=[...]` per-test via
    `fake_provider_factory` when you need specific canned output."""
    return FakeLLMProvider(responses=[])


@pytest.fixture
def fake_provider_factory():
    def _make(responses):
        return FakeLLMProvider(responses=responses)

    return _make


@pytest.fixture
def sample_claim() -> Claim:
    return Claim(
        id="claim-1",
        statement="Students will trust an AI submitting applications on their behalf",
        load_bearing=True,
        status=None,
    )


@pytest.fixture
def sample_low_stakes_claim() -> Claim:
    return Claim(
        id="claim-2",
        statement="The onboarding screen should use a dark theme",
        load_bearing=False,
        status=None,
    )


@pytest.fixture
def sample_test_plan_item(sample_claim) -> TestPlanItem:
    return TestPlanItem(
        id="test-1",
        target_claim=sample_claim.id,
        failure_mode="evidence",
        objective="Check whether a comparable product already proves or disproves this",
    )


@pytest.fixture
def sample_evidence_items() -> list[EvidenceItem]:
    return [
        EvidenceItem(
            source_url="https://example.com/article",
            title="A relevant article",
            snippet="The one or two sentences actually relevant to the claim.",
            retrieved_at="2026-09-06T00:00:00Z",
        )
    ]


@pytest.fixture
def sample_finding(sample_claim, sample_test_plan_item, sample_evidence_items) -> Finding:
    return Finding(
        claim_id=sample_claim.id,
        test_id=sample_test_plan_item.id,
        evaluator="receipts",
        result="Evidence partially supports the claim",
        evidence=sample_evidence_items,
        reasoning="One comparable case found; sample size is small",
        confidence=0.55,
        contradiction=None,
    )


@pytest.fixture
def conflicting_findings(sample_claim, sample_test_plan_item) -> list[Finding]:
    """Two findings on the same claim that disagree — for reconcile() tests."""
    return [
        Finding(
            claim_id=sample_claim.id,
            test_id=sample_test_plan_item.id,
            evaluator="devils_advocate",
            result="No evidence users would actually do this",
            evidence=[],
            reasoning="Pure assumption attack, no sources checked",
            confidence=0.4,
            contradiction="Receipts found a comparable case that succeeded",
        ),
        Finding(
            claim_id=sample_claim.id,
            test_id=sample_test_plan_item.id,
            evaluator="receipts",
            result="A comparable product has meaningful adoption",
            evidence=[
                EvidenceItem(
                    source_url="https://example.com/competitor",
                    title="Competitor case study",
                    snippet="Users adopted the autonomous-submission feature at a notable rate.",
                    retrieved_at="2026-09-06T00:00:00Z",
                )
            ],
            reasoning="Direct comparable with real evidence",
            confidence=0.7,
            contradiction=None,
        ),
    ]


@pytest.fixture
def sample_case(sample_claim, sample_low_stakes_claim) -> Case:
    return Case(
        id="case-1",
        raw_input="I want to build an AI that manages college applications for students",
        context=None,
        claims=[sample_claim, sample_low_stakes_claim],
        test_plan=[],
        findings=[],
        consequences=[],
        status="awaiting_confirmation",
    )
