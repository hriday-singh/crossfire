"""
Owner: Dev A. .env loading via python-dotenv. See docs/crossfire_backend_spec.md #9.
"""
from __future__ import annotations

from functools import lru_cache

from dotenv import load_dotenv
from pydantic import ConfigDict, Field
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
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
    curation_llm_model: str = Field(default="gemini-3.7-flash", alias="CURATION_LLM_MODEL")

    model_config = ConfigDict(populate_by_name=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
