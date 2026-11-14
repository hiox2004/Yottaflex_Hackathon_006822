"""Case lifecycle: transition table, role and state guards, allowed actions and action checks.

One function decides every action. `check_action` returns the reasons an action is refused (the
first one becomes the API error), and `allowed_actions` / `action_checks` are built from it, so
the UI and the write endpoints can never disagree.
"""

from collections.abc import Collection
from dataclasses import dataclass
from datetime import datetime, timedelta

from integrity.errors import RuleViolation
from integrity.models import (
    Action,
    ActionCheck,
    ConflictCode,
    DecisionOutcome,
    EvidenceKind,
    Reason,
    Role,
    Status,
)
from integrity.rules.conflicts import REVIEWER_ROLES

ADMIN = Role.ACADEMIC_ADMINISTRATOR
SUPPORT = Role.SUPPORT_STAFF

# (status, action) -> next status. The only place the lifecycle is written down in the backend.
TRANSITIONS: dict[tuple[Status, Action], Status] = {
    (Status.OPEN, Action.ASSIGN_REVIEWER): Status.UNDER_REVIEW,
    (Status.OPEN, Action.ADD_EVIDENCE): Status.OPEN,
    (Status.UNDER_REVIEW, Action.ASSIGN_REVIEWER): Status.UNDER_REVIEW,
    (Status.UNDER_REVIEW, Action.ADD_EVIDENCE): Status.UNDER_REVIEW,
    (Status.UNDER_REVIEW, Action.DECIDE): Status.DECIDED,
    (Status.DECIDED, Action.REOPEN): Status.UNDER_REVIEW,
    (Status.DECIDED, Action.FILE_APPEAL): Status.APPEALED,
    (Status.DECIDED, Action.CLOSE): Status.CLOSED,
    (Status.APPEALED, Action.ASSIGN_APPEAL_REVIEWER): Status.APPEAL_REVIEW,
    (Status.APPEAL_REVIEW, Action.DECIDE_APPEAL): Status.APPEAL_DECIDED,
    (Status.APPEAL_DECIDED, Action.CLOSE): Status.CLOSED,
}

_ROLES: dict[Action, frozenset[Role]] = {
    Action.ASSIGN_REVIEWER: frozenset({ADMIN}),
    Action.ADD_EVIDENCE: REVIEWER_ROLES | {SUPPORT},
    Action.REOPEN: REVIEWER_ROLES | {ADMIN},
    Action.DECIDE: REVIEWER_ROLES,
    Action.FILE_APPEAL: frozenset({SUPPORT, ADMIN}),
    Action.ASSIGN_APPEAL_REVIEWER: frozenset({ADMIN}),
    Action.DECIDE_APPEAL: REVIEWER_ROLES,
    Action.CLOSE: frozenset({ADMIN}),
}
_NEEDS_ASSIGNMENT = frozenset({Action.ADD_EVIDENCE, Action.REOPEN, Action.DECIDE})
_LABELS: dict[Action, str] = {
    Action.ASSIGN_REVIEWER: "assign a reviewer",
    Action.ADD_EVIDENCE: "add evidence",
    Action.REOPEN: "reopen the case",
    Action.DECIDE: "record a decision",
    Action.FILE_APPEAL: "file an appeal",
    Action.ASSIGN_APPEAL_REVIEWER: "assign an appeal reviewer",
    Action.DECIDE_APPEAL: "decide the appeal",
    Action.CLOSE: "close the case",
}
_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


@dataclass(frozen=True)
class Actor:
    reviewer_id: str
    role: Role


@dataclass(frozen=True)
class CaseFacts:
    """The case state the guards need, read inside the write transaction."""

    status: Status
    reviewer_ids: frozenset[str]
    latest_outcome: DecisionOutcome | None
    latest_decision_at: datetime | None
    appeal_filed: bool
    appeal_reviewer_id: str | None
    appeal_window_days: int


def _refuse(code: str, message: str) -> list[Reason]:
    return [Reason(code=code, message=message)]


def _role_reasons(action: Action, actor: Actor, facts: CaseFacts) -> list[Reason]:
    label = _LABELS[action]
    if actor.role not in _ROLES[action]:
        return _refuse("ROLE_NOT_ALLOWED", f"The role {actor.role.value} cannot {label}.")
    unassigned = actor.reviewer_id not in facts.reviewer_ids
    if action in _NEEDS_ASSIGNMENT and actor.role in REVIEWER_ROLES and unassigned:
        return _refuse(
            "NOT_ASSIGNED",
            f"{actor.reviewer_id} is not assigned to this case, so cannot {label}.",
        )
    if action is Action.DECIDE_APPEAL and actor.reviewer_id != facts.appeal_reviewer_id:
        return _refuse(
            "NOT_APPEAL_REVIEWER", f"{actor.reviewer_id} is not the reviewer of this appeal."
        )
    return []


