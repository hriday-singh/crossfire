"""
Owner: Dev A. GeminiProvider adapter — talks OpenAI-compatible wire format,
pointed at Google's own generativelanguage.googleapis.com endpoint.
"""
from __future__ import annotations

from pydantic import BaseModel

from config import get_settings
from providers.openai_compat import OpenAICompatibleProvider


class GeminiProvider:
    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or get_settings().gemini_api_key
        self._proxy = OpenAICompatibleProvider(api_key=self._api_key)

    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel:
        return await self._proxy.generate(
            system_prompt=system_prompt,
            messages=messages,
            response_schema=response_schema,
        )
