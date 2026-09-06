"""
Unit tests for store.py (in-memory Case store).
Owner: Dev A.
"""
from __future__ import annotations

import pytest

import store
from core.models import Case


@pytest.fixture(autouse=True)
def clear_store():
    """Ensure in-memory store is cleared before and after each test."""
    store._cases.clear()
    yield
    store._cases.clear()


def test_store_set_and_get():
    case = Case(id="case-100", raw_input="Startup idea: AI test generator")
    store.set(case)
    retrieved = store.get("case-100")
    assert retrieved is not None
    assert retrieved.id == "case-100"
    assert retrieved.raw_input == "Startup idea: AI test generator"


def test_store_get_nonexistent_returns_none():
    assert store.get("non-existent-id") is None


def test_store_delete_removes_case():
    case = Case(id="case-200", raw_input="Another case")
    store.set(case)
    assert store.get("case-200") is not None

    store.delete("case-200")
    assert store.get("case-200") is None


def test_store_delete_nonexistent_is_noop():
    # Should not raise KeyError or any exception
    store.delete("non-existent-id")


def test_store_set_overwrites_existing():
    case1 = Case(id="case-300", raw_input="Version 1", status="extracting")
    case2 = Case(id="case-300", raw_input="Version 2", status="done")
    store.set(case1)
    stored = store.get("case-300")
    assert stored is not None
    assert stored.status == "extracting"

    store.set(case2)
    updated = store.get("case-300")
    assert updated is not None
    assert updated.status == "done"
    assert updated.raw_input == "Version 2"
