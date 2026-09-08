"""Retrieval budget: coalescing, caching and the outbound concurrency gate.

The 3-minute regression was a self-feeding cascade — a burst of identical-ish
queries got DuckDuckGo Lite to answer with an empty page, the empty page
triggered the authority and reformulation passes, and those burst it again.
These tests pin the three mechanisms that stop it.
"""
from __future__ import annotations

import asyncio

import pytest

from core.models import Claim, EvidenceItem
from evidence import search as search_mod


def _claim(cid: str = "c1", statement: str = "Drivers can run 14-hour shifts under federal rules") -> Claim:
    return Claim(id=cid, statement=statement)


def _hit(url: str = "https://www.fmcsa.dot.gov/rule") -> EvidenceItem:
    return EvidenceItem(
        source_url=url,
        title="t",
        snippet="Retrieved text long enough to survive curation checks in this test.",
        retrieved_at="2026-09-08T00:00:00Z",
    )


@pytest.mark.asyncio
async def test_identical_queries_hit_the_engines_once(monkeypatch):
    calls: list[str] = []

    async def fake_engines(claim_id, query):
        calls.append(query)
        return [_hit()]

    monkeypatch.setattr(search_mod, "_search_engines", fake_engines)

    first = await search_mod.search_evidence(_claim())
    second = await search_mod.search_evidence(_claim(cid="c2"))

    assert len(calls) == 1, "the second identical query must be served from cache"
    assert [e.source_url for e in first] == [e.source_url for e in second]


@pytest.mark.asyncio
async def test_concurrent_identical_queries_are_coalesced(monkeypatch):
    calls: list[str] = []
    release = asyncio.Event()

    async def fake_engines(claim_id, query):
        calls.append(query)
        await release.wait()
        return [_hit()]

    monkeypatch.setattr(search_mod, "_search_engines", fake_engines)

    waiters = [asyncio.create_task(search_mod.search_evidence(_claim(cid=f"c{i}"))) for i in range(5)]
    await asyncio.sleep(0)
    release.set()
    results = await asyncio.gather(*waiters)

    assert len(calls) == 1, "five concurrent evaluators asking the same thing is one request"
    assert all(len(r) == 1 for r in results)


@pytest.mark.asyncio
async def test_each_caller_gets_its_own_evidence_objects(monkeypatch):
    """Callers stamp stance and rewrite snippets on deep fetch — shared objects
    would let one evaluator overwrite another's evidence."""

    async def fake_engines(claim_id, query):
        return [_hit()]

    monkeypatch.setattr(search_mod, "_search_engines", fake_engines)

    first = await search_mod.search_evidence(_claim())
    first[0].snippet = "rewritten by the first caller"
    second = await search_mod.search_evidence(_claim(cid="c2"))

    assert second[0].snippet != "rewritten by the first caller"


@pytest.mark.asyncio
async def test_different_queries_are_not_coalesced(monkeypatch):
    calls: list[str] = []

    async def fake_engines(claim_id, query):
        calls.append(query)
        return [_hit()]

    monkeypatch.setattr(search_mod, "_search_engines", fake_engines)

    await search_mod.search_evidence(_claim())
    await search_mod.search_evidence(_claim(), query_override="a different query entirely")

    assert len(calls) == 2


@pytest.mark.asyncio
async def test_outbound_searches_are_capped_by_the_gate(monkeypatch):
    from config import get_settings

    monkeypatch.setattr(search_mod, "_search_gate", None)
    monkeypatch.setattr(search_mod, "_search_gate_loop", None)
    monkeypatch.setattr(get_settings(), "search_concurrency", 2, raising=False)

    peak = 0
    inflight = 0

    async def fake_engines(claim_id, query):
        nonlocal peak, inflight
        inflight += 1
        peak = max(peak, inflight)
        await asyncio.sleep(0.01)
        inflight -= 1
        return [_hit()]

    monkeypatch.setattr(search_mod, "_search_engines", fake_engines)

    await asyncio.gather(
        *(search_mod.search_evidence(_claim(), query_override=f"query {i}") for i in range(8))
    )

    assert peak <= 2, f"gate let {peak} searches out at once"


@pytest.mark.asyncio
async def test_a_cancelled_waiter_does_not_kill_the_shared_search(monkeypatch):
    """An evaluator hitting its own timeout must not cancel the search other
    evaluators are waiting on."""
    calls: list[str] = []
    release = asyncio.Event()

    async def fake_engines(claim_id, query):
        calls.append(query)
        await release.wait()
        return [_hit()]

    monkeypatch.setattr(search_mod, "_search_engines", fake_engines)

    doomed = asyncio.create_task(search_mod.search_evidence(_claim()))
    survivor = asyncio.create_task(search_mod.search_evidence(_claim(cid="c2")))
    await asyncio.sleep(0)
    doomed.cancel()
    release.set()

    assert len(await survivor) == 1
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_an_empty_query_never_reaches_the_engines(monkeypatch):
    async def fail(claim_id, query):
        raise AssertionError("no request should leave for an empty query")

    monkeypatch.setattr(search_mod, "_search_engines", fail)

    assert await search_mod.search_evidence(Claim(id="c1", statement="   ")) == []
