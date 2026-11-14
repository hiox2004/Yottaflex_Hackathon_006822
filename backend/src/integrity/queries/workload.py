"""Workload for the administrator's overview: queue totals, reviewer load, oldest open cases."""

from typing import Any

import psycopg

Row = dict[str, Any]

STATUS_COUNTS_SQL = """
SELECT status, count(*) AS n FROM v_case_queue GROUP BY status
"""

# Every (reviewer, case, status) a reviewer holds: assigned on the case (active view) or as the
# appeal reviewer. One row per role held, so DISTINCT case counts never double a case.
# Reviewer-role staff only: the people the assign endpoint can ever pick.
REVIEWER_LOAD_SQL = """
WITH holds AS (
    SELECT a.reviewer_id, a.case_id, s.status, true AS assigned, false AS appeal
    FROM v_case_active_reviewer a JOIN v_case_status s ON s.case_id = a.case_id
    UNION ALL
    SELECT ap.reviewer_id, ap.case_id, s.status, false AS assigned, true AS appeal
    FROM appeal ap JOIN v_case_status s ON s.case_id = ap.case_id
    WHERE ap.reviewer_id IS NOT NULL
), load AS (
    SELECT reviewer_id,
           count(DISTINCT case_id) FILTER (
               WHERE status IN ('under_review', 'appeal_review')) AS active_cases,
           count(DISTINCT case_id) FILTER (
               WHERE assigned AND status = 'under_review') AS under_review,
           count(DISTINCT case_id) FILTER (
               WHERE appeal AND status = 'appeal_review') AS appeals_to_decide
    FROM holds GROUP BY reviewer_id
), decided AS (
    SELECT reviewer_id, count(*) AS n FROM decision GROUP BY reviewer_id
), ever AS (
    SELECT reviewer_id, count(*) AS n FROM case_reviewer GROUP BY reviewer_id
)
SELECT r.reviewer_id, r.name, r.role, r.department,
       COALESCE(l.active_cases, 0) AS active_cases,
       COALESCE(l.under_review, 0) AS under_review,
       COALESCE(d.n, 0) AS decided,
       COALESCE(l.appeals_to_decide, 0) AS appeals_to_decide,
       COALESCE(e.n, 0) AS total_assigned_ever
FROM reviewer r
LEFT JOIN load l ON l.reviewer_id = r.reviewer_id
LEFT JOIN decided d ON d.reviewer_id = r.reviewer_id
LEFT JOIN ever e ON e.reviewer_id = r.reviewer_id
WHERE r.role IN ('instructor', 'academic_reviewer')
ORDER BY active_cases DESC, r.name, r.reviewer_id
"""

OLDEST_OPEN_SQL = """
SELECT case_id, learner_name, assessment_title, band, adjusted_score
FROM v_case_queue WHERE status = 'open'
ORDER BY opened_at, case_id LIMIT %(n)s
"""


def status_counts(con: psycopg.Connection[Row]) -> dict[str, int]:
    return {r["status"]: int(r["n"]) for r in con.execute(STATUS_COUNTS_SQL).fetchall()}


def reviewer_load(con: psycopg.Connection[Row]) -> list[Row]:
    return con.execute(REVIEWER_LOAD_SQL).fetchall()


def oldest_open(con: psycopg.Connection[Row], limit: int) -> list[Row]:
    return con.execute(OLDEST_OPEN_SQL, {"n": limit}).fetchall()
