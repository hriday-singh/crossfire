"""
Deprecated: Replaced by core.evaluators.operator (Operational Friction Test).
Kept as a backward-compatibility shim.
"""
from __future__ import annotations

from core.evaluators.operator import OperatorOutput, OperatorVerdict, run_operator

OverthinkerOutput = OperatorOutput
run_overthinker = run_operator

__all__ = ["OverthinkerOutput", "run_overthinker"]
