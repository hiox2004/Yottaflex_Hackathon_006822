"""Due-process detectors, written from the brief and HLD section 4 only, in plain SQL.

Reads the operational tables and nothing else: no rules, services, datagen or ground truth.
Each detector returns rows (case_id, entity_id, detail); `case_id` narrows it to one case.
"""

# ruff: noqa: E501, S608
from dataclasses import dataclass
from typing import Any

import psycopg


@dataclass(frozen=True)
class Finding:
    """One due-process violation, located by its case and the entity that breaks the rule."""

    issue_type: str
    case_id: str
    entity_id: str
    detail: str


# Who a case is about: the learner, their department and the assessment's instructor.
CASE_CONTEXT = """
WITH case_context AS (
    SELECT c.case_id, l.learner_id, l.department AS learner_department, a.instructor_id
    FROM integrity_case c
    JOIN similarity_report r ON r.similarity_report_id = c.similarity_report_id
    JOIN submission s ON s.submission_id = r.submission_id
    JOIN learner l ON l.learner_id = s.learner_id
    JOIN assessment a ON a.assessment_id = s.assessment_id
)
"""

DETECTORS: dict[str, str] = {
    # A violation was confirmed with no human, or by someone not assigned to the case at that time.
    "AUTO_GUILT_WITHOUT_REVIEW": """
        SELECT d.case_id, d.decision_id,
               CASE WHEN d.reviewer_id IS NULL THEN 'violation confirmed with no human reviewer'
                    ELSE 'violation confirmed by ' || d.reviewer_id || ', who was not assigned to the case' END
        FROM decision d
        WHERE d.outcome = 'violation_confirmed'
          AND (d.reviewer_id IS NULL
               OR NOT EXISTS (SELECT 1 FROM case_reviewer cr
                              WHERE cr.case_id = d.case_id AND cr.reviewer_id = d.reviewer_id
                                AND cr.assigned_at <= d.decided_at))
          AND (%(case_id)s::text IS NULL OR d.case_id = %(case_id)s)
    """,
    # An assigned reviewer teaches the assessment, shares the learner's department, or reviewed
    # an earlier case of the same learner. Reviewing a different learner is not a conflict.
    "REVIEWER_CONFLICT": CASE_CONTEXT
    + """
        SELECT cc.case_id, cr.reviewer_id, why.reasons
        FROM case_reviewer cr
        JOIN case_context cc ON cc.case_id = cr.case_id
        JOIN reviewer rv ON rv.reviewer_id = cr.reviewer_id
        CROSS JOIN LATERAL (SELECT concat_ws('; ',
            CASE WHEN cc.instructor_id = cr.reviewer_id THEN 'teaches the assessment' END,
            CASE WHEN rv.department = cc.learner_department THEN 'same department as the learner' END,
            CASE WHEN EXISTS (
                   SELECT 1 FROM case_reviewer earlier
                   JOIN case_context other ON other.case_id = earlier.case_id
                   WHERE earlier.reviewer_id = cr.reviewer_id AND other.learner_id = cc.learner_id
                     AND earlier.case_id <> cr.case_id
                     AND (earlier.assigned_at, earlier.case_id) < (cr.assigned_at, cr.case_id))
                 THEN 'already reviewed an earlier case of this learner' END) AS reasons) why
        WHERE why.reasons <> ''
          AND (%(case_id)s::text IS NULL OR cc.case_id = %(case_id)s)
    """,
    # Evidence is newer than the latest decision before it, and the case was not reopened in between.
    "EVIDENCE_AFTER_DECISION_NO_HISTORY": """
        SELECT x.case_id, x.evidence_id,
               'evidence added after decision ' || d.decision_id || ' with no reopen event in between'
        FROM evidence_item x
        JOIN LATERAL (SELECT p.decision_id, p.decided_at FROM decision p
                      WHERE p.case_id = x.case_id AND p.decided_at < x.added_at
                      ORDER BY p.decided_at DESC, p.decision_id DESC LIMIT 1) d ON true
        WHERE NOT EXISTS (SELECT 1 FROM case_event e
                          WHERE e.case_id = x.case_id AND e.event_type = 'case_reopened'
                            AND e.occurred_at > d.decided_at AND e.occurred_at <= x.added_at)
          AND (%(case_id)s::text IS NULL OR x.case_id = %(case_id)s)
    """,
    # The case was closed after an appeal whose reviewer is missing or not independent: assigned to the
    # case, author of one of its decisions, teaches the assessment, shares the learner's department,
    # or has reviewed this learner on any case.
    "APPEAL_CLOSED_NO_INDEPENDENT_REVIEW": CASE_CONTEXT
    + """
        SELECT ap.case_id, ap.appeal_id,
               CASE WHEN ap.reviewer_id IS NULL THEN 'closed after an appeal decided with no reviewer'
                    ELSE 'closed after an appeal decided by ' || ap.reviewer_id || ', who is not independent' END
        FROM appeal ap
        JOIN case_context cc ON cc.case_id = ap.case_id
        LEFT JOIN reviewer rv ON rv.reviewer_id = ap.reviewer_id
        WHERE ap.outcome IS NOT NULL
          AND EXISTS (SELECT 1 FROM case_event e WHERE e.case_id = ap.case_id AND e.event_type = 'case_closed')
          AND (ap.reviewer_id IS NULL
               OR cc.instructor_id = ap.reviewer_id
               OR rv.department = cc.learner_department
               OR EXISTS (SELECT 1 FROM case_reviewer cr WHERE cr.case_id = ap.case_id AND cr.reviewer_id = ap.reviewer_id)
               OR EXISTS (SELECT 1 FROM decision d WHERE d.case_id = ap.case_id AND d.reviewer_id = ap.reviewer_id)
               OR EXISTS (SELECT 1 FROM case_reviewer earlier
                          JOIN case_context other ON other.case_id = earlier.case_id
                          WHERE earlier.reviewer_id = ap.reviewer_id AND other.learner_id = cc.learner_id))
          AND (%(case_id)s::text IS NULL OR ap.case_id = %(case_id)s)
    """,
}


def audit(con: psycopg.Connection[Any], case_id: str | None = None) -> list[Finding]:
    """Run the four detectors (optionally for one case); findings ordered by type, case and entity."""
    findings: list[Finding] = []
    for issue_type, sql in DETECTORS.items():
        query = f"SELECT * FROM ({sql}) f(case_id, entity_id, detail) ORDER BY 1, 2"
        rows = con.execute(query, {"case_id": case_id}).fetchall()
        findings.extend(Finding(issue_type, str(c), str(e), str(d)) for c, e, d in rows)
    return findings
