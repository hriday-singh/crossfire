import logging
from pydantic import BaseModel, Field
from typing import Optional

from backend.providers.base import LLMProvider

logger = logging.getLogger(__name__)

class RecoveryResult(BaseModel):
    clarifying_question: str
    missing: list[str] = Field(default_factory=list)
    interpretation: str | None = None
    provisional_claims: list[str] = Field(default_factory=list)

RECOVERY_SYSTEM_PROMPT = """You are a senior analyst helping a colleague clarify a decision they are trying to make.
A first extraction pass found nothing testable in this input. Do not manufacture confidence and do not invent a decision the user did not describe.

Your task is to return a JSON object with the following fields:
1. `clarifying_question`: Write ONE clarifying question a curious colleague would ask out loud. Reference something the user actually said. Examples: "What's the actual call you're weighing here — and what would going wrong look like?", "Which part of this are you closest to committing to?" Never use "Please rephrase", "Repeat that", or "Invalid input".
2. `missing`: 2-3 short fragments naming the concrete absent pieces (e.g., the option being chosen, the cost, the deadline, the alternative). Not advice.
3. `interpretation`: Optional. "Reading it as: ..." explaining how you are currently interpreting their partial thought.
4. `provisional_claims`: At most 3 claims, each traceable to words in the input. NO invented numbers, dates, prices, vendors, jurisdictions or statistics. If nothing is inferable, return an empty list — an honest empty list beats a fabricated claim.
"""

async def run_recovery(
    raw_input: str,
    context: str | None,
    provider: LLMProvider,
    clarify_round: int = 0,
    previous_question: str | None = None,
) -> RecoveryResult | None:
    try:
        messages = [
            {"role": "system", "content": RECOVERY_SYSTEM_PROMPT}
        ]
        
        user_prompt = f"User input: {raw_input}"
        if context:
            user_prompt += f"\n\nContext provided by user: {context}"
        
        if clarify_round >= 1 and previous_question:
            user_prompt += f"\n\nNote: The user already answered once. Ask about something *different* and more concrete. Do not repeat the previous question: '{previous_question}'"
            
        messages.append({"role": "user", "content": user_prompt})
        
        response = await provider.generate_structured(
            messages=messages,
            schema=RecoveryResult,
            temperature=0.7,
            agent_id="recovery",
        )
        return response
    except Exception as e:
        logger.warning(f"Zero-claim recovery failed: {e}")
        return None
