"""Write use cases for appeals: file, assign the independent reviewer, decide.

Same pattern as case_service: one transaction, guard from `rules`, row and event together.
`appeal` is the only mutable business table: only the reviewer and the outcome are updated.
"""

from integrity import ids
from integrity.clock import Clock
from integrity.errors import NotFoundError
from integrity.models import Action
from integrity.queries import cases, events, writes
from integrity.queries.events import NewEvent
from integrity.rules import (
    Actor,
    guard_appeal_reassignment,
    guard_assignment,
    independence_reasons,
)
from integrity.schemas import AppealBody, AppealOutcomeBody, AppealReviewerBody, CaseDetail
from integrity.services import read_service
from integrity.services.case_service import begin, step_event
from integrity.services.common import Connection, reviewer_candidates


def file_appeal(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: AppealBody
) -> CaseDetail:
    now = clock.now()
    with con.transaction():
        facts, new_status = begin(con, actor, case_id, Action.FILE_APPEAL, now)
        decision = cases.decisions_of(con, case_id)[-1]
        staff_id, learner_id = ids.actor_columns(actor.reviewer_id)
        appeal_id = ids.appeal_id(case_id)
        writes.insert_appeal(
            con,
            {
                "appeal_id": appeal_id,
                "case_id": case_id,
                "decision_id": decision["decision_id"],
                "grounds": body.grounds,
                "filed_at": now,
                "filed_by": staff_id,
                "filed_by_learner_id": learner_id,
            },
        )
        step = (facts.status, new_status)
        events.insert(
            con,
            step_event(
                NewEvent(case_id, "appeal_filed", now, actor.reviewer_id, ref_id=appeal_id), step
            ),
        )
    return read_service.case_detail(con, actor, case_id, now)


def assign_appeal_reviewer(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: AppealReviewerBody
) -> CaseDetail:
    now = clock.now()
    with con.transaction():
        facts, new_status = begin(con, actor, case_id, Action.ASSIGN_APPEAL_REVIEWER, now)
        candidates = reviewer_candidates(con, case_id, body.reviewer_id)
        if not candidates:
            raise NotFoundError(
                f"We could not find reviewer {body.reviewer_id}. Choose a reviewer from the list."
            )
        guard_appeal_reassignment(body.reviewer_id, facts)
        reasons = independence_reasons(candidates[0][1])
        guard_assignment(reasons, body.reviewer_id, "NOT_INDEPENDENT")
        # A reassignment keeps the old row history: the event says who held the appeal before.
        previous = facts.appeal_reviewer_id
        reason = (
            f"Reassigned from {previous} to {body.reviewer_id} while the appeal is under review."
            if previous
            else None
        )
        writes.set_appeal_reviewer(con, case_id, body.reviewer_id)
        step = (facts.status, new_status)
        appeal_id = ids.appeal_id(case_id)
        events.insert(
            con,
            step_event(
                NewEvent(
                    case_id,
                    "appeal_reviewer_assigned",
                    now,
                    actor.reviewer_id,
                    ref_id=appeal_id,
                    reason=reason,
                ),
                step,
            ),
        )
    return read_service.case_detail(con, actor, case_id, now)


def decide_appeal(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: AppealOutcomeBody
) -> CaseDetail:
    now = clock.now()
    with con.transaction():
        facts, new_status = begin(con, actor, case_id, Action.DECIDE_APPEAL, now)
        writes.set_appeal_outcome(con, case_id, (body.outcome.value, body.rationale, now))
        step = (facts.status, new_status)
        appeal_id = ids.appeal_id(case_id)
        events.insert(
            con,
            step_event(
                NewEvent(case_id, "appeal_decided", now, actor.reviewer_id, ref_id=appeal_id), step
            ),
        )
    return read_service.case_detail(con, actor, case_id, now)
