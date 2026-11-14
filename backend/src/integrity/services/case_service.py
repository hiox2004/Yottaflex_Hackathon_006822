"""Write use cases on a case: assign reviewer, add evidence, reopen, recuse, decide, close.

Every write is one transaction: lock the case row, read fresh facts, check the guard from
`rules`, insert the row and its case_event together. The response is the updated CaseDetail.
"""

from dataclasses import replace
from datetime import datetime

from integrity import ids
from integrity.clock import Clock
from integrity.errors import NotFoundError, RuleViolation
from integrity.models import Action, EvidenceKind, Status
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
from integrity.rules.lifecycle import guard_confirmed_violation, guard_recusal_reason
from integrity.schemas import (
    AssignReviewerBody,
    CaseDetail,
    CloseBody,
    DecisionBody,
    EvidenceBody,
    RecuseBody,
    ReopenBody,
)
from integrity.services import read_service
from integrity.services.common import Connection, case_facts, reviewer_candidates


def begin(  # noqa: PLR0913 - the waiver flag is the only addition to the guard's inputs
    con: Connection,
    actor: Actor,
    case_id: str,
    action: Action,
    now: datetime,
    *,
    waived: bool = False,
) -> tuple[CaseFacts, Status]:
    """Inside a transaction: lock the case, read its facts and check the action's guard."""
    if not cases.lock(con, case_id):
        raise NotFoundError(
            f"We could not find case {case_id}. Check the case number and try again."
        )
    facts = case_facts(con, case_id)
    return facts, guard(action, actor, facts, now, waived=waived)


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
            raise NotFoundError(
                f"We could not find reviewer {body.reviewer_id}. Choose a reviewer from the list."
            )
        guard_assignment(
            conflict_reasons(candidates[0][1]), body.reviewer_id, "CONFLICT_OF_INTEREST"
        )
        if body.role_in_case == "primary" and writes.has_primary(con, case_id):
            raise RuleViolation(
                "VALIDATION_ERROR",
                "This case already has a primary reviewer. "
                "Assign this person as a secondary reviewer instead.",
            )
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
        staff_id, learner_id = ids.actor_columns(actor.reviewer_id)
        evidence_id = ids.evidence_id(case_id, ids.next_suffix(writes.evidence_ids(con, case_id)))
        writes.insert_evidence(
            con,
            {
                "evidence_id": evidence_id,
                "case_id": case_id,
                "kind": body.kind.value,
                "description": body.description,
                "added_at": now,
                "added_by": staff_id,
                "added_by_learner_id": learner_id,
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


def recuse(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: RecuseBody
) -> CaseDetail:
    """The assigned reviewer steps aside: no status change, the reason goes in the history."""
    now = clock.now()
    with con.transaction():
        begin(con, actor, case_id, Action.RECUSE, now)
        guard_recusal_reason(body.reason)
        events.insert(
            con,
            NewEvent(
                case_id,
                "reviewer_recused",
                now,
                actor.reviewer_id,
                ref_id=actor.reviewer_id,
                reason=body.reason,
            ),
        )
    return read_service.case_detail(con, actor, case_id, now)


def decide(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: DecisionBody
) -> CaseDetail:
    now = clock.now()
    with con.transaction():
        facts, new_status = begin(con, actor, case_id, Action.DECIDE, now)
        # A conflict can appear after assignment (the data changed): re-check it before deciding.
        own = reviewer_candidates(con, case_id, actor.reviewer_id)[0][1]
        reasons = conflict_reasons(own, ignore_on_case=True)
        if reasons:
            raise RuleViolation(
                "CONFLICT_OF_INTEREST",
                "You now have a conflict of interest with this case. "
                "Step aside (recuse) so an administrator can assign someone else.",
                {"reviewer_id": actor.reviewer_id, "reasons": [r.code for r in reasons]},
            )
        guard_cited_evidence(body.cited_evidence_ids, writes.evidence_ids(con, case_id))
        cited = set(body.cited_evidence_ids)
        cited_kinds = [
            EvidenceKind(row["kind"])
            for row in cases.evidence_of(con, case_id)
            if row["evidence_id"] in cited
        ]
        guard_confirmed_violation(body.outcome, body.rationale, cited_kinds)
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


def close(
    con: Connection, clock: Clock, actor: Actor, case_id: str, body: CloseBody | None = None
) -> CaseDetail:
    body = body or CloseBody()
    now = clock.now()
    with con.transaction():
        facts, new_status = begin(
            con, actor, case_id, Action.CLOSE, now, waived=body.waive_appeal_window
        )
        reason = None
        if body.waive_appeal_window:
            if not body.reason:
                raise RuleViolation(
                    "WAIVER_REASON_REQUIRED",
                    "Closing before the appeal window ends needs a reason, for example that the "
                    "learner waived their right to appeal.",
                )
            reason = f"Appeal window waived: {body.reason}"
        events.insert(
            con,
            step_event(
                NewEvent(case_id, "case_closed", now, actor.reviewer_id, reason=reason),
                (facts.status, new_status),
            ),
        )
    return read_service.case_detail(con, actor, case_id, now)
