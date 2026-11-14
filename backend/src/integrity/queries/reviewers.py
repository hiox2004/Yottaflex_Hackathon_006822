"""Reviewers (staff accounts), rule versions and the facts needed to judge a reviewer for a case."""

from typing import Any

import psycopg

Row = dict[str, Any]

CONFLICT_FACTS_SQL = """
WITH target AS (
    SELECT s.learner_id
    FROM integrity_case c
    JOIN similarity_report r ON r.similarity_report_id = c.similarity_report_id
    JOIN submission s ON s.submission_id = r.submission_id
    WHERE c.case_id = %(case_id)s
), other_cases AS (
    SELECT c2.case_id
    FROM integrity_case c2
    JOIN similarity_report r2 ON r2.similarity_report_id = c2.similarity_report_id
    JOIN submission s2 ON s2.submission_id = r2.submission_id
    JOIN target t ON t.learner_id = s2.learner_id
    WHERE c2.case_id <> %(case_id)s
)
SELECT r.reviewer_id, r.name, r.role, r.department,
       -- on_case uses case_reviewer (ALL rows, recused included): a recused reviewer
       -- stays "on the case" for re-assignment and cannot be added back.
       EXISTS (SELECT 1 FROM case_reviewer cr
               WHERE cr.case_id = %(case_id)s AND cr.reviewer_id = r.reviewer_id) AS on_case,
       EXISTS (SELECT 1 FROM decision d
               WHERE d.case_id = %(case_id)s AND d.reviewer_id = r.reviewer_id) AS decided_case,
       -- reviewed_learner_before uses the active view: a case where this reviewer recused does not
       -- count as having reviewed the learner before. Appeal reviewers are unaffected by recusal.
       (EXISTS (SELECT 1 FROM v_case_active_reviewer cr
                WHERE cr.reviewer_id = r.reviewer_id
                  AND cr.case_id IN (SELECT case_id FROM other_cases))
        OR EXISTS (SELECT 1 FROM appeal a
                   WHERE a.reviewer_id = r.reviewer_id
                     AND a.case_id IN (SELECT case_id FROM other_cases))) AS reviewed_learner_before
FROM reviewer r
WHERE %(reviewer_id)s::text IS NULL OR r.reviewer_id = %(reviewer_id)s
ORDER BY r.reviewer_id
"""


def list_reviewers(con: psycopg.Connection[Row]) -> list[Row]:
    sql = "SELECT reviewer_id, name, role, department FROM reviewer ORDER BY reviewer_id"
    return con.execute(sql).fetchall()


def search_reviewers(con: psycopg.Connection[Row], pattern: str, limit: int) -> list[Row]:
    """Staff whose id, name or department matches the ILIKE pattern, in the /reviewers order."""
    sql = """SELECT reviewer_id, name, role, department FROM reviewer
             WHERE name ILIKE %(p)s OR reviewer_id ILIKE %(p)s OR department ILIKE %(p)s
             ORDER BY reviewer_id LIMIT %(n)s"""
    return con.execute(sql, {"p": pattern, "n": limit}).fetchall()


def get_reviewer(con: psycopg.Connection[Row], reviewer_id: str) -> Row | None:
    sql = "SELECT reviewer_id, name, role, department FROM reviewer WHERE reviewer_id = %s"
    return con.execute(sql, (reviewer_id,)).fetchone()


def list_rules(con: psycopg.Connection[Row]) -> list[Row]:
    sql = """SELECT rule_id, version, log_threshold, review_threshold, priority_threshold,
                    appeal_window_days, effective_from, effective_to
             FROM integrity_rule ORDER BY version"""
    return con.execute(sql).fetchall()


def conflict_facts(
    con: psycopg.Connection[Row], case_id: str, reviewer_id: str | None = None
) -> list[Row]:
    """Per reviewer: on the case, decided it, reviewed another case of the same learner."""
    params = {"case_id": case_id, "reviewer_id": reviewer_id}
    return con.execute(CONFLICT_FACTS_SQL, params).fetchall()
