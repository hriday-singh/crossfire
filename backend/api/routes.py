"""
Owner: Dev C. POST /cases, GET /cases/{id}/stream, POST /cases/{id}/confirm,
GET /cases/{id}. See docs/00-CONTRACTS.md #4 for the call sequence and
docs/04-dev-C-api-sse-evaluators.md for the task breakdown.
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()
