"""
Owner: Dev A. In-memory dict[case_id -> Case] for the hackathon. No DB.
"""
from __future__ import annotations

from core.models import Case

_cases: dict[str, Case] = {}


def get(case_id: str) -> Case | None:
    return _cases.get(case_id)


def set(case: Case) -> None:
    _cases[case.id] = case


def delete(case_id: str) -> None:
    _cases.pop(case_id, None)
