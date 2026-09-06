"""
Owner: Dev B. Covers evidence/fetch.py (Scrapling) and evidence/curate.py.
See docs/03-dev-B-evidence-receipts.md hour 11-35.
"""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_deep_fetch_only_triggered_for_load_bearing_thin_snippet(monkeypatch, sample_claim):
    """Adaptive scrutiny, backend spec §5: Scrapling only runs when
    claim.load_bearing is True AND the Tavily snippet isn't strong enough.
    Assert fetch() is NOT called for a non-load-bearing claim, and IS called
    for a load-bearing one with a thin snippet.
    """
    pytest.skip("fill in once evidence/fetch.py and the branch in receipts.py exist")


@pytest.mark.asyncio
async def test_deep_fetch_never_targets_a_search_engine_results_page():
    """Structural guard: the spec is explicit that Scrapling must never fetch
    a SERP directly. If your fetch() takes a URL, add a check (or a test
    documenting the invariant) that a search-engine domain never reaches it —
    URLs should always come from Tavily's *result* list, not a query URL.
    """
    pytest.skip("fill in once evidence/fetch.py exists")


@pytest.mark.asyncio
async def test_fetch_failure_drops_the_source_without_crashing(sample_claim):
    """A dead link or a wall Scrapling genuinely can't beat -> that source is
    dropped, not retried into a crash. Receipts should still get a Finding,
    just with fewer/zero EvidenceItems.
    """
    pytest.skip("fill in once evidence/fetch.py exists")


def test_curate_truncates_to_relevant_sentences(sample_claim):
    """curate() should reduce an arbitrary block of page text down to the 1-3
    sentences actually relevant to the claim — assert the output is
    meaningfully shorter than a long input, and that the exact claim-relevant
    sentence you seed into the fixture text survives.
    SKELETON:
    from evidence.curate import curate
    long_text = "Irrelevant filler. " * 50 + "The actual relevant sentence about the claim." + " More filler." * 50
    result = curate(long_text, sample_claim)
    assert "actual relevant sentence" in result
    assert len(result) < len(long_text) / 2
    """
    pytest.skip("fill in once evidence.curate.curate exists")


def test_curate_never_passes_full_page_through_untouched(sample_claim):
    """Regression guard for the spec's core invariant: 'nothing beyond the
    curated snippet reaches the LLM prompt.' If curate() ever just returns
    its input unchanged for a long page, that invariant is broken.
    """
    pytest.skip("fill in once evidence.curate.curate exists")
