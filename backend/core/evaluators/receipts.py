"""
Deprecated: Replaced by core.evaluators.researcher (Evidence Test).
Kept as a backward-compatibility shim aliasing core.evaluators.researcher.
"""
from __future__ import annotations

import sys
from core.evaluators import researcher
from core.evaluators.researcher import *  # noqa: F401, F403

# Forward all attributes and alias the module in sys.modules
sys.modules[__name__] = researcher
