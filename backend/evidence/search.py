"""
Owner: Dev B. Tavily wrapper — search_depth="basic", one query per claim,
tenacity-wrapped for transient failures. See docs/03-dev-B-evidence-receipts.md.
"""
from __future__ import annotations

import inspect
import logging
from datetime import datetime, timezone
from typing import Any

from tenacity import (
    retry,
    retry_if_not_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import get_settings
from core.models import Claim, EvidenceItem

logger = logging.getLogger(__name__)


class SettingsProxy:
    """Delegates to base settings while allowing dynamic overrides (e.g. DEMO_MODE)
    for testing and runtime switches."""

    def __init__(self, base: Any) -> None:
        object.__setattr__(self, "_base", base)

    def __getattr__(self, name: str) -> Any:
        if name == "DEMO_MODE":
            return getattr(self._base, "demo_mode", False)
        return getattr(self._base, name)

    def __setattr__(self, name: str, value: Any) -> None:
        if name == "DEMO_MODE":
            object.__setattr__(self, "DEMO_MODE", value)
        else:
            object.__setattr__(self, name, value)


settings = SettingsProxy(get_settings())

DEMO_FIXTURES: dict[str, list[EvidenceItem]] = {}


class _DefaultTavilyClient:
    """Thin wrapper around TavilyClient / AsyncTavilyClient."""

    def __init__(self, api_key: str = "") -> None:
        self.api_key = api_key
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            key = self.api_key or getattr(settings, "tavily_api_key", "")
            if key:
                try:
                    from tavily import AsyncTavilyClient

                    self._client = AsyncTavilyClient(api_key=key)
                except Exception as err:
                    logger.warning(f"Could not initialize AsyncTavilyClient: {err}")
        return self._client

    async def search(self, **kwargs: Any) -> dict[str, Any]:
        client = self._get_client()
        if client is None:
            return {"results": []}
        return await client.search(**kwargs)


_tavily_client: Any = _DefaultTavilyClient(api_key=getattr(settings, "tavily_api_key", ""))


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.1, min=0.1, max=1.0),
    retry=retry_if_not_exception_type(AssertionError),
    reraise=True,
)
async def _execute_search(query: str) -> dict[str, Any]:
    res = _tavily_client.search(
        query=query,
        search_depth="basic",
        max_results=4,
    )
    if inspect.isawaitable(res):
        return await res
    return res


async def search_evidence(claim: Claim) -> list[EvidenceItem]:
    """Searches external evidence for a given claim via Tavily.

    - Single query per claim (search_depth='basic')
    - Explicit DEMO_FIXTURES switch when DEMO_MODE is True
    - Gracefully degrades to an empty list on failure (never raises)
    """
    is_demo = getattr(settings, "DEMO_MODE", False) or getattr(settings, "demo_mode", False)
    if is_demo and claim.id in DEMO_FIXTURES:
        return DEMO_FIXTURES[claim.id]

    try:
        data = await _execute_search(claim.statement)
    except AssertionError:
        raise
    except Exception as exc:
        logger.warning(f"Tavily search failed for claim {claim.id}: {exc}")
        return []

    results = data.get("results", []) if isinstance(data, dict) else []
    items: list[EvidenceItem] = []
    now = datetime.now(timezone.utc).isoformat()

    for item in results:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        if not url:
            continue
        items.append(
            EvidenceItem(
                source_url=url,
                title=item.get("title"),
                snippet=item.get("content") or "",
                retrieved_at=now,
            )
        )
    return items
