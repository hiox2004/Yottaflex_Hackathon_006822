"""Write use cases on a case: assign reviewer, add evidence, reopen, decide, close.

Every write is one transaction: lock the case row, read fresh facts, check the guard from
`rules`, insert the row and its case_event together. The response is the updated CaseDetail.
"""

from dataclasses import replace
from datetime import datetime

from integrity import ids
from integrity.clock import Clock
from integrity.errors import NotFoundError, RuleViolation
from integrity.models import Action, Status
from integrity.queries import cases, events, writes
from integrity.queries.events import NewEvent
from integrity.rules import (
    Actor,
    CaseFacts,
    conflict_reasons,
    guard,
    guard_assignment,
    guard_cited_evidence,
    guard_evidence_kind,
)
from integrity.schemas import (
    AssignReviewerBody,
    CaseDetail,
    DecisionBody,
    EvidenceBody,
    ReopenBody,
)
from integrity.services import read_service
from integrity.services.common import Connection, case_facts, reviewer_candidates


def begin(
    con: Connection, actor: Actor, case_id: str, action: Action, now: datetime
) -> tuple[CaseFacts, Status]:
    """Inside a transaction: lock the case, read its facts and check the action's guard."""
    if not cases.lock(con, case_id):
        raise NotFoundError(f"Case {case_id} does not exist.")
    facts = case_facts(con, case_id)
    return facts, guard(action, actor, facts, now)


def step_event(event: NewEvent, step: tuple[Status, Status]) -> NewEvent:
    """Mark `event` as a status change: `step` is (from, to)."""
    return replace(event, from_status=step[0].value, to_status=step[1].value)


def assign_reviewer(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: AssignReviewerBody
) -> CaseDetail:
    now = clock.now()
    with con.transaction():
        facts, new_status = begin(con, actor, case_id, Action.ASSIGN_REVIEWER, now)
        candidates = reviewer_candidates(con, case_id, body.reviewer_id)
        if not candidates:
            raise NotFoundError(f"Reviewer {body.reviewer_id} does not exist.")
        guard_assignment(
            conflict_reasons(candidates[0][1]), body.reviewer_id, "CONFLICT_OF_INTEREST"
        )
        if body.role_in_case == "primary" and writes.has_primary(con, case_id):
            raise RuleViolation("VALIDATION_ERROR", "This case already has a primary reviewer.")
        writes.insert_case_reviewer(
            con,
            {
                "case_id": case_id,
                "reviewer_id": body.reviewer_id,
                "role_in_case": body.role_in_case,
                "assigned_at": now,
                "assigned_by": actor.reviewer_id,
            },
        )
        first = facts.status is Status.OPEN  # only the first assignment changes the status
        events.insert(
            con,
            NewEvent(
                case_id,
                "reviewer_assigned",
                now,
                actor.reviewer_id,
                ref_id=body.reviewer_id,
                from_status=facts.status.value if first else None,
                to_status=new_status.value if first else None,
            ),
        )
    return read_service.case_detail(con, actor, case_id, now)


def add_evidence(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: EvidenceBody
) -> CaseDetail:
    now = clock.now()
    with con.transaction():
        begin(con, actor, case_id, Action.ADD_EVIDENCE, now)
        guard_evidence_kind(actor, body.kind)
        evidence_id = ids.evidence_id(case_id, ids.next_suffix(writes.evidence_ids(con, case_id)))
        writes.insert_evidence(
            con,
            {
                "evidence_id": evidence_id,
                "case_id": case_id,
                "kind": body.kind.value,
                "description": body.description,
                "added_at": now,
                "added_by": actor.reviewer_id,
            },
        )
        events.insert(
            con, NewEvent(case_id, "evidence_added", now, actor.reviewer_id, ref_id=evidence_id)
        )
    return read_service.case_detail(con, actor, case_id, now)


def reopen(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: ReopenBody
) -> CaseDetail:
    now = clock.now()
    with con.transaction():
        facts, new_status = begin(con, actor, case_id, Action.REOPEN, now)
        events.insert(
            con,
            step_event(
                NewEvent(case_id, "case_reopened", now, actor.reviewer_id, reason=body.reason),
                (facts.status, new_status),
            ),
        )
    return read_service.case_detail(con, actor, case_id, now)


def decide(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: DecisionBody
) -> CaseDetail:
    now = clock.now()
    with con.transaction():
        facts, new_status = begin(con, actor, case_id, Action.DECIDE, now)
        guard_cited_evidence(body.cited_evidence_ids, writes.evidence_ids(con, case_id))
        decision_id = ids.decision_id(case_id, ids.next_suffix(writes.decision_ids(con, case_id)))
        writes.insert_decision(
            con,
            {
                "decision_id": decision_id,
                "case_id": case_id,
                "reviewer_id": actor.reviewer_id,
                "outcome": body.outcome.value,
                "rationale": body.rationale,
                "decided_at": now,
            },
            sorted(set(body.cited_evidence_ids)),
        )
        step = (facts.status, new_status)
        events.insert(
            con,
            step_event(
                NewEvent(case_id, "decision_recorded", now, actor.reviewer_id, ref_id=decision_id),
                step,
            ),
        )
    return read_service.case_detail(con, actor, case_id, now)


def close(con: Connection, clock: Clock, actor: Actor, case_id: str) -> CaseDetail:
    now = clock.now()
    with con.transaction():
        facts, new_status = begin(con, actor, case_id, Action.CLOSE, now)
        events.insert(
            con,
            step_event(
                NewEvent(case_id, "case_closed", now, actor.reviewer_id), (facts.status, new_status)
            ),
        )
    return read_service.case_detail(con, actor, case_id, now)
