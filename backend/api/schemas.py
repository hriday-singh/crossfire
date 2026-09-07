"""
Owner: Dev C. Request/response models — thin wrappers around Case.
See docs/04-dev-C-api-sse-evaluators.md.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from core.models import Claim, Case


class CreateCaseRequest(BaseModel):
    raw_input: str = Field(..., min_length=1, max_length=50000, description="Raw statement or proposal to evaluate")
    context: str | None = Field(default=None, max_length=500000, description="Optional ingested document or URL context")
    agent_mode: str | None = Field(default="auto", description="Agent selection mode: 'auto' or 'custom'")
    selected_agents: list[str] | None = Field(
        default=None,
        description="Optional pre-selected agent IDs when agent_mode is 'custom'",
    )


class ClarifyCaseRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)


class ClarifyCaseResponse(BaseModel):
    case: Case
    auto_started: bool


class ConfirmCaseRequest(BaseModel):
    claims: list[Claim] = Field(
        default_factory=list,
        description="List of confirmed or user-edited claims to be tested",
    )
    selected_agents: list[str] | None = Field(
        default=None,
        description="Optional list of agent IDs to run tests for",
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


class IngestImageRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded binary content of the image (PNG, JPG, WEBP)")
    claim_statement: str | None = Field(default=None, description="Optional claim statement to focus curation on")


class IngestMarkdownRequest(BaseModel):
    markdown_text: str | None = Field(default=None, description="Raw text content of the Markdown document")
    markdown_base64: str | None = Field(default=None, description="Optional base64-encoded binary content of the Markdown document")
    claim_statement: str | None = Field(default=None, description="Optional claim statement to focus curation on")


class IngestResponse(BaseModel):
    context: str = Field(..., description="Curated context extracted from the document or URL")
    character_count: int = Field(..., description="Length of the extracted context in characters")



class BaselineRequest(BaseModel):
    raw_input: str = Field(..., min_length=1, max_length=50000, description="The same raw input the case was built from")
    context: str | None = Field(default=None, max_length=500000, description="Optional ingested document or URL context")


class BaselineResponse(BaseModel):
    """One plain model call on the same input, for side-by-side contrast with the run."""

    raw_input: str
    answer: str





class AppliedSalvage(BaseModel):
    claim_id: str
    original_statement: str
    salvaged_claim: str


class ImprovePromptRequest(BaseModel):
    selected_claim_ids: list[str] = Field(
        default_factory=list,
        description="List of claim IDs whose Steel Man salvages should replace failed premises",
    )
    custom_instructions: str | None = Field(
        default=None,
        description="Optional guidance for prompt reformulation",
    )


class ImprovePromptResponse(BaseModel):
    case_id: str
    original_prompt: str
    improved_prompt: str
    applied_salvages: list[AppliedSalvage]

