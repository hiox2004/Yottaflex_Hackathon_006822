"""Inserts and id counters behind the Test Lab import: submissions, similarity reports and cases.

Evidence and case events reuse `writes` and `events`. Every counter is read inside the import's
transaction, after `lock_import` has serialised concurrent imports.
"""

from typing import Any

import psycopg

Row = dict[str, Any]


def lock_import(con: psycopg.Connection[Row]) -> None:
    """Advisory lock: one import at a time, so max()+1 counters cannot clash."""
    con.execute("SELECT pg_advisory_xact_lock(hashtext('lab_import'))")


def _next_number(con: psycopg.Connection[Row], sql: str, params: tuple[str, ...] = ()) -> int:
    """A counter query returning one row `n` = the next free number (1 when none yet)."""
    row = con.execute(sql, params).fetchone()
    return int(row["n"]) if row else 1


def learner_ids(con: psycopg.Connection[Row]) -> list[str]:
    sql = "SELECT learner_id FROM learner ORDER BY learner_id"
    return [r["learner_id"] for r in con.execute(sql)]


def assessment_ids(con: psycopg.Connection[Row]) -> list[str]:
    sql = "SELECT assessment_id FROM assessment ORDER BY assessment_id"
    return [r["assessment_id"] for r in con.execute(sql)]


def next_submission_no(con: psycopg.Connection[Row]) -> int:
    sql = "SELECT COALESCE(max(split_part(submission_id, '-', 3)::int), 0) + 1 AS n FROM submission"
    return _next_number(con, sql)


def next_case_no(con: psycopg.Connection[Row]) -> int:
    sql = "SELECT COALESCE(max(split_part(case_id, '-', 3)::int), 0) + 1 AS n FROM integrity_case"
    return _next_number(con, sql)


def next_attempt_no(con: psycopg.Connection[Row], learner_id: str, assessment_id: str) -> int:
    sql = """SELECT COALESCE(max(attempt_no), 0) + 1 AS n FROM submission
             WHERE learner_id = %s AND assessment_id = %s"""
    return _next_number(con, sql, (learner_id, assessment_id))


def insert_submission(con: psycopg.Connection[Row], row: Row) -> None:
    sql = """INSERT INTO submission
                 (submission_id, learner_id, assessment_id, attempt_no, submitted_at, word_count)
             VALUES (%(submission_id)s, %(learner_id)s, %(assessment_id)s, %(attempt_no)s,
                     %(submitted_at)s, %(word_count)s)"""
    con.execute(sql, row)


def insert_report(con: psycopg.Connection[Row], row: Row) -> None:
    sql = """INSERT INTO similarity_report
                 (similarity_report_id, submission_id, rule_id, raw_score, quoted_score,
                  template_score, generated_at)
             VALUES (%(similarity_report_id)s, %(submission_id)s, %(rule_id)s, %(raw_score)s,
                     %(quoted_score)s, %(template_score)s, %(generated_at)s)"""
    con.execute(sql, row)


def insert_case(con: psycopg.Connection[Row], row: Row) -> None:
    sql = """INSERT INTO integrity_case (case_id, similarity_report_id, opened_at)
             VALUES (%(case_id)s, %(similarity_report_id)s, %(opened_at)s)"""
    con.execute(sql, row)
