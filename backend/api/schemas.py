"""
Owner: Dev C. Request/response models — thin wrappers around Case.
See docs/04-dev-C-api-sse-evaluators.md.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from core.models import Claim


class CreateCaseRequest(BaseModel):
    raw_input: str = Field(..., min_length=1, max_length=10000, description="Raw statement or proposal to evaluate")
    context: str | None = Field(default=None, max_length=50000, description="Optional ingested document or URL context")


class ConfirmCaseRequest(BaseModel):
    claims: list[Claim] = Field(
        default_factory=list,
        description="List of confirmed or user-edited claims to be tested",
    )


class ConfirmCaseResponse(BaseModel):
    case_id: str
    status: str = "testing"
    message: str = "Pipeline started"


class IngestUrlRequest(BaseModel):
    url: str = Field(..., description="Web URL to fetch and curate context from")
    claim_statement: str | None = Field(default=None, description="Optional claim statement to focus curation on")


class IngestPdfRequest(BaseModel):
    pdf_base64: str = Field(..., description="Base64-encoded binary content of the PDF")
    claim_statement: str | None = Field(default=None, description="Optional claim statement to focus curation on")


class IngestResponse(BaseModel):
    context: str = Field(..., description="Curated context extracted from the document or URL")
    character_count: int = Field(..., description="Length of the extracted context in characters")

