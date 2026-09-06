"""
Owner: Dev A. Gate + soft metrics for the eval set.

These run the REAL pipeline against a REAL provider — they cost tokens and need
whatever `LLM_PROVIDER` points at to be reachable. So they're opt-in:

    CROSSFIRE_EVAL_LIVE=1 pytest tests/eval_set -s

Without the env var they skip, which keeps `pytest` and CI fast and offline.
`-s` is what lets the soft-metrics table through.
"""
from __future__ import annotations

import os

import pytest

# Metrics live on the pytest config, not a module global: conftest.py and the
# test module resolve to different module objects under pytest's default import
# mode, so a module-level list here would be appended to by one and read empty
# by the other.
_METRICS_KEY = "_crossfire_eval_metrics"


def pytest_configure(config):
    setattr(config, _METRICS_KEY, [])


@pytest.fixture
def eval_metrics(request) -> list[dict]:
    return getattr(request.config, _METRICS_KEY)


@pytest.fixture(scope="session")
def live_eval_enabled() -> bool:
    if os.getenv("CROSSFIRE_EVAL_LIVE") != "1":
        pytest.skip("eval set is opt-in: set CROSSFIRE_EVAL_LIVE=1 (real LLM calls)")
    return True


def pytest_terminal_summary(terminalreporter):
    """Direction doc §15's soft metrics — printed, never asserted. They're for a
    human to eyeball across the whole set; turning them into pass/fail thresholds
    at this sample size would just be noise."""
    metrics = getattr(terminalreporter.config, _METRICS_KEY, [])
    if not metrics:
        return
    write = terminalreporter.write_line
    write("")
    write("eval set - soft metrics (not asserted)")
    write(f"{'case':<24}{'claims':>7}{'actionable':>12}{'unsourced':>11}")
    for row in metrics:
        write(
            f"{row['case']:<24}{row['claims']:>7}"
            f"{'yes' if row['actionable'] else 'no':>12}{row['unsourced_objections']:>11}"
        )
    actionable = sum(r["actionable"] for r in metrics)
    unsourced = sum(r["unsourced_objections"] for r in metrics)
    write(f"{'TOTAL':<24}{sum(r['claims'] for r in metrics):>7}"
          f"{f'{actionable}/{len(metrics)}':>12}{unsourced:>11}")
    write("  actionable = a load-bearing claim came back non-survived with a next_validation")
    write("  unsourced  = negative findings raised with zero evidence behind them")
