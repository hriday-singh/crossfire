"""
Retrieval-authority tests. The 2026-09-07 calibration corpus scored 1.47/3.0 on
distinguishability from a vanilla control; every case that scored above 1 rested
on a primary or institutional source, and every case that tied the control was
answered out of ordinary `web` results the control already had in weights.
"""
import pytest

from core.models import Case, Claim, EvidenceItem, TestPlanItem
from evidence.search import (
    build_authority_query,
    build_query,
    has_authority_source,
)


def _item(url, source_class="web"):
    return EvidenceItem(
        source_url=url,
        title="t",
        snippet="Some retrieved text about the subject at hand, long enough to pass curation checks.",
        retrieved_at="2026-09-07T00:00:00Z",
        source_class=source_class,
    )


def test_has_authority_source_detects_a_primary_hit():
    assert has_authority_source([_item("https://example.com/a"), _item("https://www.fmcsa.dot.gov/rule", "primary")])


def test_has_authority_source_is_false_for_ordinary_web_results():
    assert not has_authority_source([_item("https://example.com/a"), _item("https://news.example.com/b")])


def test_has_authority_source_classifies_from_the_url_when_unstamped():
    """Search results arrive stamped, but callers pass raw items too."""
    assert has_authority_source([EvidenceItem(source_url="https://www.ecfr.gov/x", snippet="s", retrieved_at="2026-09-07T00:00:00Z")])


def test_build_authority_query_keeps_the_claim_keywords():
    statement = "Drivers can run 14-hour shifts under federal rules"
    base = build_query(statement)
    authority = build_authority_query(statement)
    for term in base.split():
        assert term in authority
    assert authority != base


def test_build_authority_query_survives_an_empty_statement():
    assert build_authority_query("") == ""


@pytest.mark.asyncio
async def test_researcher_runs_an_authority_pass_when_the_first_sweep_is_all_web(monkeypatch):
    from core.evaluators import receipts

    queries: list[str | None] = []

    async def mock_search(claim_obj, query_override=None):
        queries.append(query_override)
        if query_override is None:
            return [_item("https://blogsite.example.com/post")]
        return [_item("https://www.fmcsa.dot.gov/hours-of-service", "primary")]

    monkeypatch.setattr(receipts, "search_evidence", mock_search)

    claim = Claim(id="c1", statement="Drivers can run 14-hour shifts", load_bearing=False)
    case = Case(id="case-1", raw_input="Schedule 14-hour driver shifts", claims=[claim])
    item = TestPlanItem(id="t1", target_claim="c1", failure_mode="evidence", objective="Check the limit")

    finding = await receipts.run_researcher(item, case, _StubProvider())

    assert len(queries) == 2, "expected a second, authority-biased search"
    assert queries[1] == build_authority_query(claim.statement)
    urls = [e.source_url for e in finding.evidence]
    assert "https://www.fmcsa.dot.gov/hours-of-service" in urls
    assert urls[0] == "https://www.fmcsa.dot.gov/hours-of-service", "authority hit must lead"


@pytest.mark.asyncio
async def test_researcher_skips_the_authority_pass_when_a_primary_source_already_landed(monkeypatch):
    from core.evaluators import receipts

    queries: list[str | None] = []

    async def mock_search(claim_obj, query_override=None):
        queries.append(query_override)
        return [_item("https://www.fmcsa.dot.gov/hours-of-service", "primary")]

    monkeypatch.setattr(receipts, "search_evidence", mock_search)

    claim = Claim(id="c1", statement="Drivers can run 14-hour shifts", load_bearing=False)
    case = Case(id="case-1", raw_input="Schedule 14-hour driver shifts", claims=[claim])
    item = TestPlanItem(id="t1", target_claim="c1", failure_mode="evidence", objective="Check the limit")

    await receipts.run_researcher(item, case, _StubProvider())

    assert queries == [None], "no second search when the first sweep already found authority"


class _StubProvider:
    """Returns the Researcher's own schema; the assertions here are about retrieval."""

    async def generate(self, system_prompt, messages, response_schema=None):
        from core.evaluators.receipts import ResearcherAssessment

        if response_schema is None:
            return "plain answer"
        return ResearcherAssessment(
            result="Federal limit found",
            reasoning="The register names an 11-hour driving cap.",
            confidence=0.9,
            contradiction="The federal cap is 11 hours of driving.",
            cited=[],
        )
