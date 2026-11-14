"""Conflicts, appeal independence, transitions and action checks."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from integrity.errors import RuleViolation
from integrity.models import Action, DecisionOutcome, Role, Status
from integrity.rules import (
    TRANSITIONS,
    Actor,
    CaseFacts,
    ConflictFacts,
    action_checks,
    allowed_actions,
    conflict_reasons,
    guard,
    guard_cited_evidence,
    is_independent,
)

NOW = datetime(2026, 10, 1, tzinfo=UTC)
ADMIN = Actor("REV-000001", Role.ACADEMIC_ADMINISTRATOR)
REVIEWER = Actor("REV-000002", Role.ACADEMIC_REVIEWER)
SUPPORT = Actor("REV-000003", Role.SUPPORT_STAFF)


def facts(status: Status, **changes: object) -> CaseFacts:
    base = CaseFacts(
        status=status,
        reviewer_ids=frozenset({"REV-000002"}),
        latest_outcome=DecisionOutcome.VIOLATION_CONFIRMED,
        latest_decision_at=NOW - timedelta(days=20),
        appeal_filed=False,
        appeal_reviewer_id=None,
        appeal_window_days=14,
    )
    return replace(base, **changes)  # type: ignore[arg-type]


def conflict(**changes: object) -> ConflictFacts:
    base = ConflictFacts(
        reviewer_id="REV-000009",
        reviewer_department="Physics",
        learner_department="Law",
        assessment_instructor_id="REV-000004",
        reviewed_learner_before=False,
        on_case=False,
        decided_case=False,
    )
    return replace(base, **changes)  # type: ignore[arg-type]


def test_conflict_free_reviewer_has_no_reasons() -> None:
    assert conflict_reasons(conflict()) == []


@pytest.mark.parametrize(
    ("change", "code"),
    [
        ({"assessment_instructor_id": "REV-000009"}, "INSTRUCTOR_OF_ASSESSMENT"),
        ({"reviewer_department": "Law"}, "SAME_DEPARTMENT"),
        ({"reviewed_learner_before": True}, "REVIEWED_LEARNER_BEFORE"),
        ({"on_case": True}, "ALREADY_ON_CASE"),
    ],
)
def test_each_conflict_has_its_code(change: dict[str, object], code: str) -> None:
    assert [r.code for r in conflict_reasons(conflict(**change))] == [code]


def test_case_decider_is_not_independent_for_the_appeal() -> None:
    assert is_independent(conflict())
    assert not is_independent(conflict(on_case=True, decided_case=True))


def test_closed_is_terminal_in_the_transition_table() -> None:
    assert all(status is not Status.CLOSED for status, _ in TRANSITIONS)


def test_only_a_confirmed_violation_can_be_appealed() -> None:
    inconclusive = facts(Status.DECIDED, latest_outcome=DecisionOutcome.INCONCLUSIVE)
    with pytest.raises(RuleViolation) as raised:
        guard(Action.FILE_APPEAL, SUPPORT, inconclusive, NOW)
    assert raised.value.code == "NOT_ADVERSE"


def test_evidence_after_a_decision_needs_a_reopen() -> None:
    with pytest.raises(RuleViolation) as raised:
        guard(Action.ADD_EVIDENCE, REVIEWER, facts(Status.DECIDED), NOW)
    assert raised.value.code == "REOPEN_REQUIRED"


def test_close_is_refused_while_the_appeal_is_unresolved_or_the_window_is_open() -> None:
    with pytest.raises(RuleViolation) as unresolved:
        guard(Action.CLOSE, ADMIN, facts(Status.APPEAL_REVIEW), NOW)
    assert unresolved.value.code == "APPEAL_UNRESOLVED"
    recent = facts(Status.DECIDED, latest_decision_at=NOW - timedelta(days=3))
    with pytest.raises(RuleViolation) as window:
        guard(Action.CLOSE, ADMIN, recent, NOW)
    assert window.value.code == "APPEAL_WINDOW_OPEN"
    assert window.value.message == "Appeal window open until 12 Oct 2026."


def test_close_after_the_window_leads_to_closed() -> None:
    assert guard(Action.CLOSE, ADMIN, facts(Status.DECIDED), NOW) is Status.CLOSED


def test_unassigned_reviewer_cannot_decide_and_the_wrong_role_is_refused() -> None:
    outsider = Actor("REV-000008", Role.ACADEMIC_REVIEWER)
    with pytest.raises(RuleViolation) as unassigned:
        guard(Action.DECIDE, outsider, facts(Status.UNDER_REVIEW), NOW)
    assert unassigned.value.code == "NOT_ASSIGNED"
    with pytest.raises(RuleViolation) as role:
        guard(Action.DECIDE, ADMIN, facts(Status.UNDER_REVIEW), NOW)
    assert role.value.code == "ROLE_NOT_ALLOWED"


def test_only_the_appeal_reviewer_decides_the_appeal() -> None:
    appeal = facts(Status.APPEAL_REVIEW, appeal_filed=True, appeal_reviewer_id="REV-000010")
    with pytest.raises(RuleViolation) as raised:
        guard(Action.DECIDE_APPEAL, REVIEWER, appeal, NOW)
    assert raised.value.code == "NOT_APPEAL_REVIEWER"
    owner = Actor("REV-000010", Role.ACADEMIC_REVIEWER)
    assert guard(Action.DECIDE_APPEAL, owner, appeal, NOW) is Status.APPEAL_DECIDED


def test_action_checks_cover_every_action_and_match_allowed_actions() -> None:
    under_review = facts(Status.UNDER_REVIEW)
    checks = action_checks(REVIEWER, under_review, NOW)
    assert [c.action for c in checks] == list(Action)
    assert all(c.reasons for c in checks if not c.allowed)
    assert allowed_actions(REVIEWER, under_review, NOW) == [Action.ADD_EVIDENCE, Action.DECIDE]


def test_decision_must_cite_evidence_of_this_case() -> None:
    guard_cited_evidence(["EVD-1"], ["EVD-1", "EVD-2"])
    for cited in ([], ["EVD-9"]):
        with pytest.raises(RuleViolation):
            guard_cited_evidence(cited, ["EVD-1"])
