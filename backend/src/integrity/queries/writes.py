"""Inserts and updates behind the write endpoints (reviewers, evidence, decisions, appeals)."""

from datetime import datetime
from typing import Any

import psycopg

Row = dict[str, Any]


def evidence_ids(con: psycopg.Connection[Row], case_id: str) -> list[str]:
    sql = "SELECT evidence_id FROM evidence_item WHERE case_id = %s ORDER BY evidence_id"
    return [r["evidence_id"] for r in con.execute(sql, (case_id,)).fetchall()]


def decision_ids(con: psycopg.Connection[Row], case_id: str) -> list[str]:
    sql = "SELECT decision_id FROM decision WHERE case_id = %s ORDER BY decision_id"
    return [r["decision_id"] for r in con.execute(sql, (case_id,)).fetchall()]


def has_primary(con: psycopg.Connection[Row], case_id: str) -> bool:
    # Active primaries only: a recused primary no longer counts, so a replacement can be assigned.
    sql = "SELECT 1 FROM v_case_active_reviewer WHERE case_id = %s AND role_in_case = 'primary'"
    return con.execute(sql, (case_id,)).fetchone() is not None


def insert_case_reviewer(con: psycopg.Connection[Row], row: Row) -> None:
    sql = """INSERT INTO case_reviewer
                 (case_id, reviewer_id, role_in_case, assigned_at, assigned_by)
             VALUES (%(case_id)s, %(reviewer_id)s, %(role_in_case)s, %(assigned_at)s,
                     %(assigned_by)s)"""
    con.execute(sql, row)


def insert_evidence(con: psycopg.Connection[Row], row: Row) -> None:
    sql = """INSERT INTO evidence_item (evidence_id, case_id, kind, description, added_at, added_by,
                                        added_by_learner_id)
             VALUES (%(evidence_id)s, %(case_id)s, %(kind)s, %(description)s, %(added_at)s,
                     %(added_by)s, %(added_by_learner_id)s)"""
    con.execute(
        sql, {"added_by_learner_id": None, **row}
    )  # staff callers leave the learner column NULL


def insert_decision(con: psycopg.Connection[Row], row: Row, cited: list[str]) -> None:
    sql = """INSERT INTO decision
                 (decision_id, case_id, reviewer_id, outcome, rationale, decided_at)
             VALUES (%(decision_id)s, %(case_id)s, %(reviewer_id)s, %(outcome)s, %(rationale)s,
                     %(decided_at)s)"""
    con.execute(sql, row)
    for evidence_id in cited:
        con.execute(
            "INSERT INTO decision_evidence (decision_id, evidence_id) VALUES (%s, %s)",
            (row["decision_id"], evidence_id),
        )


def insert_appeal(con: psycopg.Connection[Row], row: Row) -> None:
    sql = """INSERT INTO appeal (appeal_id, case_id, decision_id, grounds, filed_at, filed_by,
                                 filed_by_learner_id)
             VALUES (%(appeal_id)s, %(case_id)s, %(decision_id)s, %(grounds)s, %(filed_at)s,
                     %(filed_by)s, %(filed_by_learner_id)s)"""
    con.execute(sql, row)


def set_appeal_reviewer(con: psycopg.Connection[Row], case_id: str, reviewer_id: str) -> None:
    con.execute("UPDATE appeal SET reviewer_id = %s WHERE case_id = %s", (reviewer_id, case_id))


def set_appeal_outcome(
    con: psycopg.Connection[Row], case_id: str, result: tuple[str, str, datetime]
) -> None:
    """`result` is (outcome, rationale, decided_at)."""
    sql = """UPDATE appeal SET outcome = %s, outcome_rationale = %s, decided_at = %s
             WHERE case_id = %s"""
    con.execute(sql, (*result, case_id))
