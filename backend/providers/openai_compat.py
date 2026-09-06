"""
Owner: Dev A. Stub only — covers OpenAI, Ollama, and custom endpoints behind
one adapter. Not built out for the hackathon. See docs/00-CONTRACTS.md #2.
"""
from __future__ import annotations

from pydantic import BaseModel


class OpenAICompatibleProvider:
    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key

    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel:
        raise NotImplementedError("stub — not built out for the hackathon")
