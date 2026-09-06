"""
Owner: Dev A. Hour 2-11 (docs/02-dev-A-core-loop-providers.md).
Concrete LLMProvider wrapping google-genai. When response_schema is set, use
Gemini's native structured-output mode, not hand-parsed JSON.
"""
from __future__ import annotations

from pydantic import BaseModel

from config import get_settings


class GeminiProvider:
    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or get_settings().gemini_api_key

    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel:
        raise NotImplementedError("wire google-genai client here")
