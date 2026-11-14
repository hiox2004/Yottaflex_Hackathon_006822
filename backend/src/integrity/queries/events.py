"""The append-only case timeline."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import psycopg

from integrity import ids

Row = dict[str, Any]


@dataclass(frozen=True)
class NewEvent:
    case_id: str
    event_type: str
    occurred_at: datetime
    actor_id: str | None
    ref_id: str | None = None
    reason: str | None = None
    from_status: str | None = None
    to_status: str | None = None


def timeline(con: psycopg.Connection[Row], case_id: str) -> list[Row]:
    """Events oldest first with the actor's name; actor NULL means the system.

    `detail` says what happened, worded as the frontend labels (labels.ts); NULL for status-only
    events and for ids that no longer resolve. An appeal reviewer event shows the name only for the
    latest assignment: earlier ones are not recorded by reviewer id.
    """
    sql = """SELECT e.case_event_id AS event_id, e.event_type, e.occurred_at,
                    COALESCE(e.actor_id, e.actor_learner_id) AS actor_id,
                    COALESCE(r.name, l.name) AS actor_name, e.from_status, e.to_status, e.ref_id,
                    e.reason,
                    CASE e.event_type
                      WHEN 'decision_recorded' THEN CASE d.outcome
                        WHEN 'no_violation' THEN 'No violation found'
                        WHEN 'violation_confirmed' THEN 'Violation confirmed by reviewer'
                        WHEN 'inconclusive' THEN 'Inconclusive' END
                      WHEN 'evidence_added' THEN CASE ev.kind
                        WHEN 'matched_passage' THEN 'Matched passage'
                        WHEN 'source_reference' THEN 'Source reference'
                        WHEN 'template_match' THEN 'Template match'
                        WHEN 'quote_citation' THEN 'Quote with citation'
                        WHEN 'learner_statement' THEN 'Learner statement' END
                        || ': ' || left(ev.description, 120)
                      WHEN 'reviewer_assigned' THEN assignee.name || ' as ' || cr.role_in_case
                      WHEN 'appeal_reviewer_assigned' THEN appeal_reviewer.name
                      WHEN 'appeal_filed' THEN 'Grounds: ' || left(ap.grounds, 120)
                      WHEN 'appeal_decided' THEN CASE ap.outcome
                        WHEN 'upheld' THEN 'Original decision upheld'
                        WHEN 'overturned' THEN 'Original decision overturned'
                        WHEN 'partially_upheld' THEN 'Partially upheld' END
                    END AS detail
             FROM case_event e
             LEFT JOIN reviewer r ON r.reviewer_id = e.actor_id
             LEFT JOIN learner l ON l.learner_id = e.actor_learner_id
             LEFT JOIN decision d ON e.event_type = 'decision_recorded' AND d.decision_id = e.ref_id
             LEFT JOIN evidence_item ev
               ON e.event_type = 'evidence_added' AND ev.evidence_id = e.ref_id
             LEFT JOIN appeal ap
               ON e.event_type IN ('appeal_filed', 'appeal_reviewer_assigned', 'appeal_decided')
              AND ap.appeal_id = e.ref_id
             LEFT JOIN case_reviewer cr
               ON e.event_type = 'reviewer_assigned' AND cr.case_id = e.case_id
              AND cr.reviewer_id = e.ref_id
             LEFT JOIN reviewer assignee
               ON e.event_type = 'reviewer_assigned' AND assignee.reviewer_id = e.ref_id
             LEFT JOIN reviewer appeal_reviewer
               ON e.event_type = 'appeal_reviewer_assigned'
              AND appeal_reviewer.reviewer_id = ap.reviewer_id
              AND NOT EXISTS (SELECT 1 FROM case_event later
                              WHERE later.case_id = e.case_id
                                AND later.event_type = 'appeal_reviewer_assigned'
                                AND later.case_event_id > e.case_event_id)
             WHERE e.case_id = %s ORDER BY e.occurred_at, e.case_event_id"""
    return con.execute(sql, (case_id,)).fetchall()


def insert(con: psycopg.Connection[Row], event: NewEvent) -> None:
    sql = """INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at,
                                     actor_id, actor_learner_id, ref_id, reason)
             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
    staff_id, learner_id = ids.actor_columns(event.actor_id) if event.actor_id else (None, None)
    params = (
        event.case_id,
        event.event_type,
        event.from_status,
        event.to_status,
        event.occurred_at,
        staff_id,
        learner_id,
        event.ref_id,
        event.reason,
    )
    con.execute(sql, params)
