"""Data-quality checks: each is one SQL query returning (entity_id, detail) for every offending row.

These prove the data is well formed, not that due process was followed: the labelled G1-G4 anomalies are
valid data and must pass here (the auditor finds them). The database already enforces keys, enums, id
formats and the score arithmetic; these checks cover what needs joins or ordering.
"""

# Long SQL lines read better unwrapped; S608: only module constants are interpolated, never input.
# ruff: noqa: E501, S608

from dataclasses import dataclass
from typing import Any

import psycopg

EVENT_TRANSITIONS = """
    (VALUES ('case_opened', NULL, 'open'),
            ('reviewer_assigned', 'open', 'under_review'), ('reviewer_assigned', NULL, NULL),
            ('evidence_added', NULL, NULL),
            ('reviewer_recused', NULL, NULL),
            ('decision_recorded', 'under_review', 'decided'),
            ('case_reopened', 'decided', 'under_review'),
            ('appeal_filed', 'decided', 'appealed'),
            ('appeal_reviewer_assigned', 'appealed', 'appeal_review'),
            ('appeal_reviewer_assigned', 'appeal_review', 'appeal_review'),
            ('appeal_decided', 'appeal_review', 'appeal_decided'),
            ('case_closed', 'decided', 'closed'), ('case_closed', 'appeal_decided', 'closed'))
    AS legal(event_type, from_status, to_status)
"""

# One row per broken ordering rule; the order is the lifecycle in the brief.
DATE_ORDER_SQL = """
SELECT r.similarity_report_id, 'generated before submission' FROM similarity_report r
  JOIN submission s USING (submission_id) WHERE r.generated_at < s.submitted_at
UNION ALL
SELECT c.case_id, 'opened before report generated' FROM integrity_case c
  JOIN similarity_report r USING (similarity_report_id) WHERE c.opened_at < r.generated_at
UNION ALL
SELECT e.case_event_id::text, e.event_type || ' before case opened' FROM case_event e
  JOIN integrity_case c USING (case_id) WHERE e.occurred_at < c.opened_at
UNION ALL
SELECT cr.case_id || '/' || cr.reviewer_id, 'assigned before case opened' FROM case_reviewer cr
  JOIN integrity_case c USING (case_id) WHERE cr.assigned_at < c.opened_at
UNION ALL
SELECT x.evidence_id, 'evidence added before case opened' FROM evidence_item x
  JOIN integrity_case c USING (case_id) WHERE x.added_at < c.opened_at
UNION ALL
SELECT d.decision_id, 'decided before case opened' FROM decision d
  JOIN integrity_case c USING (case_id) WHERE d.decided_at < c.opened_at
UNION ALL
SELECT a.appeal_id, 'filed before the appealed decision' FROM appeal a
  JOIN decision d USING (decision_id) WHERE a.filed_at < d.decided_at
UNION ALL
SELECT a.appeal_id, 'appeal decided before filed' FROM appeal a WHERE a.decided_at < a.filed_at
UNION ALL
SELECT e.case_event_id::text, 'closed before the appeal was decided' FROM case_event e
  JOIN appeal a USING (case_id) WHERE e.event_type = 'case_closed' AND e.occurred_at < a.decided_at
UNION ALL
SELECT e.case_event_id::text, 'closed before the latest decision' FROM case_event e
  WHERE e.event_type = 'case_closed'
    AND e.occurred_at < (SELECT max(d.decided_at) FROM decision d WHERE d.case_id = e.case_id)
UNION ALL
SELECT e.case_event_id::text, 'event id order disagrees with time' FROM case_event e
  WHERE EXISTS (SELECT 1 FROM case_event p WHERE p.case_id = e.case_id
                AND p.case_event_id < e.case_event_id AND p.occurred_at > e.occurred_at)
"""

STATUS_BACKING_SQL = """
SELECT s.case_id, 'status ' || COALESCE(s.status, 'none') || ' without ' || m.missing
FROM v_case_status s
CROSS JOIN LATERAL (SELECT CASE
  WHEN s.status IS NULL THEN 'any event'
  WHEN s.status <> 'open' AND NOT EXISTS (SELECT 1 FROM case_reviewer r WHERE r.case_id = s.case_id)
    THEN 'a reviewer'
  WHEN s.status IN ('decided', 'appealed', 'appeal_review', 'appeal_decided')
    AND NOT EXISTS (SELECT 1 FROM decision d WHERE d.case_id = s.case_id) THEN 'a decision'
  WHEN s.status IN ('appealed', 'appeal_review', 'appeal_decided')
    AND NOT EXISTS (SELECT 1 FROM appeal a WHERE a.case_id = s.case_id) THEN 'an appeal'
  WHEN s.status = 'appeal_decided'
    AND NOT EXISTS (SELECT 1 FROM appeal a WHERE a.case_id = s.case_id AND a.outcome IS NOT NULL)
    THEN 'an appeal outcome' END AS missing) m
WHERE m.missing IS NOT NULL
"""

