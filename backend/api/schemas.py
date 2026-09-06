"""
Owner: Dev C. Request/response models — thin wrappers around Case.
See docs/04-dev-C-api-sse-evaluators.md.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from core.models import Claim


class CreateCaseRequest(BaseModel):
    raw_input: str = Field(..., min_length=1, description="Raw statement or proposal to evaluate")
    context: str | None = Field(default=None, description="Optional ingested document or URL context")


class ConfirmCaseRequest(BaseModel):
    claims: list[Claim] = Field(
        default_factory=list,
        description="List of confirmed or user-edited claims to be tested",
    )


class ConfirmCaseResponse(BaseModel):
    case_id: str
    status: str = "testing"
    message: str = "Pipeline started"
