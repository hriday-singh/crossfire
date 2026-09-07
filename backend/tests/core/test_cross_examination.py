"""
Unit tests for targeted cross-examination probe engine (core/cross_examination.py).
"""
import pytest
from core.cross_examination import (
    ProbeVerdict,
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
        provider=fake_provider_factory(
            responses=[
                ProbeVerdict(
                    stance="contradicts",
                    contradiction="USCIS forbids automated submissions without an "
                    "accredited attorney signature.",
                    confidence=0.9,
                    reasoning="travel.state.gov states the signature requirement directly.",
                )
            ]
        ),
    )

    assert finding is not None
    assert finding.claim_id == "c1"
    assert finding.evaluator == "researcher"
    assert len(finding.evidence) >= 1
    # The contradiction is what the source says, not the blocker text echoed back.
    assert finding.contradiction == (
        "USCIS forbids automated submissions without an accredited attorney signature."
    )
    assert "Statutory ban on unauthorized filing" not in finding.contradiction
    assert finding.confidence == 0.9
    assert all(e.stance == "contradicts" for e in finding.evidence)
    assert "https://travel.state.gov/visa-rules" in [e.source_url for e in finding.evidence]


@pytest.mark.asyncio
async def test_probe_blocker_does_not_manufacture_a_contradiction_from_context(
    fake_provider_factory, monkeypatch
):
    """The whole point of the probe: an unverified blocker must not come back
    wearing evidence. `has_sourced_contradiction` gates `broken` on the
    (evidence + contradiction) pair, so a probe that stamps both without reading
    the sources makes the evidence gate unreachable."""
    case = Case(id="case-2", raw_input="Migrate the wiki over one weekend")
    claim = Claim(id="c1", statement="The migration completes in 48 hours", load_bearing=True)

    async def mock_search(claim_obj, query_override=None):
        return [
            EvidenceItem(
                source_url="https://example.com/migration-guide",
                title="Migration guide",
                snippet="Teams plan wiki migrations in phases and validate links afterwards.",
                retrieved_at="2026-09-07T00:00:00Z",
            )
        ]

    monkeypatch.setattr("core.cross_examination.search_evidence", mock_search)

    finding = await probe_blocker(
        claim=claim,
        blocker_text="Link remediation cannot be absorbed in a weekend",
        case=case,
        provider=fake_provider_factory(
            responses=[
                ProbeVerdict(
                    stance="context",
                    contradiction=None,
                    confidence=0.7,
                    reasoning="The guide describes phasing but names no duration.",
                )
            ]
        ),
    )

    assert finding is not None
    assert finding.contradiction is None
    assert finding.confidence <= 0.35
    assert all(e.stance == "context" for e in finding.evidence)


@pytest.mark.asyncio
async def test_probe_blocker_drops_a_contradiction_stance_with_no_contradiction_text(
    fake_provider_factory, monkeypatch
):
    case = Case(id="case-3", raw_input="Ship the pricing change")
    claim = Claim(id="c1", statement="Usage pricing lifts net revenue retention", load_bearing=True)

    async def mock_search(claim_obj, query_override=None):
        return [
            EvidenceItem(
                source_url="https://example.org/pricing-study",
                title="Pricing study",
                snippet="Retention outcomes under consumption pricing vary widely by segment.",
                retrieved_at="2026-09-07T00:00:00Z",
            )
        ]

    monkeypatch.setattr("core.cross_examination.search_evidence", mock_search)

    finding = await probe_blocker(
        claim=claim,
        blocker_text="Enterprise budgets cap consumption spend",
        case=case,
        provider=fake_provider_factory(
            responses=[
                ProbeVerdict(
                    stance="contradicts",
                    contradiction="   ",
                    confidence=0.95,
                    reasoning="Asserted a refutation without naming one.",
                )
            ]
        ),
    )

    assert finding is not None
    assert finding.contradiction is None
    assert finding.confidence <= 0.35


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

    probes = await run_cross_examination_probes(
        case,
        findings,
        fake_provider_factory(
            responses=[
                ProbeVerdict(
                    stance="contradicts",
                    contradiction="The published limit is 10 requests per minute.",
                    confidence=0.8,
                    reasoning="api.example.com documents the ceiling.",
                )
            ]
        ),
    )

    assert len(probes) == 1
    assert probes[0].claim_id == "c3"
    assert probes[0].evaluator == "researcher"
