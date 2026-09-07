"""
Unit tests verifying strict role differentiation, negative scope constraints,
and prompt orthogonality across all four Crossfire evaluators.
Guards against role collapse and semantic overlap.
"""
from __future__ import annotations

import pytest

from core.agent_panel import AGENT_OBJECTIVE, DEFAULT_RATIONALES, KNOWN_AGENTS
from core.evaluators.builder import BUILDER_SYSTEM_PROMPT
from core.evaluators.devils_advocate import DEVILS_ADVOCATE_SYSTEM_PROMPT
from core.evaluators.operator import OPERATOR_SYSTEM_PROMPT
from core.evaluators.researcher import RESEARCHER_SYSTEM_PROMPT


def test_devils_advocate_has_strict_negative_exclusions():
    """Devil's Advocate must strictly exclude Builder, Operator, and Researcher domains."""
    assert "STRICT ROLE EXCLUSIONS" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "Do NOT evaluate software code" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "the Builder handles technical feasibility" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "the Operator handles operational friction" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "the Researcher handles empirical citations" in DEVILS_ADVOCATE_SYSTEM_PROMPT
    assert "Epistemic & Deductive Logic" in DEVILS_ADVOCATE_SYSTEM_PROMPT


def test_builder_has_strict_negative_exclusions():
    """Builder must strictly exclude Researcher, Operator, and Devil's Advocate domains."""
    assert "STRICT ROLE EXCLUSIONS" in BUILDER_SYSTEM_PROMPT
    assert "Do NOT evaluate statutory legal compliance" in BUILDER_SYSTEM_PROMPT
    assert "the Researcher verifies external laws" in BUILDER_SYSTEM_PROMPT
    assert "the Operator handles operational friction" in BUILDER_SYSTEM_PROMPT
    assert "Devil's Advocate evaluates deductive premises" in BUILDER_SYSTEM_PROMPT
    assert "Technical Execution & Mechanics" in BUILDER_SYSTEM_PROMPT


def test_operator_has_strict_negative_exclusions():
    """Operator must strictly exclude Builder, Devil's Advocate, and Researcher domains."""
    assert "STRICT ROLE EXCLUSIONS" in OPERATOR_SYSTEM_PROMPT
    assert "Do NOT evaluate code, system architectures, APIs" in OPERATOR_SYSTEM_PROMPT
    assert "the Builder handles technical mechanics" in OPERATOR_SYSTEM_PROMPT
    assert "Devil's Advocate handles deductive validity" in OPERATOR_SYSTEM_PROMPT
    assert "the Researcher verifies external facts and regulations" in OPERATOR_SYSTEM_PROMPT
    assert "INCENTIVE ALIGNMENT" in OPERATOR_SYSTEM_PROMPT
    assert "ENTERPRISE GATEKEEPING" in OPERATOR_SYSTEM_PROMPT


def test_researcher_is_sole_custodian_of_empirical_citations():
    """Researcher must explicitly declare exclusive custody over verified citations."""
    assert "SOLE custodian of empirical evidence" in RESEARCHER_SYSTEM_PROMPT
    assert "Other evaluators reason theoretically" in RESEARCHER_SYSTEM_PROMPT


def test_agent_objectives_are_orthogonal():
    """Every agent objective must focus on a distinct failure domain."""
    for agent in KNOWN_AGENTS:
        assert agent in AGENT_OBJECTIVE
        assert "{statement}" in AGENT_OBJECTIVE[agent]

    # Verify distinct keywords per evaluator objective
    assert "deductively" in AGENT_OBJECTIVE["devils_advocate"].lower()
    assert "empirically" in AGENT_OBJECTIVE["researcher"].lower()
    assert "technical architecture" in AGENT_OBJECTIVE["builder"].lower()
    assert "human adoption inertia" in AGENT_OBJECTIVE["operator"].lower()
