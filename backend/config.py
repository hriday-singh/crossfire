"""
Owner: Dev A. .env loading via python-dotenv. See docs/crossfire_backend_spec.md #9.
"""
from __future__ import annotations

from functools import lru_cache

from dotenv import load_dotenv
from pydantic import ConfigDict, Field, field_validator
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    serpapi_api_key: str = Field(default="", alias="SERPAPI_API_KEY")
    search_provider: str = Field(default="serpapi", alias="SEARCH_PROVIDER")
    # Search is powered by DuckDuckGo Lite via Scrapling with optional fallback to SerpApi
    tavily_api_key: str = Field(default="", alias="TAVILY_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    demo_mode: bool = Field(default=False, alias="DEMO_MODE")

    # which provider backs the pipeline, and an optional override key for it —
    # lets a dev swap provider/key without touching code. See providers/__init__.py:get_provider.
    llm_provider: str = Field(default="openai_compat", alias="LLM_PROVIDER")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    llm_base_url: str = Field(default="http://localhost:8081/v1", alias="LLM_BASE_URL")
    llm_model: str = Field(default="gemini-3.7-flash", alias="LLM_MODEL")
    # Comma-separated Gemini keys seeding the rotation pool when the encrypted
    # store is empty. Keys added in the web UI take precedence over these.
    gemini_api_keys: str = Field(default="", alias="GEMINI_API_KEYS")
    # Concurrent in-flight requests allowed per API key (providers/pool.py).
    key_pool_max_inflight: int = Field(default=2, alias="KEY_POOL_MAX_INFLIGHT")
    curation_llm_model: str = Field(default="gemini-3.7-flash", alias="CURATION_LLM_MODEL")
    port: int = Field(default=8000, alias="PORT")
    cors_allowed_origins: list[str] | str = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
        alias="CORS_ALLOWED_ORIGINS",
    )
    use_llm_curation: bool = Field(default=False, alias="USE_LLM_CURATION")

    # Fan-out control: a full panel over 5 claims is ~20 concurrent LLM calls.
    # Budgets, not safety nets. openai_compat retries a transient failure once,
    # so one evaluator can cost 2 x llm_timeout + 1 s sleep while holding an
    # evaluator_concurrency slot. With llm_timeout=15 s, one retry pair costs
    # ~31 s; evaluator_timeout at 35 s covers that with a small margin and keeps
    # hung connections from blocking the SSE stream for more than ~35 s total.
    evaluator_concurrency: int = Field(default=8, alias="EVALUATOR_CONCURRENCY")
    evaluator_timeout_seconds: float = Field(default=35.0, alias="EVALUATOR_TIMEOUT_SECONDS")
    llm_timeout_seconds: float = Field(default=15.0, alias="LLM_TIMEOUT_SECONDS")
    steelman_concurrency: int = Field(default=3, alias="STEELMAN_CONCURRENCY")

    # Retrieval budgets. DuckDuckGo Lite answers in well under a second when it
    # answers at all; a 15s wait was never a slow reply, it was a block. Bursting
    # it is what produced the empty results that then triggered the authority and
    # reformulation passes, which burst it again.
    search_timeout_seconds: float = Field(default=8.0, alias="SEARCH_TIMEOUT_SECONDS")
    search_concurrency: int = Field(default=4, alias="SEARCH_CONCURRENCY")
    search_cache_ttl_seconds: float = Field(default=300.0, alias="SEARCH_CACHE_TTL_SECONDS")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("cors_allowed_origins", mode="after")
    @classmethod
    def _ensure_origins_list(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                import json

                try:
                    return [str(x) for x in json.loads(v_str)]
                except Exception:
                    pass
            return [origin.strip() for origin in v_str.split(",") if origin.strip()]
        return [str(x) for x in v]




@lru_cache
def get_settings() -> Settings:
    return Settings()
