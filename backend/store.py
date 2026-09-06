"""
Owner: Dev A. SQLite-backed persistent store for Case objects.
Replaces volatile in-memory storage so cases survive process restarts.
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from core.models import Case

# Resolved per connection, not at import: the test suite points SQLITE_DB_PATH at a
# tmp file, and clear() really does DELETE every row — binding the path once at import
# meant `pytest` wiped the developer's actual crossfire.db on every run.
def _db_path() -> Path:
    return Path(os.getenv("SQLITE_DB_PATH", Path(__file__).parent / "crossfire.db"))


_initialized: set[str] = set()


def _get_connection() -> sqlite3.Connection:
    path = str(_db_path())
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    if path not in _initialized:
        _init_schema(conn)
        _initialized.add(path)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cases (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON cases(updated_at)")


def _init_db() -> None:
    _get_connection().close()


def _clear_db() -> None:
    with _get_connection() as conn:
        conn.execute("DELETE FROM cases")


class CaseDict(dict):
    def clear(self) -> None:
        super().clear()
        _clear_db()


_cases: dict[str, Case] = CaseDict()


def get(case_id: str) -> Case | None:
    if case_id in _cases:
        return _cases[case_id]

    with _get_connection() as conn:
        cur = conn.execute("SELECT data FROM cases WHERE id = ?", (case_id,))
        row = cur.fetchone()
        if row:
            case = Case.model_validate_json(row["data"])
            _cases[case_id] = case
            return case

    return None


def set(case: Case) -> None:
    _cases[case.id] = case
    data_json = case.model_dump_json()

    with _get_connection() as conn:
        conn.execute(
            """
            INSERT INTO cases (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                updated_at = CURRENT_TIMESTAMP
            """,
            (case.id, data_json),
        )


def delete(case_id: str) -> None:
    _cases.pop(case_id, None)
    with _get_connection() as conn:
        conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))


def clear() -> None:
    _cases.clear()