def _status_reasons(action: Action, facts: CaseFacts) -> list[Reason]:
    status = facts.status
    if action is Action.FILE_APPEAL and facts.appeal_filed:
        return _refuse("APPEAL_EXISTS", "An appeal was already filed for this case.")
    if (status, action) in TRANSITIONS:
        return []
    if action is Action.ADD_EVIDENCE and status is Status.DECIDED:
        return _refuse("REOPEN_REQUIRED", "The case is decided: reopen it before adding evidence.")
    if action is Action.CLOSE and status in (Status.APPEALED, Status.APPEAL_REVIEW):
        return _refuse(
            "APPEAL_UNRESOLVED", "The appeal has no outcome yet, so the case cannot be closed."
        )
    return _refuse("INVALID_TRANSITION", f"A case that is {status.value} cannot {_LABELS[action]}.")


def _window_end(facts: CaseFacts) -> datetime | None:
    if facts.latest_decision_at is None:
        return None
    return facts.latest_decision_at + timedelta(days=facts.appeal_window_days)


def _specific_reasons(action: Action, facts: CaseFacts, now: datetime) -> list[Reason]:
    if (
        action is Action.FILE_APPEAL
        and facts.latest_outcome is not DecisionOutcome.VIOLATION_CONFIRMED
    ):
        return _refuse("NOT_ADVERSE", "Only a confirmed violation can be appealed.")
    end = _window_end(facts)
    if action is Action.CLOSE and facts.status is Status.DECIDED and end is not None and now < end:
        until = f"{end.day} {_MONTHS[end.month - 1]} {end.year}"
        return _refuse("APPEAL_WINDOW_OPEN", f"Appeal window open until {until}.")
    return []


def check_action(action: Action, actor: Actor, facts: CaseFacts, now: datetime) -> list[Reason]:
    """Reasons the action is refused, role first, then state, then specifics; empty when allowed."""
    return (
        _role_reasons(action, actor, facts)
        or _status_reasons(action, facts)
        or _specific_reasons(action, facts, now)
    )


def action_checks(actor: Actor, facts: CaseFacts, now: datetime) -> list[ActionCheck]:
    """Every action with its verdict and reasons, in the contract's action order."""
    checks = []
    for action in Action:
        reasons = check_action(action, actor, facts, now)
        checks.append(ActionCheck(action=action, allowed=not reasons, reasons=reasons))
    return checks


def allowed_actions(actor: Actor, facts: CaseFacts, now: datetime) -> list[Action]:
    """The actions whose check passes: the only actions the UI may offer."""
    return [check.action for check in action_checks(actor, facts, now) if check.allowed]


def guard(action: Action, actor: Actor, facts: CaseFacts, now: datetime) -> Status:
    """Raise RuleViolation with the first reason, else return the status the action leads to."""
    reasons = check_action(action, actor, facts, now)
    if reasons:
        raise RuleViolation(reasons[0].code, reasons[0].message)
    return TRANSITIONS[(facts.status, action)]


def guard_evidence_kind(actor: Actor, kind: EvidenceKind) -> None:
    """Support staff may only record the learner's own statement."""
    if actor.role is SUPPORT and kind is not EvidenceKind.LEARNER_STATEMENT:
        raise RuleViolation("ROLE_NOT_ALLOWED", "Support staff can only add a learner statement.")


def guard_cited_evidence(cited: Collection[str], case_evidence_ids: Collection[str]) -> None:
    """A decision cites at least one evidence item, and only items of this case."""
    unknown = sorted(set(cited) - set(case_evidence_ids))
    if not cited or unknown:
        message = "A decision must cite at least one evidence item of this case."
        raise RuleViolation("EVIDENCE_REQUIRED", message, {"unknown_evidence_ids": unknown})


def guard_assignment(reasons: list[Reason], reviewer_id: str, code: str) -> None:
    """Raise `code` (CONFLICT_OF_INTEREST or NOT_INDEPENDENT) if any reason counts against.

    A candidate whose role cannot review at all is a bad request (VALIDATION_ERROR), not a conflict.
    """
    if reasons:
        codes = [r.code for r in reasons]
        if ConflictCode.ROLE_CANNOT_REVIEW in codes:
            code = "VALIDATION_ERROR"
        details = {"reviewer_id": reviewer_id, "reasons": codes}
        raise RuleViolation(code, reasons[0].message, details)
