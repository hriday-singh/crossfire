"""
Progress Tracker for Crossfire Backend
Parses PROGRESS.md and provides quick metrics on completed vs remaining tasks.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


STATUS_MAP = {
    "[x]": "done",
    "[X]": "done",
    "[~]": "in_progress",
    "[!]": "blocked",
    "[ ]": "not_started",
}


def _map_status(raw: str) -> str:
    cleaned = raw.strip().replace("`", "")
    if cleaned in STATUS_MAP:
        return STATUS_MAP[cleaned]
    # Check if bracketed
    if cleaned.startswith("[") and cleaned.endswith("]"):
        return "unknown"
    return "not_started"


@dataclass
class TaskItem:
    title: str
    status: str
    raw_status: str = ""
    notes: str = ""
    section: str = ""

    @property
    def name(self) -> str:
        return self.title


@dataclass
class SectionProgress:
    name: str
    tasks: List[TaskItem] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.tasks)

    @property
    def done(self) -> int:
        return sum(1 for t in self.tasks if t.status == "done")

    @property
    def in_progress(self) -> int:
        return sum(1 for t in self.tasks if t.status == "in_progress")

    @property
    def blocked(self) -> int:
        return sum(1 for t in self.tasks if t.status == "blocked")

    @property
    def not_started(self) -> int:
        return sum(1 for t in self.tasks if t.status == "not_started")

    @property
    def percent(self) -> float:
        if self.total == 0:
            return 0.0
        return round((self.done / self.total) * 100.0, 1)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "total": self.total,
            "done": self.done,
            "in_progress": self.in_progress,
            "blocked": self.blocked,
            "not_started": self.not_started,
            "percent": self.percent,
            "tasks": [
                {
                    "title": t.title,
                    "status": t.status,
                    "raw_status": t.raw_status,
                    "notes": t.notes,
                }
                for t in self.tasks
            ],
        }


# Alias for backward compatibility
SectionSummary = SectionProgress


@dataclass
class ProgressSummary:
    sections: Dict[str, SectionProgress] = field(default_factory=dict)
    checkpoints: Dict[str, str] = field(default_factory=dict)
    blockers: List[str] = field(default_factory=list)

    @property
    def total_tasks(self) -> int:
        return sum(s.total for s in self.sections.values())

    @property
    def done_tasks(self) -> int:
        return sum(s.done for s in self.sections.values())

    @property
    def in_progress_tasks(self) -> int:
        return sum(s.in_progress for s in self.sections.values())

    @property
    def blocked_tasks(self) -> int:
        return sum(s.blocked for s in self.sections.values())

    @property
    def not_started_tasks(self) -> int:
        return sum(s.not_started for s in self.sections.values())

    @property
    def percent_done(self) -> float:
        if self.total_tasks == 0:
            return 0.0
        return round((self.done_tasks / self.total_tasks) * 100.0, 1)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_tasks": self.total_tasks,
            "done_tasks": self.done_tasks,
            "in_progress_tasks": self.in_progress_tasks,
            "blocked_tasks": self.blocked_tasks,
            "not_started_tasks": self.not_started_tasks,
            "percent_done": self.percent_done,
            "checkpoints": self.checkpoints,
            "sections": {name: s.to_dict() for name, s in self.sections.items()},
            "blockers": self.blockers,
        }

    def format_summary(
        self, verbose: bool = True, dev_filter: Optional[str] = None
    ) -> str:
        lines: List[str] = []
        lines.append("==================================================")
        lines.append(
            f"Crossfire Backend Progress: {self.percent_done}% ({self.done_tasks}/{self.total_tasks} tasks done)"
        )
        lines.append("==================================================")
        lines.append(
            f"In Progress: {self.in_progress_tasks} | Blocked: {self.blocked_tasks} | Not Started: {self.not_started_tasks}"
        )

        filter_letter = dev_filter.strip().upper() if dev_filter else None

        # Filter sections if dev_filter is supplied
        target_sections: Dict[str, SectionProgress] = {}
        for name, s in self.sections.items():
            if filter_letter:
                if f"Dev {filter_letter}" in name or name.startswith(f"Dev {filter_letter}"):
                    target_sections[name] = s
            else:
                target_sections[name] = s

        # Checkpoints
        if not filter_letter and self.checkpoints:
            lines.append("\n--- Checkpoints ---")
            for cp_name, cp_status in self.checkpoints.items():
                mark = "[x]" if cp_status == "done" else "[ ]"
                lines.append(f"{mark} {cp_name}: {cp_status}")

        # Section status
        lines.append("\n--- Section Breakdown ---")
        for name, s in target_sections.items():
            lines.append(
                f"- {name}: {s.percent}% ({s.done}/{s.total} done, {s.in_progress} in progress, {s.blocked} blocked, {s.not_started} not started)"
            )

        # What's left
        lines.append("\n--- What's Left: ---")
        has_pending = False
        for name, s in target_sections.items():
            pending_tasks = [t for t in s.tasks if t.status != "done"]
            if pending_tasks:
                has_pending = True
                lines.append(f"\n[{name}]")
                for t in pending_tasks:
                    note_str = f" (Notes: {t.notes})" if t.notes else ""
                    lines.append(f"  {t.raw_status} {t.title} [{t.status}]{note_str}")

        if not has_pending:
            lines.append("  (All tasks complete!)")

        # Blockers
        if self.blockers and not filter_letter:
            lines.append("\n--- Blockers & Flags ---")
            active_blockers = [
                b for b in self.blockers if "resolved" not in b.lower()
            ]
            resolved_blockers = [
                b for b in self.blockers if "resolved" in b.lower()
            ]

            if not active_blockers:
                lines.append("  (No active blockers)")
                if verbose:
                    for b in resolved_blockers:
                        lines.append(f"  ✓ {b}")
            else:
                for b in active_blockers:
                    lines.append(f"  ! {b}")
                if verbose and resolved_blockers:
                    for b in resolved_blockers:
                        lines.append(f"  ✓ {b}")

        return "\n".join(lines)


def parse_progress_markdown(content: str) -> ProgressSummary:
    summary = ProgressSummary()
    current_section: Optional[str] = None
    current_checkpoint: Optional[str] = None
    in_blockers = False

    lines = content.splitlines()
    for line in lines:
        stripped = line.strip()

        # Checkpoint header
        checkpoint_match = re.match(r"^##\s+(Checkpoint\s+\d+.*)", stripped)
        if checkpoint_match:
            current_checkpoint = checkpoint_match.group(1).strip()
            current_section = None
            in_blockers = False
            continue

        # Checkpoint status line
        if current_checkpoint and "**Status:**" in stripped:
            status_match = re.search(r"\*\*Status:\*\*\s*`(\[[^\]]*\])`", stripped)
            if status_match:
                raw = status_match.group(1)
                summary.checkpoints[current_checkpoint] = _map_status(raw)
            continue

        # Section header (e.g. ## Dev A — Core Loop + Providers)
        section_match = re.match(r"^##\s+(Dev\s+[A-Z].*)", stripped)
        if section_match:
            current_section = section_match.group(1).strip()
            current_checkpoint = None
            in_blockers = False
            if current_section not in summary.sections:
                summary.sections[current_section] = SectionProgress(name=current_section)
            continue

        # Blockers section header
        if re.match(r"^##\s+Blockers.*", stripped):
            in_blockers = True
            current_section = None
            current_checkpoint = None
            continue

        # Table rows within a section
        if current_section and stripped.startswith("|"):
            parts = [p.strip() for p in stripped.strip("|").split("|")]
            if len(parts) >= 2:
                task_title = parts[0]
                status_col = parts[1]
                notes = parts[2] if len(parts) > 2 else ""

                # Ignore table header and separator
                if task_title.lower() == "task" or "---" in task_title or "---" in status_col:
                    continue

                # Extract status bracket
                status_match = re.search(r"(\[[^\]]*\])", status_col)
                if status_match:
                    raw_status = status_match.group(1)
                    parsed_status = _map_status(raw_status)
                    task = TaskItem(
                        title=task_title,
                        status=parsed_status,
                        raw_status=raw_status,
                        notes=notes,
                        section=current_section,
                    )
                    summary.sections[current_section].tasks.append(task)
            continue

        # Blocker items
        if in_blockers:
            if stripped.startswith("-") or stripped.startswith("*"):
                blocker_text = stripped.lstrip("-*").strip()
                if blocker_text and not blocker_text.lower().startswith("(none"):
                    summary.blockers.append(blocker_text)

    return summary


def load_progress(file_path: Optional[Path | str] = None) -> ProgressSummary:
    target: Optional[Path] = None
    if file_path:
        target = Path(file_path)
    else:
        # Default search locations
        candidates = [
            Path("PROGRESS.md"),
            Path("backend/PROGRESS.md"),
            Path(__file__).parent / "PROGRESS.md",
            Path(__file__).parent.parent / "backend" / "PROGRESS.md",
        ]
        for c in candidates:
            if c.exists() and c.is_file():
                target = c
                break

    if not target or not target.exists():
        raise FileNotFoundError(
            f"PROGRESS.md not found. Looked in {[str(c) for c in (candidates if not file_path else [Path(file_path)])]}"
        )

    content = target.read_text(encoding="utf-8")
    return parse_progress_markdown(content)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(
        description="Check progress and remaining tasks for Crossfire backend."
    )
    parser.add_argument(
        "-f",
        "--file",
        help="Path to PROGRESS.md (defaults to looking in backend/PROGRESS.md)",
        default=None,
    )
    parser.add_argument(
        "-d",
        "--dev",
        help="Filter by developer (A, B, or C)",
        default=None,
    )
    parser.add_argument(
        "-v",
        "--verbose",
        "-a",
        "--all",
        action="store_true",
        help="Show detailed list of all tasks including pending tasks",
    )
    parser.add_argument(
        "-j",
        "--json",
        action="store_true",
        help="Output progress metrics as JSON",
    )

    args = parser.parse_args()

    try:
        summary = load_progress(args.file)
    except Exception as e:
        print(f"Error loading progress: {e}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(summary.to_dict(), indent=2))
    else:
        print(summary.format_summary(verbose=args.verbose, dev_filter=args.dev))


if __name__ == "__main__":
    main()
