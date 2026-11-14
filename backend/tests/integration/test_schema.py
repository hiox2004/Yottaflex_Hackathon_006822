"""Schema smoke test: loads, derived values, id formats, append-only history, views."""

import re

import psycopg
import pytest
from tests.db_schema import schema_name

from integrity.config import REPO_ROOT


def fails(con: psycopg.Connection, sql: str, error: type[psycopg.Error]) -> None:
    """Run `sql` in a savepoint and require it to raise `error`."""
    with pytest.raises(error), con.transaction():
        con.execute(sql)


def test_adjusted_score_is_generated_and_cannot_be_written(con: psycopg.Connection) -> None:
    raw, adjusted = con.execute(
        "SELECT raw_score, adjusted_score FROM similarity_report"
    ).fetchone()
    assert (float(raw), float(adjusted)) == (0.9, 0.75)
    fails(con, "UPDATE similarity_report SET adjusted_score = 0.1", psycopg.errors.GeneratedAlways)


@pytest.mark.parametrize(
    "bad_row",
    [
        "INSERT INTO evidence_item VALUES ('EVD-CAS-2026-000009-001', 'CAS-2026-000001',"
        " 'matched_passage', 'x', now(), NULL)",
        "INSERT INTO decision VALUES ('DEC-CAS-2026-000001-1', 'CAS-2026-000001', NULL,"
        " 'no_violation', 'x', now())",
        "INSERT INTO submission VALUES ('SUB-2025-000002', 'LRN-000001', 'ASM-000001',"
        " 1, now(), 10)",
        "INSERT INTO similarity_report VALUES ('SIM-wrong', 'SUB-2026-000001', 'INT-2026-000001',"
        " .5, 0, 0, DEFAULT, now())",
        "INSERT INTO similarity_report VALUES ('SIM-SUB-2026-000002-01', 'SUB-2026-000001',"
        " 'INT-2026-000001', .5, .4, .4, DEFAULT, now())",
    ],
)
def test_id_formats_and_arithmetic_are_checked(con: psycopg.Connection, bad_row: str) -> None:
    fails(con, bad_row, psycopg.errors.CheckViolation)


@pytest.mark.parametrize(
    "change",
    [
        "UPDATE case_event SET reason = 'x'",
        "DELETE FROM evidence_item",
        "UPDATE case_reviewer SET role_in_case = 'secondary'",
        "UPDATE integrity_rule SET appeal_window_days = 30",
        "TRUNCATE case_event CASCADE",
    ],
)
def test_history_tables_are_append_only(con: psycopg.Connection, change: str) -> None:
    fails(con, change, psycopg.errors.IntegrityConstraintViolation)


def test_views_derive_status_flag_and_queue(con: psycopg.Connection) -> None:
    assert con.execute("SELECT status, closed_at FROM v_case_status").fetchone() == (
        "under_review",
        None,
    )
    flag = con.execute("SELECT band, outcome, dismissal_reason FROM v_flag").fetchone()
    assert flag == ("review", "case_opened", None)
    queue = con.execute(
        "SELECT band, status, assignee_ids, effective_outcome FROM v_case_queue"
    ).fetchone()
    assert queue == ("review", "under_review", ["REV-000002"], None)


def test_recusal_event_hides_the_reviewer_from_active_views(con: psycopg.Connection) -> None:
    case_id, reviewer_id = con.execute(
        "SELECT case_id, reviewer_id FROM case_reviewer ORDER BY case_id, reviewer_id LIMIT 1"
    ).fetchone()
    queue_sql = "SELECT assignee_ids FROM v_case_queue WHERE case_id = %s"
    active_sql = "SELECT count(*) FROM v_case_active_reviewer WHERE case_id = %s"
    assert reviewer_id in con.execute(queue_sql, (case_id,)).fetchone()[0]
    con.execute(
        "INSERT INTO case_event (case_id, event_type, occurred_at, actor_id, ref_id, reason)"
        " VALUES (%s, 'reviewer_recused', now(), %s, %s, 'conflict of interest')",
        (case_id, reviewer_id, reviewer_id),
    )
    assert reviewer_id not in con.execute(queue_sql, (case_id,)).fetchone()[0]
    assert con.execute(active_sql, (case_id,)).fetchone()[0] == 0
    # case_reviewer is insert-only: the assignment row itself is still there.
    kept = con.execute("SELECT count(*) FROM case_reviewer WHERE case_id = %s", (case_id,))
    assert kept.fetchone()[0] >= 1


def test_dismissed_flag_gets_the_larger_exclusion_as_reason(con: psycopg.Connection) -> None:
    con.execute(
        "INSERT INTO submission VALUES ('SUB-2026-000002', 'LRN-000001', 'ASM-000001', 2, now(), 9)"
    )
    con.execute(
        "INSERT INTO similarity_report VALUES ('SIM-SUB-2026-000002-01', 'SUB-2026-000002',"
        " 'INT-2026-000001', 0.700, 0.050, 0.500, DEFAULT, now())"
    )
    row = con.execute(
        "SELECT band, outcome, dismissal_reason FROM v_flag WHERE submission_id = 'SUB-2026-000002'"
    )
    assert row.fetchone() == ("no_action", "dismissed", "template_match")


def test_dictionary_lists_every_column_of_every_table(con: psycopg.Connection) -> None:
    text = (REPO_ROOT / "docs" / "DATA_DICTIONARY.md").read_text(encoding="utf-8")
    documented: dict[str, set[str]] = {}
    table = ""
    for line in text.splitlines():
        if line.startswith("### "):
            table = line[4:].strip()
        elif line.startswith("## "):
            table = ""
        elif table and (cell := re.match(r"\| `(\w+)` \|", line)):
            documented.setdefault(table, set()).add(cell.group(1))
    schema = con.execute(
        "SELECT table_name, column_name FROM information_schema.columns c "
        "WHERE table_schema = %(s)s AND table_name IN "
        "(SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' "
        "AND table_schema = %(s)s) ORDER BY 1, 2",
        {"s": schema_name()},
    ).fetchall()
    actual: dict[str, set[str]] = {}
    for table_name, column in schema:
        actual.setdefault(table_name, set()).add(column)
    assert documented == actual
