"""
Unit tests for targeted cross-examination probe engine (core/cross_examination.py).
"""
import pytest
from core.cross_examination import (
    extract_critical_blocker,
    probe_blocker,
    run_cross_examination_probes,
)
from core.models import Case, Claim, EvidenceItem, Finding


def test_extract_critical_blocker_prioritizes_builder_over_threshold():
    findings = [
        Finding(
            claim_id="c1",
            test_id="t1",
            evaluator="builder",
            result="Day-1 bottleneck",
            reasoning="Hard architectural limit",
            confidence=0.8,
            contradiction="[Day-1 Blocker] OAuth API rate limits prevent real-time sync",
        ),
        Finding(
            claim_id="c1",
            test_id="t2",
            evaluator="devils_advocate",
            result="Incentive misalignment",
            reasoning="Vendors fight back",
            confidence=0.75,
            contradiction="Incumbents will restrict API access",
        ),
    ]
    blocker = extract_critical_blocker(findings)
    assert blocker == "[Day-1 Blocker] OAuth API rate limits prevent real-time sync"


def test_extract_critical_blocker_detects_devils_advocate_when_builder_absent():
    findings = [
        Finding(
            claim_id="c1",
            test_id="t1",
            evaluator="builder",
            result="Achievable with standard work",
            reasoning="Standard engineering effort",
            confidence=0.2,
            contradiction=None,
        ),
        Finding(
            claim_id="c1",
            test_id="t2",
            evaluator="devils_advocate",
            result="Incentive misalignment",
            reasoning="Vendors fight back",
            confidence=0.85,
            contradiction="Incumbents will restrict third-party API access",
        ),
    ]
    blocker = extract_critical_blocker(findings)
    assert blocker == "Incumbents will restrict third-party API access"


def test_extract_critical_blocker_returns_none_for_low_confidence():
    findings = [
        Finding(
            claim_id="c1",
            test_id="t1",
            evaluator="builder",
            result="Minor friction",
            reasoning="Standard effort",
            confidence=0.3,
            contradiction="[Day-1000 Blocker] Scaling issues later",
        ),
        Finding(
            claim_id="c1",
            test_id="t2",
            evaluator="devils_advocate",
            result="Debatable",
            reasoning="Maybe an issue",
            confidence=0.5,
            contradiction="Unproven adoption",
        ),
    ]
    assert extract_critical_blocker(findings) is None


@pytest.mark.asyncio
async def test_probe_blocker_returns_finding_when_search_yields_curated_evidence(
    fake_provider_factory, monkeypatch
):
    case = Case(id="case-1", raw_input="Automate student visa filings")
    claim = Claim(id="c1", statement="AI can auto-file F1 visas safely", load_bearing=True)

    async def mock_search(claim_obj, query_override=None):
        return [
            EvidenceItem(
                source_url="https://travel.state.gov/visa-rules",
                title="US Visa Filing Regulations",
                snippet="USCIS explicitly forbids automated software submissions without accredited attorney signature.",
                retrieved_at="2026-09-07T00:00:00Z",
                stance="contradicts",
            )
        ]

    monkeypatch.setattr("core.cross_examination.search_evidence", mock_search)

    finding = await probe_blocker(
        claim=claim,
        blocker_text="Statutory ban on unauthorized filing",
        case=case,
        provider=fake_provider_factory(responses=[]),
    )

    assert finding is not None
    assert finding.claim_id == "c1"
    assert finding.evaluator == "researcher"
    assert len(finding.evidence) >= 1
    assert finding.contradiction == "Statutory ban on unauthorized filing"
    assert "https://travel.state.gov/visa-rules" in [e.source_url for e in finding.evidence]


@pytest.mark.asyncio
async def test_run_cross_examination_probes_skips_non_load_bearing_and_verified_claims(
    fake_provider_factory, monkeypatch
):
    c_non_lb = Claim(id="c1", statement="Secondary claim", load_bearing=False)
    c_already_verified = Claim(id="c2", statement="Verified claim", load_bearing=True)
    c_probe_candidate = Claim(id="c3", statement="Candidate claim", load_bearing=True)

    case = Case(
        id="case-test",
        raw_input="Test input",
        claims=[c_non_lb, c_already_verified, c_probe_candidate],
    )

    findings = [
        Finding(
            claim_id="c2",
            test_id="t2-r",
            evaluator="researcher",
            result="Found law",
            evidence=[
                EvidenceItem(
                    source_url="https://law.example.com",
                    snippet="Law text",
                    retrieved_at="2026-09-07T00:00:00Z",
                )
            ],
            reasoning="Direct contradiction in law",
            confidence=0.9,
            contradiction="Explicit legal bar",
        ),
        Finding(
            claim_id="c3",
            test_id="t3-b",
            evaluator="builder",
            result="Day-1 Wall",
            reasoning="Third-party limits",
            confidence=0.85,
            contradiction="Rate limit of 10 requests per minute",
        ),
    ]

    async def mock_search(claim_obj, query_override=None):
        return [
            EvidenceItem(
                source_url="https://api.example.com/limits",
                title="API Limits",
                snippet="Rate limit of 10 requests per minute strictly enforced.",
                retrieved_at="2026-09-07T00:00:00Z",
            )
        ]

    monkeypatch.setattr("core.cross_examination.search_evidence", mock_search)

    probes = await run_cross_examination_probes(case, findings, fake_provider_factory(responses=[]))

    assert len(probes) == 1
    assert probes[0].claim_id == "c3"
    assert probes[0].evaluator == "researcher"
