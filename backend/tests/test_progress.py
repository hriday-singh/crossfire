import pytest
from pathlib import Path
from progress import (
    parse_progress_markdown,
    ProgressSummary,
    TaskItem,
    load_progress,
)

SAMPLE_PROGRESS_MD = """# Crossfire Backend — Progress

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Checkpoint 1 — Hour 11 (Progress Review)

Target: input in, claim extraction, ≥2 tests.

**Status:** `[x]`

## Checkpoint 2 — Hour 35 (Prototype Evaluation)

Target: full loop.

**Status:** `[ ]`

---

## Dev A — Core Loop + Providers

| Task | Status | Notes |
|---|---|---|
| Contracts frozen | `[x]` | locked |
| extract_claims() | `[x]` | done |
| build_test_plan() | `[~]` | in progress |
| reconcile() | `[ ]` | |

## Dev B — Evidence + Researcher

| Task | Status | Notes |
|---|---|---|
| search_evidence() | `[ ]` | |
| researcher.py | `[!]` | blocked on Dev A |

## Dev C — API + SSE + Evaluators

| Task | Status | Notes |
|---|---|---|
| POST /cases | `[x]` | |
| GET /cases/{id} | `[ ]` | |

---

## Blockers / Cross-Team Flags

- Dev B blocked on Dev A provider specs
"""

def test_parse_progress_markdown():
    summary = parse_progress_markdown(SAMPLE_PROGRESS_MD)

    assert isinstance(summary, ProgressSummary)
    assert "Dev A — Core Loop + Providers" in summary.sections
    assert "Dev B — Evidence + Researcher" in summary.sections
    assert "Dev C — API + SSE + Evaluators" in summary.sections

    dev_a = summary.sections["Dev A — Core Loop + Providers"]
    assert dev_a.total == 4
    assert dev_a.done == 2
    assert dev_a.in_progress == 1
    assert dev_a.not_started == 1
    assert dev_a.blocked == 0
    assert dev_a.percent == 50.0

    dev_b = summary.sections["Dev B — Evidence + Researcher"]
    assert dev_b.total == 2
    assert dev_b.done == 0
    assert dev_b.blocked == 1
    assert dev_b.not_started == 1
    assert dev_b.percent == 0.0

    # Overall tasks
    assert summary.total_tasks == 8
    assert summary.done_tasks == 3 # Dev A: 2, Dev C: 1
    assert summary.in_progress_tasks == 1
    assert summary.blocked_tasks == 1
    assert summary.not_started_tasks == 3
    assert summary.percent_done == 37.5

    # Checkpoints
    assert "Checkpoint 1 — Hour 11 (Progress Review)" in summary.checkpoints
    assert summary.checkpoints["Checkpoint 1 — Hour 11 (Progress Review)"] == "done"
    assert summary.checkpoints["Checkpoint 2 — Hour 35 (Prototype Evaluation)"] == "not_started"

    # Blockers
    assert len(summary.blockers) == 1
    assert "Dev B blocked on Dev A provider specs" in summary.blockers[0]


def test_format_summary_output():
    summary = parse_progress_markdown(SAMPLE_PROGRESS_MD)
    output = summary.format_summary(verbose=True)

    assert "Crossfire Backend Progress" in output
    assert "37.5%" in output
    assert "Dev A" in output
    assert "Dev B" in output
    assert "Dev C" in output
    assert "What's Left:" in output
    assert "reconcile()" in output
    assert "search_evidence()" in output


def test_dev_filter():
    summary = parse_progress_markdown(SAMPLE_PROGRESS_MD)
    output_a = summary.format_summary(dev_filter="A")

    assert "Dev A" in output_a
    assert "Dev B" not in output_a
    assert "Dev C" not in output_a


def test_load_progress_from_file(tmp_path: Path):
    test_file = tmp_path / "PROGRESS.md"
    test_file.write_text(SAMPLE_PROGRESS_MD, encoding="utf-8")

    summary = load_progress(test_file)
    assert summary.total_tasks == 8
    assert summary.done_tasks == 3


def test_empty_and_edge_case_markdown():
    empty_summary = parse_progress_markdown("")
    assert empty_summary.total_tasks == 0
    assert empty_summary.percent_done == 0.0
    assert "0.0%" in empty_summary.format_summary()

    malformed = """
## Dev A - Test
| Task | Status |
| Simple task | `[x]` |
| Unknown status | `[?]` |
| Malformed row
"""
    summary = parse_progress_markdown(malformed)
    assert "Dev A - Test" in summary.sections
    section = summary.sections["Dev A - Test"]
    assert section.total == 2
    assert section.done == 1
    assert section.tasks[1].status == "unknown"


def test_to_dict():
    summary = parse_progress_markdown(SAMPLE_PROGRESS_MD)
    data = summary.to_dict()
    assert data["total_tasks"] == 8
    assert data["done_tasks"] == 3
    assert "Dev A — Core Loop + Providers" in data["sections"]
    assert "checkpoints" in data
    assert "blockers" in data


def test_cli_execution(tmp_path: Path, monkeypatch, capsys):
    from progress import main

    test_file = tmp_path / "PROGRESS.md"
    test_file.write_text(SAMPLE_PROGRESS_MD, encoding="utf-8")

    # Test basic output
    monkeypatch.setattr("sys.argv", ["progress.py", "--file", str(test_file)])
    main()
    captured = capsys.readouterr()
    assert "Crossfire Backend Progress: 37.5%" in captured.out

    # Test JSON output
    monkeypatch.setattr("sys.argv", ["progress.py", "--file", str(test_file), "--json"])
    main()
    captured_json = capsys.readouterr()
    import json
    parsed = json.loads(captured_json.out)
    assert parsed["percent_done"] == 37.5

    # Test Dev filter
    monkeypatch.setattr("sys.argv", ["progress.py", "--file", str(test_file), "--dev", "B"])
    main()
    captured_b = capsys.readouterr()
    assert "Dev B" in captured_b.out
    assert "[Dev A —" not in captured_b.out
    assert "- Dev A —" not in captured_b.out


def test_resolved_and_active_blockers_formatting():
    markdown = """# Test
## Dev A — Track
| Task | Status |
| Task 1 | `[x]` |

## Blockers / Flags
- @Dev A — resolved. Fixed issue
- @Dev B — active blocker here
"""
    summary = parse_progress_markdown(markdown)
    assert len(summary.blockers) == 2

    # Normal mode: shows active blocker with ! and hides resolved
    output_normal = summary.format_summary(verbose=False)
    assert "! @Dev B — active blocker here" in output_normal
    assert "✓ @Dev A — resolved. Fixed issue" not in output_normal

    # Verbose mode: shows active blocker and resolved note with ✓
    output_verbose = summary.format_summary(verbose=True)
    assert "! @Dev B — active blocker here" in output_verbose
    assert "✓ @Dev A — resolved. Fixed issue" in output_verbose

    # All resolved scenario
    markdown_resolved = """# Test
## Dev A — Track
| Task | Status |
| Task 1 | `[x]` |

## Blockers / Flags
- @Dev A — resolved. Fixed issue
"""
    summary_resolved = parse_progress_markdown(markdown_resolved)
    output_clean = summary_resolved.format_summary(verbose=False)
    assert "(No active blockers)" in output_clean
    assert "✓" not in output_clean


