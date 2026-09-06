"""
Owner: Dev A. FROZEN at hour 2 per docs/00-CONTRACTS.md #2.

Deliberately text/structured-output only — no tools=[...]. Search and fetch
are handled by evidence/ (DuckDuckGo/Scrapling), never by provider-native tool
calls. Nothing outside providers/ talks to google-genai (or any SDK) directly.
"""
from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel


class LLMProvider(Protocol):
    async def generate(
        self,
        system_prompt: str,
        messages: list[dict],
        response_schema: type[BaseModel] | None = None,
    ) -> str | BaseModel: ...
