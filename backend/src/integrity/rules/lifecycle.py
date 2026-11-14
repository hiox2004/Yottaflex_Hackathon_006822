"""Case lifecycle: transition table, role and state guards, allowed actions and action checks.

One function decides every action. `check_action` returns the reasons an action is refused (the
first one becomes the API error), and `allowed_actions` / `action_checks` are built from it, so
the UI and the write endpoints can never disagree.

Refusal wording lives in `lifecycle_messages`, field guards in `lifecycle_guards`. Both are
re-exported here, so `integrity.rules.lifecycle` keeps every public name it had.
"""

from datetime import datetime, timedelta

from integrity.errors import RuleViolation
from integrity.models import Action, ActionCheck, DecisionOutcome, Reason, Role, Status
from integrity.rules.conflicts import REVIEWER_ROLES
from integrity.rules.lifecycle_guards import (
    Actor,
    CaseFacts,
    guard_appeal_reassignment,
    guard_assignment,
    guard_case_owner,
    guard_cited_evidence,
    guard_confirmed_violation,
    guard_evidence_kind,
    guard_recusal_reason,
)
from integrity.rules.lifecycle_messages import (
    LABELS,
    LEARNER_MESSAGE,
    OWN_CASE_MESSAGE,
    ROLE_MESSAGES,
    WHEN_MESSAGES,
)

__all__ = [
    "TRANSITIONS",
    "Actor",
    "CaseFacts",
    "action_checks",
    "allowed_actions",
    "check_action",
    "guard",
    "guard_appeal_reassignment",
    "guard_assignment",
    "guard_case_owner",
    "guard_cited_evidence",
    "guard_confirmed_violation",
    "guard_evidence_kind",
    "guard_recusal_reason",
]

ADMIN = Role.ACADEMIC_ADMINISTRATOR
SUPPORT = Role.SUPPORT_STAFF
LEARNER = Role.LEARNER

# (status, action) -> next status. The only place the lifecycle is written down in the backend.
TRANSITIONS: dict[tuple[Status, Action], Status] = {
    (Status.OPEN, Action.ASSIGN_REVIEWER): Status.UNDER_REVIEW,
    (Status.OPEN, Action.ADD_EVIDENCE): Status.OPEN,
    (Status.UNDER_REVIEW, Action.ASSIGN_REVIEWER): Status.UNDER_REVIEW,
    (Status.UNDER_REVIEW, Action.ADD_EVIDENCE): Status.UNDER_REVIEW,
    (Status.UNDER_REVIEW, Action.DECIDE): Status.DECIDED,
    (Status.UNDER_REVIEW, Action.RECUSE): Status.UNDER_REVIEW,  # no status change, logged
    (Status.DECIDED, Action.REOPEN): Status.UNDER_REVIEW,
    (Status.DECIDED, Action.FILE_APPEAL): Status.APPEALED,
    (Status.DECIDED, Action.CLOSE): Status.CLOSED,
    (Status.APPEALED, Action.ASSIGN_APPEAL_REVIEWER): Status.APPEAL_REVIEW,
    (Status.APPEAL_REVIEW, Action.ASSIGN_APPEAL_REVIEWER): Status.APPEAL_REVIEW,  # reassignment
    (Status.APPEAL_REVIEW, Action.DECIDE_APPEAL): Status.APPEAL_DECIDED,
    (Status.APPEAL_DECIDED, Action.CLOSE): Status.CLOSED,
}

_ROLES: dict[Action, frozenset[Role]] = {
    Action.ASSIGN_REVIEWER: frozenset({ADMIN}),
    Action.ADD_EVIDENCE: REVIEWER_ROLES | {SUPPORT, LEARNER},
    Action.REOPEN: REVIEWER_ROLES | {ADMIN},
    Action.DECIDE: REVIEWER_ROLES,
    Action.FILE_APPEAL: frozenset({SUPPORT, ADMIN, LEARNER}),
    Action.ASSIGN_APPEAL_REVIEWER: frozenset({ADMIN}),
    Action.DECIDE_APPEAL: REVIEWER_ROLES,
    Action.CLOSE: frozenset({ADMIN}),
    Action.RECUSE: REVIEWER_ROLES,
}
_NEEDS_ASSIGNMENT = frozenset({Action.ADD_EVIDENCE, Action.REOPEN, Action.DECIDE, Action.RECUSE})
_LEARNER_ACTIONS = frozenset({Action.ADD_EVIDENCE, Action.FILE_APPEAL})
_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _refuse(code: str, message: str) -> list[Reason]:
    return [Reason(code=code, message=message)]