EVENT_REFERENCE_SQL = """
SELECT e.case_event_id::text, e.event_type || ' ref ' || COALESCE(e.ref_id, 'NULL') || ' unresolved'
FROM case_event e WHERE
  (e.event_type = 'reviewer_assigned' AND NOT EXISTS (SELECT 1 FROM case_reviewer r
      WHERE r.case_id = e.case_id AND r.reviewer_id = e.ref_id))
  OR (e.event_type = 'reviewer_recused' AND (NOT EXISTS (SELECT 1 FROM case_reviewer r
      WHERE r.case_id = e.case_id AND r.reviewer_id = e.ref_id) OR e.actor_id IS DISTINCT FROM e.ref_id))
  OR (e.event_type = 'evidence_added' AND NOT EXISTS (SELECT 1 FROM evidence_item x
      WHERE x.case_id = e.case_id AND x.evidence_id = e.ref_id))
  OR (e.event_type = 'decision_recorded' AND NOT EXISTS (SELECT 1 FROM decision d
      WHERE d.case_id = e.case_id AND d.decision_id = e.ref_id))
  OR (e.event_type IN ('appeal_filed', 'appeal_reviewer_assigned', 'appeal_decided')
      AND NOT EXISTS (SELECT 1 FROM appeal a WHERE a.case_id = e.case_id AND a.appeal_id = e.ref_id))
"""

RECUSAL_REASON_SQL = """
SELECT e.case_event_id::text, 'reviewer_recused without a reason' FROM case_event e
WHERE e.event_type = 'reviewer_recused' AND btrim(COALESCE(e.reason, '')) = ''
"""

# A recusal is a conflict found before the decision. After a decision it is only possible once the
# case was reopened, so the latest decision before the recusal must have a reopen after it.
RECUSAL_AFTER_DECISION_SQL = """
SELECT r.case_event_id::text, 'reviewer_recused after decision made at ' || last.decided_at
FROM case_event r
JOIN LATERAL (SELECT max(d.occurred_at) AS decided_at FROM case_event d
              WHERE d.case_id = r.case_id AND d.event_type = 'decision_recorded'
                AND d.occurred_at < r.occurred_at) last ON last.decided_at IS NOT NULL
WHERE r.event_type = 'reviewer_recused'
  AND NOT EXISTS (SELECT 1 FROM case_event o WHERE o.case_id = r.case_id AND o.event_type = 'case_reopened'
                  AND o.occurred_at > last.decided_at AND o.occurred_at < r.occurred_at)
"""

TRANSITION_CHAIN_SQL = """
SELECT case_event_id::text,
       'from ' || COALESCE(from_status, '-') || ' but previous reached ' || COALESCE(prev_to, '-')
FROM (SELECT case_event_id, from_status,
             lag(to_status) OVER (PARTITION BY case_id ORDER BY occurred_at, case_event_id) AS prev_to
      FROM case_event WHERE to_status IS NOT NULL) chain
WHERE from_status IS DISTINCT FROM prev_to
"""


@dataclass(frozen=True)
class Violation:
    """One failed data-quality check, located by the offending row."""

    check: str
    entity_id: str
    detail: str


@dataclass(frozen=True)
class Check:
    """A named check and the SQL that lists its violations."""

    name: str
    description: str
    sql: str


