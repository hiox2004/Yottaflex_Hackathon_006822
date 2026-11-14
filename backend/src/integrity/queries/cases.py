"""Cases: the queue, the facts the guards need, the detail pieces and the row lock for writes."""

from typing import Any

import psycopg

Row = dict[str, Any]

FACTS_SQL = """
SELECT q.case_id, q.learner_id, q.learner_name, q.assessment_title, q.adjusted_score, q.band,
       q.status, q.assignee_ids, q.opened_at, ru.appeal_window_days,
       ld.outcome AS latest_outcome, ld.decided_at AS latest_decision_at,
       ap.case_id IS NOT NULL AS appeal_filed, ap.reviewer_id AS appeal_reviewer_id
FROM v_case_queue q
JOIN integrity_case c ON c.case_id = q.case_id
JOIN similarity_report r ON r.similarity_report_id = c.similarity_report_id
JOIN integrity_rule ru ON ru.rule_id = r.rule_id
LEFT JOIN appeal ap ON ap.case_id = q.case_id
LEFT JOIN LATERAL (
    SELECT d.outcome, d.decided_at FROM decision d WHERE d.case_id = q.case_id
    ORDER BY d.decided_at DESC, d.decision_id DESC LIMIT 1
) ld ON true
"""

HEADER_SQL = """
SELECT c.case_id, c.opened_at, st.status, st.closed_at, qv.effective_outcome,
       l.learner_id, l.name AS learner_name, l.department AS learner_department,
       a.assessment_id, a.title AS assessment_title, a.instructor_id,
       r.similarity_report_id, r.raw_score, r.quoted_score, r.template_score, r.adjusted_score,
       ru.rule_id, ru.version, ru.log_threshold, ru.review_threshold, ru.priority_threshold,
       ru.appeal_window_days, ru.effective_from, ru.effective_to
FROM integrity_case c
JOIN similarity_report r ON r.similarity_report_id = c.similarity_report_id
JOIN integrity_rule ru ON ru.rule_id = r.rule_id
JOIN submission s ON s.submission_id = r.submission_id
JOIN learner l ON l.learner_id = s.learner_id
JOIN assessment a ON a.assessment_id = s.assessment_id
JOIN v_case_status st ON st.case_id = c.case_id
JOIN v_case_queue qv ON qv.case_id = c.case_id
WHERE c.case_id = %s
"""

REVIEWERS_SQL = """
SELECT cr.reviewer_id, rv.name, cr.role_in_case, cr.assigned_at
FROM v_case_active_reviewer cr JOIN reviewer rv ON rv.reviewer_id = cr.reviewer_id
WHERE cr.case_id = %s ORDER BY cr.assigned_at, cr.reviewer_id
"""

RECUSED_SQL = """
SELECT DISTINCT ref_id FROM case_event
WHERE case_id = %s AND event_type = 'reviewer_recused' ORDER BY ref_id
"""

EVIDENCE_SQL = """
SELECT evidence_id, kind, description, added_at,
       COALESCE(added_by, added_by_learner_id) AS added_by
FROM evidence_item WHERE case_id = %s ORDER BY added_at, evidence_id
"""

DECISIONS_SQL = """
SELECT d.decision_id, d.outcome, d.rationale, d.reviewer_id, d.decided_at,
       COALESCE(array_agg(de.evidence_id ORDER BY de.evidence_id)
                FILTER (WHERE de.evidence_id IS NOT NULL), '{}') AS cited_evidence_ids
FROM decision d LEFT JOIN decision_evidence de ON de.decision_id = d.decision_id
WHERE d.case_id = %s GROUP BY d.decision_id ORDER BY d.decided_at, d.decision_id
"""

APPEAL_SQL = """
SELECT appeal_id, decision_id, grounds, filed_at, reviewer_id, outcome, outcome_rationale,
       decided_at
FROM appeal WHERE case_id = %s
"""


def all_facts(con: psycopg.Connection[Row]) -> list[Row]:
    """Every case with the facts the guards need, newest first (about 300 rows, so one query)."""
    return con.execute(FACTS_SQL + " ORDER BY q.opened_at DESC, q.case_id").fetchall()


def facts(con: psycopg.Connection[Row], case_id: str) -> Row | None:
    return con.execute(FACTS_SQL + " WHERE q.case_id = %s", (case_id,)).fetchone()


def lock(con: psycopg.Connection[Row], case_id: str) -> bool:
    """Take the row lock that serialises writes to one case; False when the case does not exist."""
    sql = "SELECT 1 FROM integrity_case WHERE case_id = %s FOR UPDATE"
    return con.execute(sql, (case_id,)).fetchone() is not None


def header(con: psycopg.Connection[Row], case_id: str) -> Row | None:
    return con.execute(HEADER_SQL, (case_id,)).fetchone()


def reviewers_of(con: psycopg.Connection[Row], case_id: str) -> list[Row]:
    """Reviewers still on the case (recused ones are hidden; see recused_reviewer_ids)."""
    return con.execute(REVIEWERS_SQL, (case_id,)).fetchall()


def recused_reviewer_ids(con: psycopg.Connection[Row], case_id: str) -> list[str]:
    """Reviewer ids that recused from the case, sorted. They are not in reviewers_of."""
    return [r["ref_id"] for r in con.execute(RECUSED_SQL, (case_id,)).fetchall()]


def evidence_of(con: psycopg.Connection[Row], case_id: str) -> list[Row]:
    return con.execute(EVIDENCE_SQL, (case_id,)).fetchall()


def decisions_of(con: psycopg.Connection[Row], case_id: str) -> list[Row]:
    return con.execute(DECISIONS_SQL, (case_id,)).fetchall()


def appeal_of(con: psycopg.Connection[Row], case_id: str) -> Row | None:
    return con.execute(APPEAL_SQL, (case_id,)).fetchone()
