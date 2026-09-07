"""
Owner: Dev A. Tests for corpus runner accounting and progress tracking.
"""
import json
import pytest
from pathlib import Path

from scripts.run_corpus import (
    _calculate_progress_summary,
    extract_summary,
    update_progress,
    update_progress_failed,
    run_control_sync,
)


def test_calculate_progress_summary():
    progress = {
        "cases": {
            "case-1": {
                "status": "done",
                "control_status": "ok",
                "timeouts_count": 0,
                "wall_clock_seconds": 15.0,
            },
            "case-2": {
                "status": "failed",
                "control_status": "error",
                "timeouts_count": 2,
                "wall_clock_seconds": 30.0,
            },
        }
    }
    _calculate_progress_summary(progress)
    summary = progress["summary"]
    assert summary["considered"] == 2
    assert summary["completed"] == 1
    assert summary["failed"] == 1
    assert summary["control_ok"] == 1
    assert summary["control_errors"] == 1
    assert summary["total_timeouts"] == 2
    assert summary["total_wall_clock_seconds"] == 45.0


def test_extract_summary_embeds_account():
    case_def = {"id": "test-1", "band": "A", "raw_input": "Proposal"}
    case_data = {
        "status": "done",
        "claims": [],
        "findings": [
            {"claim_id": "c1", "test_id": "t1", "result": "System Error / Timeout", "reasoning": "Timeout"}
        ],
        "consequences": [],
        "case_verdict": {"decision_state": "hold"},
    }
    control_acct = {"status": "ok", "error": None, "duration_seconds": 2.5, "attempts": 1}
    pipeline_acct = {"status": "done", "attempts": 1, "duration_seconds": 10.0, "timeouts_count": 1}

    res = extract_summary(case_def, case_data, 10.0, control_acct, pipeline_acct)
    assert "account" in res
    assert res["account"]["timeouts_count"] == 1
    assert res["account"]["has_system_errors"] is True
    assert res["account"]["control"]["status"] == "ok"
    assert res["account"]["pipeline"]["attempts"] == 1


def test_update_progress_and_failed(tmp_path: Path):
    summary = {
        "case_id": "a1-test",
        "band": "A",
        "status": "done",
        "claims": [],
        "findings": [],
        "wall_clock_seconds": 12.0,
        "case_verdict": {"decision_state": "proceed"},
        "account": {
            "control": {"status": "ok", "error": None},
            "pipeline": {"status": "done", "attempts": 1},
            "timeouts_count": 0,
        },
    }
    update_progress(summary, tmp_path)

    progress_file = tmp_path / "corpus_progress.json"
    assert progress_file.exists()
    data = json.loads(progress_file.read_text(encoding="utf-8"))
    assert "a1-test" in data["cases"]
    assert data["cases"]["a1-test"]["control_status"] == "ok"
    assert data["summary"]["completed"] == 1

    # Record a failure
    case_def = {"id": "b1-failed", "band": "B", "raw_input": "Bad case"}
    ctrl_acct = {"status": "error", "error": "HTTP 504"}
    pipe_acct = {"status": "failed", "attempts": 2, "duration_seconds": 60.0, "timeouts_count": 1, "error": "Subprocess crashed"}
    update_progress_failed(case_def, tmp_path, ctrl_acct, pipe_acct)

    data = json.loads(progress_file.read_text(encoding="utf-8"))
    assert "b1-failed" in data["cases"]
    assert data["cases"]["b1-failed"]["status"] == "failed"
    assert data["cases"]["b1-failed"]["control_status"] == "error"
    assert data["summary"]["failed"] == 1
    assert data["summary"]["control_errors"] == 1
    assert data["summary"]["total_timeouts"] == 1
    assert data["cases"]["b1-failed"]["control_seconds"] == 0.0
    assert data["cases"]["b1-failed"]["pipeline_seconds"] == 60.0
    assert data["cases"]["b1-failed"]["total_seconds"] == 60.0


def test_extract_summary_timings():
    case_def = {"id": "test-timings", "band": "A", "raw_input": "Proposal"}
    case_data = {
        "status": "done",
        "claims": [],
        "findings": [],
        "consequences": [],
        "case_verdict": {"decision_state": "proceed"},
    }
    control_acct = {"status": "ok", "error": None, "duration_seconds": 3.25, "attempts": 1}
    pipeline_acct = {"status": "done", "attempts": 1, "duration_seconds": 18.5, "timeouts_count": 0}

    res = extract_summary(case_def, case_data, 18.5, control_acct, pipeline_acct)
    assert "timings" in res
    assert res["timings"]["control_seconds"] == 3.25
    assert res["timings"]["pipeline_seconds"] == 18.5
    assert res["timings"]["total_seconds"] == 21.75
    assert res["total_wall_clock_seconds"] == 21.75
    assert res["account"]["timings"]["total_seconds"] == 21.75


def test_run_control_sync_cached_execution_time(tmp_path: Path):
    case_def = {"id": "cached-case", "band": "A", "raw_input": "Proposal"}
    control_file = tmp_path / "cached-case.control.md"
    control_file.write_text(
        "# Control Run — cached-case\n\n"
        "**Proposition:**\n> Proposal\n\n"
        "**Execution Time:** 12.34s\n"
        "**Date:** 2026-09-07T12:00:00Z\n\n"
        "## Vanilla Gemini Response\n\nDetailed analysis here...\n",
        encoding="utf-8",
    )

    res = run_control_sync(case_def, tmp_path)
    assert res["status"] == "cached"
    assert res["duration_seconds"] == 12.34


@pytest.mark.asyncio
async def test_run_baseline_expert_prompt_with_context():
    from unittest.mock import AsyncMock
    from core.baseline import run_baseline

    mock_provider = AsyncMock()
    mock_provider.generate.return_value = "Detailed expert evaluation"

    ans = await run_baseline(
        raw_input="We will move our team to Notion over one weekend.",
        provider=mock_provider,
        context="Historical Confluence export contains 2,500 pages with complex Jira macros.",
    )

    assert ans == "Detailed expert evaluation"
    call_args = mock_provider.generate.call_args[1]
    system_prompt = call_args["system_prompt"]
    messages = call_args["messages"]

    # Verify expert prompt elements
    assert "principal decision analyst" in system_prompt
    assert "Load-Bearing Assumptions" in system_prompt
    assert "Critical Failure Modes" in system_prompt
    assert "scraped web context" in system_prompt

    # Verify user message incorporates context
    user_content = messages[0]["content"]
    assert "Notion over one weekend" in user_content
    assert "Historical Confluence export contains 2,500 pages" in user_content
    assert "Background & Reference Context" in user_content

