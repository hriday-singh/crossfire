"""
Owner: Dev A. Stub only — not built out for the hackathon.
Exists so a second provider is "write one class," not "restructure every
call site." See docs/00-CONTRACTS.md #2.
"""
from __future__ import annotations

from pydantic import BaseModel


class AnthropicProvider:
    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key

    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel:
        raise NotImplementedError("stub — not built out for the hackathon")
