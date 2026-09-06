"""
Baseline single-prompt response generator (Stage 6).
Provides an un-engineered comparison answer on the same decision input.
"""
from __future__ import annotations

from providers.base import LLMProvider

BASELINE_SYSTEM_PROMPT = (
    "Answer the user's question directly and helpfully, as a capable assistant would."
)


async def run_baseline(raw_input: str, provider: LLMProvider, context: str | None = None) -> str:
    """One plain, un-engineered model call on the same input (Stage 6).

    Deliberately not sandbagged: the comparison is only worth anything if this is
    a genuinely good single-prompt answer.
    """
    content = raw_input
    if context:
        content = f"{raw_input}\n\nSupporting document:\n{context}"
    response = await provider.generate(
        system_prompt=BASELINE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )
    return response if isinstance(response, str) else str(response)
