"""
Unit tests for config.py (Settings and environment loading).
Owner: Dev A.
"""
from __future__ import annotations

import pytest

from config import Settings, get_settings


def test_settings_defaults():
    settings = Settings(
        _env_file=None,  # ignore existing .env for default check
        GEMINI_API_KEY="",
        TAVILY_API_KEY="",
        ANTHROPIC_API_KEY="",
        OPENAI_API_KEY="",
        DEMO_MODE=False,
        LLM_PROVIDER="openai_compat",
        LLM_API_KEY="",
        LLM_BASE_URL="http://localhost:8081/v1",
        LLM_MODEL="gemini-3.7-flash",
    )
    assert settings.demo_mode is False
    assert settings.llm_provider == "openai_compat"
    assert settings.llm_base_url == "http://localhost:8081/v1"
    assert settings.llm_model == "gemini-3.7-flash"


def test_settings_environment_overrides(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setenv("TAVILY_API_KEY", "test-tavily-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-anthropic-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_API_KEY", "test-override-key")
    monkeypatch.setenv("LLM_BASE_URL", "http://custom:9000/v1")
    monkeypatch.setenv("LLM_MODEL", "custom-model")

    settings = Settings(_env_file=None)
    assert settings.gemini_api_key == "test-gemini-key"
    assert settings.tavily_api_key == "test-tavily-key"
    assert settings.anthropic_api_key == "test-anthropic-key"
    assert settings.openai_api_key == "test-openai-key"
    assert settings.demo_mode is True
    assert settings.llm_provider == "gemini"
    assert settings.llm_api_key == "test-override-key"
    assert settings.llm_base_url == "http://custom:9000/v1"
    assert settings.llm_model == "custom-model"


def test_get_settings_lru_cache():
    get_settings.cache_clear()
    s1 = get_settings()
    s2 = get_settings()
    assert s1 is s2
    get_settings.cache_clear()


def test_cors_allowed_origins_and_curation_settings(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000, http://example.com")
    monkeypatch.setenv("USE_LLM_CURATION", "true")
    settings = Settings(_env_file=None)
    assert settings.cors_allowed_origins == ["http://localhost:3000", "http://example.com"]
    assert settings.use_llm_curation is True