CHECKS: tuple[Check, ...] = (
    Check(
        "report_per_submission",
        "every submission has exactly one similarity report (1:1)",
        "SELECT s.submission_id, 'no similarity report' FROM submission s WHERE NOT EXISTS "
        "(SELECT 1 FROM similarity_report r WHERE r.submission_id = s.submission_id)",
    ),
    Check(
        "rule_in_force",
        "the report's rule was in force when the submission was made",
        """SELECT r.similarity_report_id, 'rule ' || r.rule_id || ' not in force at submission time'
           FROM similarity_report r JOIN submission s USING (submission_id)
           JOIN integrity_rule ru ON ru.rule_id = r.rule_id
           WHERE s.submitted_at < ru.effective_from
              OR (ru.effective_to IS NOT NULL AND s.submitted_at >= ru.effective_to)""",
    ),
    Check(
        "rules_do_not_overlap",
        "rule versions have disjoint effective periods",
        """SELECT a.rule_id, 'overlaps ' || b.rule_id FROM integrity_rule a JOIN integrity_rule b
           ON a.rule_id < b.rule_id
          AND a.effective_from < COALESCE(b.effective_to, 'infinity')
          AND b.effective_from < COALESCE(a.effective_to, 'infinity')""",
    ),
    Check(
        "triage_reconciliation",
        "a case exists exactly for flags whose adjusted band is review or priority_review",
        """SELECT f.similarity_report_id, 'flag opens a case by band but none exists' FROM v_flag f
           WHERE f.outcome = 'case_opened'
             AND NOT EXISTS (SELECT 1 FROM integrity_case c
                             WHERE c.similarity_report_id = f.similarity_report_id)
           UNION ALL
           SELECT c.case_id, 'case without a case_opened flag (band below review, or no flag)'
           FROM integrity_case c
           WHERE NOT EXISTS (SELECT 1 FROM v_flag f WHERE f.similarity_report_id = c.similarity_report_id
                                                      AND f.outcome = 'case_opened')""",
    ),
    Check(
        "assessment_instructor_role",
        "an assessment's instructor has the instructor role",
        "SELECT a.assessment_id, 'instructor_id is a ' || r.role FROM assessment a "
        "JOIN reviewer r ON r.reviewer_id = a.instructor_id WHERE r.role <> 'instructor'",
    ),
    Check(
        "id_sequences",
        "evidence (001..), decision (01..) and appeal (-01) suffixes are contiguous per case",
        """SELECT case_id, 'evidence suffixes not 001..n' FROM evidence_item GROUP BY case_id
           HAVING min(right(evidence_id, 3)::int) <> 1 OR max(right(evidence_id, 3)::int) <> count(*)
           UNION ALL
           SELECT case_id, 'decision suffixes not 01..n' FROM decision GROUP BY case_id
           HAVING min(right(decision_id, 2)::int) <> 1 OR max(right(decision_id, 2)::int) <> count(*)
           UNION ALL
           SELECT appeal_id, 'appeal suffix is not -01' FROM appeal WHERE right(appeal_id, 3) <> '-01'""",
    ),
    Check(
        "date_order",
        "submitted <= generated <= opened <= decided <= filed <= appeal decided <= closed",
        DATE_ORDER_SQL,
    ),
    Check(
        "case_opened_event",
        "each case has exactly one case_opened event at its opened_at",
        """SELECT c.case_id, 'case_opened events: ' || count(e.case_event_id) FROM integrity_case c
           LEFT JOIN case_event e ON e.case_id = c.case_id AND e.event_type = 'case_opened'
                                 AND e.occurred_at = c.opened_at
           GROUP BY c.case_id HAVING count(e.case_event_id) <> 1""",
    ),
    Check(
        "transition_pairs",
        "every event's (type, from, to) is a legal lifecycle transition",
        f"""SELECT e.case_event_id::text,
                  e.event_type || ' ' || COALESCE(e.from_status, '-') || ' -> ' || COALESCE(e.to_status, '-')
            FROM case_event e WHERE NOT EXISTS (SELECT 1 FROM {EVENT_TRANSITIONS}
              WHERE legal.event_type = e.event_type
                AND legal.from_status IS NOT DISTINCT FROM e.from_status
                AND legal.to_status IS NOT DISTINCT FROM e.to_status)""",
    ),
    Check(
        "transition_chain",
        "each status-changing event starts from the status the previous one reached",
        TRANSITION_CHAIN_SQL,
    ),
    Check(
        "event_references",
        "event ref_id points at the reviewer, evidence, decision or appeal the event is about",
        EVENT_REFERENCE_SQL,
    ),
    Check(
        "status_matches_rows",
        "the derived status is backed by rows (reviewers, decision, appeal, appeal outcome)",
        STATUS_BACKING_SQL,
    ),
    Check(
        "cited_evidence_same_case",
        "a decision cites only evidence of its own case, added no later than the decision",
        """SELECT de.decision_id || '/' || de.evidence_id, 'cited evidence belongs to ' || x.case_id
           FROM decision_evidence de JOIN decision d USING (decision_id)
           JOIN evidence_item x USING (evidence_id) WHERE x.case_id <> d.case_id
           UNION ALL
           SELECT de.decision_id || '/' || de.evidence_id, 'cited evidence added after the decision'
           FROM decision_evidence de JOIN decision d USING (decision_id)
           JOIN evidence_item x USING (evidence_id)
           WHERE x.case_id = d.case_id AND x.added_at > d.decided_at""",
    ),
    Check(
        "appeal_decision_same_case",
        "an appeal targets a decision of its own case",
        "SELECT a.appeal_id, 'appeals decision of ' || d.case_id FROM appeal a "
        "JOIN decision d USING (decision_id) WHERE d.case_id <> a.case_id",
    ),
    Check(
        "duplicate_evidence",
        "no case holds the same evidence (kind and description) twice",
        "SELECT case_id, 'duplicate ' || kind || ' evidence x' || count(*) FROM evidence_item "
        "GROUP BY case_id, kind, description HAVING count(*) > 1",
    ),
    Check(
        "recusal_has_reason",
        "every reviewer_recused event records a non-blank reason",
        RECUSAL_REASON_SQL,
    ),
    Check(
        "recusal_before_decision_only",
        "no recusal after a decision unless the case was reopened in between",
        RECUSAL_AFTER_DECISION_SQL,
    ),
)


def run_checks(con: psycopg.Connection[Any]) -> list[Violation]:
    """Run every check and return all violations, ordered by check then entity."""
    found: list[Violation] = []
    for check in CHECKS:
        query = f"SELECT * FROM ({check.sql}) v(entity_id, detail) ORDER BY 1, 2"
        found.extend(Violation(check.name, str(row[0]), str(row[1])) for row in con.execute(query))
    return found
