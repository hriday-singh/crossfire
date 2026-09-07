"""
Owner: Dev A. Token usage and execution telemetry tracking.
Estimates and aggregates prompt and completion tokens per agent persona and stage,
calculating granular USD cost breakdown and latency metrics.
"""
from __future__ import annotations

import json
import time
from typing import Any

from pydantic import BaseModel

from core.models import AgentTokenUsage, CaseTelemetry

# Pricing per million tokens (Gemini 2.5/Flash tier approximation)
COST_PER_MILLION_PROMPT_USD = 0.075
COST_PER_MILLION_COMPLETION_USD = 0.30


def estimate_tokens_from_text(text: str | None) -> int:
    """Heuristic token estimation: ~4 chars per token for English/code, minimum 1 if text present."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def estimate_tokens_from_messages(system_prompt: str | None, messages: list[dict[str, Any]] | None) -> int:
    """Estimates tokens for system prompt and conversational message payloads."""
    chars = len(system_prompt or "")
    for m in messages or []:
        chars += len(str(m.get("content") or ""))
    return max(1, chars // 4) if chars > 0 else 0


def estimate_tokens_from_output(output: str | BaseModel | Any) -> int:
    """Estimates tokens from LLM output (raw string, Pydantic model, or dict)."""
    if output is None:
        return 0
    if isinstance(output, str):
        return estimate_tokens_from_text(output)
    if isinstance(output, BaseModel):
        return estimate_tokens_from_text(json.dumps(output.model_dump()))
    if isinstance(output, dict):
        return estimate_tokens_from_text(json.dumps(output))
    return estimate_tokens_from_text(str(output))


def calculate_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    """Calculates estimated cost in USD based on prompt and completion token counts."""
    cost = (
        (prompt_tokens / 1_000_000.0) * COST_PER_MILLION_PROMPT_USD
        + (completion_tokens / 1_000_000.0) * COST_PER_MILLION_COMPLETION_USD
    )
    return round(cost, 6)


class TelemetryTracker:
    """Tracks token consumption and durations across pipeline stages."""

    def __init__(self) -> None:
        self._records: dict[str, dict[str, int]] = {}
        self._start_time: float = time.monotonic()

    def record(
        self,
        agent: str,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        prompt_text: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        output: str | BaseModel | Any = None,
    ) -> None:
        """Records token usage for a named agent/stage."""
        p_tok = prompt_tokens if prompt_tokens is not None else (
            estimate_tokens_from_messages(prompt_text, messages) if messages else estimate_tokens_from_text(prompt_text)
        )
        c_tok = completion_tokens if completion_tokens is not None else estimate_tokens_from_output(output)

        if agent not in self._records:
            self._records[agent] = {"prompt_tokens": 0, "completion_tokens": 0}

        self._records[agent]["prompt_tokens"] += p_tok
        self._records[agent]["completion_tokens"] += c_tok

    def build_telemetry(self) -> CaseTelemetry:
        """Assembles the final CaseTelemetry object with aggregated totals and costs."""
        elapsed_ms = round((time.monotonic() - self._start_time) * 1000.0, 1)

        breakdown: list[AgentTokenUsage] = []
        tot_prompt = 0
        tot_completion = 0

        for agent_name, counts in self._records.items():
            p_tok = counts["prompt_tokens"]
            c_tok = counts["completion_tokens"]
            tot_prompt += p_tok
            tot_completion += c_tok
            breakdown.append(
                AgentTokenUsage(
                    agent=agent_name,
                    prompt_tokens=p_tok,
                    completion_tokens=c_tok,
                    total_tokens=p_tok + c_tok,
                    estimated_cost_usd=calculate_cost_usd(p_tok, c_tok),
                )
            )

        # Sort breakdown by total tokens descending
        breakdown.sort(key=lambda x: x.total_tokens, reverse=True)

        return CaseTelemetry(
            total_prompt_tokens=tot_prompt,
            total_completion_tokens=tot_completion,
            total_tokens=tot_prompt + tot_completion,
            total_estimated_cost_usd=calculate_cost_usd(tot_prompt, tot_completion),
            agent_breakdown=breakdown,
            duration_ms=elapsed_ms,
        )
