import sys
from pydantic import BaseModel, model_validator
from typing import Any

class NextAction(BaseModel):
    action: str
    claim_ids: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def parse_string_action(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"action": data, "claim_ids": []}
        return data

class CaseVerdict(BaseModel):
    next_actions: list[NextAction] = []

json_data = '{"next_actions": ["Run a 1-week pilot", {"action": "Do something", "claim_ids": ["123"]}]}'
try:
    obj = CaseVerdict.model_validate_json(json_data)
    print("Success:")
    print(obj)
except Exception as e:
    print("Error:")
    print(e)