def _role_reasons(action: Action, actor: Actor, facts: CaseFacts) -> list[Reason]:
    if actor.role is LEARNER:
        if facts.learner_id != actor.reviewer_id:
            return _refuse("NOT_YOUR_CASE", OWN_CASE_MESSAGE)
        if action not in _LEARNER_ACTIONS:
            return _refuse("ROLE_NOT_ALLOWED", LEARNER_MESSAGE)
    if actor.role not in _ROLES[action]:
        return _refuse("ROLE_NOT_ALLOWED", ROLE_MESSAGES[action])
    unassigned = actor.reviewer_id not in facts.reviewer_ids
    if action in _NEEDS_ASSIGNMENT and actor.role in REVIEWER_ROLES and unassigned:
        return _refuse(
            "NOT_ASSIGNED",
            "This case is not assigned to you. "
            f"Only reviewers assigned to a case can {LABELS[action]}.",
        )
    if action is Action.DECIDE_APPEAL and actor.reviewer_id != facts.appeal_reviewer_id:
        return _refuse(
            "NOT_APPEAL_REVIEWER",
            "This appeal is not assigned to you. Only the appeal reviewer can decide it.",
        )
    return []


def _status_reasons(action: Action, facts: CaseFacts) -> list[Reason]:
    status = facts.status
    if action is Action.FILE_APPEAL and facts.appeal_filed:
        return _refuse(
            "APPEAL_EXISTS",
            "An appeal has already been filed for this case, so no second one can be.",
        )
    if (status, action) in TRANSITIONS:
        return []
    if action is Action.ADD_EVIDENCE and status is Status.DECIDED:
        return _refuse(
            "REOPEN_REQUIRED",
            "Evidence can't be added to a decided case. "
            "An assigned reviewer must reopen it first so history is kept.",
        )
    if action is Action.CLOSE and status in (Status.APPEALED, Status.APPEAL_REVIEW):
        return _refuse(
            "APPEAL_UNRESOLVED",
            "The case can't be closed while its appeal is open. "
            "Close it once the appeal is decided.",
        )
    if status is Status.CLOSED:
        return _refuse("INVALID_TRANSITION", "This case is already closed.")
    return _refuse("INVALID_TRANSITION", WHEN_MESSAGES[action])


def _window_end(facts: CaseFacts) -> datetime | None:
    if facts.latest_decision_at is None:
        return None
    return facts.latest_decision_at + timedelta(days=facts.appeal_window_days)


def _day(moment: datetime) -> str:
    return f"{moment.day} {_MONTHS[moment.month - 1]} {moment.year}"


def _specific_reasons(
    action: Action, facts: CaseFacts, now: datetime, waived: bool
) -> list[Reason]:
    if (
        action is Action.FILE_APPEAL
        and facts.latest_outcome is not DecisionOutcome.VIOLATION_CONFIRMED
    ):
        return _refuse("NOT_ADVERSE", "A violation can only be appealed when it was confirmed.")
    end = _window_end(facts)
    if end is None:
        return []
    # The window is open while now < end: CLOSE waits for it, FILE_APPEAL needs it.
    if action is Action.FILE_APPEAL and now >= end:
        return _refuse(
            "APPEAL_WINDOW_CLOSED",
            f"The appeal window closed on {_day(end)}. Appeals can no longer be filed.",
        )
    # Only an adverse decision waits for the window: nobody can appeal a clean one, so it closes.
    if (
        action is Action.CLOSE
        and facts.status is Status.DECIDED
        and facts.latest_outcome is DecisionOutcome.VIOLATION_CONFIRMED
        and now < end
        and not waived
    ):
        return _refuse(
            "APPEAL_WINDOW_OPEN",
            f"The learner can still appeal until {_day(end)}. "
            "Close early only with a recorded waiver.",
        )
    return []


def check_action(
    action: Action, actor: Actor, facts: CaseFacts, now: datetime, *, waived: bool = False
) -> list[Reason]:
    """Reasons the action is refused, role first, then state, then specifics; empty when allowed.

    `waived` is True when the administrator closes an adverse case early with a recorded waiver.
    """
    return (
        _role_reasons(action, actor, facts)
        or _status_reasons(action, facts)
        or _specific_reasons(action, facts, now, waived)
    )


def action_checks(actor: Actor, facts: CaseFacts, now: datetime) -> list[ActionCheck]:
    """Every action with its verdict and reasons, in the contract's action order."""
    checks = []
    for action in Action:
        reasons = check_action(action, actor, facts, now)
        # Refused close inside the window: an administrator can still close it with a waiver.
        waivable = action is Action.CLOSE and any(r.code == "APPEAL_WINDOW_OPEN" for r in reasons)
        checks.append(
            ActionCheck(action=action, allowed=not reasons, reasons=reasons, waivable=waivable)
        )
    return checks


def allowed_actions(actor: Actor, facts: CaseFacts, now: datetime) -> list[Action]:
    """The actions whose check passes: the only actions the UI may offer."""
    return [check.action for check in action_checks(actor, facts, now) if check.allowed]


def guard(
    action: Action, actor: Actor, facts: CaseFacts, now: datetime, *, waived: bool = False
) -> Status:
    """Raise RuleViolation with the first reason, else return the status the action leads to."""
    reasons = check_action(action, actor, facts, now, waived=waived)
    if reasons:
        raise RuleViolation(reasons[0].code, reasons[0].message)
    return TRANSITIONS[(facts.status, action)]
