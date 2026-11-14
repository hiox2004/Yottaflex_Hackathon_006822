"""Sanity checks: prove the database is loaded, not empty (row checks pass vacuously on zero rows).

Each check returns the same shape as the SQL checks (name, description, violations) plus `examples`.
"""

import json
from typing import Any

import psycopg

from integrity import ids
from integrity.config import REPO_ROOT

CORE_TABLES = (
    "learner", "assessment", "submission", "similarity_report", "integrity_rule", "integrity_case",
    "evidence_item", "reviewer", "decision", "appeal", "case_reviewer", "case_event",
    "decision_evidence",
)  # fmt: skip

# The app can append rows after load (workflow, Test Lab import), so the loaded count is a floor.
APPENDABLE = (
    "integrity_case", "evidence_item", "case_event", "case_reviewer", "decision",
    "decision_evidence", "appeal", "submission", "similarity_report", "flags",
)  # fmt: skip
# Master data is never written by the app, so the loaded count must match exactly.
STATIC = ("learner", "assessment", "reviewer", "integrity_rule")

# Manifest names that are not base tables: `flags` is the v_flag view.
COUNT_SOURCE = {"flags": "v_flag"}

# One (id family, table, column) per ID format (the formats themselves live in integrity.ids).
ID_FAMILIES = (
    ("reviewer", "reviewer", "reviewer_id"),
    ("learner", "learner", "learner_id"),
    ("assessment", "assessment", "assessment_id"),
    ("rule", "integrity_rule", "rule_id"),
    ("submission", "submission", "submission_id"),
    ("report", "similarity_report", "similarity_report_id"),
    ("case", "integrity_case", "case_id"),
    ("evidence", "evidence_item", "evidence_id"),
    ("decision", "decision", "decision_id"),
    ("appeal", "appeal", "appeal_id"),
)


def _result(name: str, description: str, examples: list[str]) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "violations": len(examples),
        "examples": examples[:20],
    }


def _count(con: psycopg.Connection[Any], table: str) -> int:
    source = COUNT_SOURCE.get(table, table)
    return int(con.execute(f"SELECT count(*) FROM {source}").fetchone()[0])  # type: ignore[index]  # noqa: S608


def _tables_not_empty(con: psycopg.Connection[Any]) -> dict[str, Any]:
    empty = [f"{t}: 0 rows" for t in CORE_TABLES if _count(con, t) == 0]
    return _result("tables_not_empty", "every core table holds at least one row", empty)


def _row_counts_match_manifest(con: psycopg.Connection[Any], scale: str) -> dict[str, Any]:
    description = f"row counts match data/{scale}/manifest.json (appendable tables: at least)"
    path = REPO_ROOT / "data" / scale / "manifest.json"
    if not path.is_file():
        return _result("row_counts_match_manifest", description, [f"missing {path.name}"])
    expected: dict[str, int] = json.loads(path.read_text(encoding="utf-8"))["counts"]
    problems: list[str] = []
    for table, want in expected.items():
        if table not in APPENDABLE and table not in STATIC:
            problems.append(f"{table}: not a known table")
            continue
        got = _count(con, table)
        if table in APPENDABLE and got >= want:
            continue
        if table in STATIC and got == want:
            continue
        problems.append(f"{table}: db {got} vs manifest {want}")
    return _result("row_counts_match_manifest", description, problems)


def _ids_follow_scheme_nonempty(con: psycopg.Connection[Any]) -> dict[str, Any]:
    problems: list[str] = []
    for kind, table, column in ID_FAMILIES:
        rows = con.execute(f"SELECT {column} FROM {table}")  # noqa: S608  # module constants only
        if not any(ids.is_valid(kind, str(value)) for (value,) in rows):
            problems.append(f"{kind}: no {table}.{column} matches the {kind} id format")
    return _result(
        "ids_follow_scheme_nonempty", "each id format is matched by at least one row", problems
    )


def run_sanity_checks(
    con: psycopg.Connection[Any], scale: str | None = None
) -> list[dict[str, Any]]:
    """Emptiness, id-format and (with a scale) manifest-count checks. Run them before the rest."""
    checks = [_tables_not_empty(con), _ids_follow_scheme_nonempty(con)]
    if scale:
        checks.insert(1, _row_counts_match_manifest(con, scale))
    return checks
