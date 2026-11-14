"""Conflicts, appeal independence, transitions and action checks."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from integrity.errors import RuleViolation
from integrity.models import Action, DecisionOutcome, EvidenceKind, Role, Status
from integrity.rules import (
    TRANSITIONS,
    Actor,
    CaseFacts,
    ConflictFacts,
    action_checks,
    allowed_actions,
    conflict_reasons,
    guard,
    guard_assignment,
    guard_cited_evidence,
    is_independent,
)
from integrity.rules.lifecycle import guard_confirmed_violation, guard_recusal_reason

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
        reviewer_role=Role.ACADEMIC_REVIEWER,
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
        ({"reviewer_role": Role.SUPPORT_STAFF}, "ROLE_CANNOT_REVIEW"),
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


SUPPORTING = "Passages match an uncited source."  # long enough for a confirmed violation


@pytest.mark.parametrize(
    ("outcome", "rationale", "kinds", "code"),
    [
        (
            DecisionOutcome.VIOLATION_CONFIRMED,
            "  too short  ",
            [EvidenceKind.MATCHED_PASSAGE],
            "RATIONALE_TOO_SHORT",
        ),
        (
            DecisionOutcome.VIOLATION_CONFIRMED,
            SUPPORTING,
            [EvidenceKind.QUOTE_CITATION],
            "NO_INCRIMINATING_EVIDENCE",
        ),
        (
            DecisionOutcome.VIOLATION_CONFIRMED,
            SUPPORTING,
            [EvidenceKind.TEMPLATE_MATCH, EvidenceKind.LEARNER_STATEMENT],
            "NO_INCRIMINATING_EVIDENCE",
        ),
    ],
)
def test_confirmed_violation_needs_a_finding_and_an_incriminating_item(
    outcome: DecisionOutcome, rationale: str, kinds: list[EvidenceKind], code: str
) -> None:
    with pytest.raises(RuleViolation) as raised:
        guard_confirmed_violation(outcome, rationale, kinds)
    assert raised.value.code == code


@pytest.mark.parametrize(
    ("outcome", "kinds"),
    [
        (DecisionOutcome.NO_VIOLATION, [EvidenceKind.QUOTE_CITATION]),
        (DecisionOutcome.INCONCLUSIVE, [EvidenceKind.LEARNER_STATEMENT]),
    ],
)
def test_other_outcomes_keep_the_looser_rule(
    outcome: DecisionOutcome, kinds: list[EvidenceKind]
) -> None:
    guard_confirmed_violation(outcome, "x", kinds)


def test_a_confirmed_violation_passes_with_a_finding_and_a_source_reference() -> None:
    guard_confirmed_violation(
        DecisionOutcome.VIOLATION_CONFIRMED, SUPPORTING, [EvidenceKind.SOURCE_REFERENCE]
    )


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
    assert window.value.message == (
        "The learner can still appeal until 12 Oct 2026. Close early only with a recorded waiver."
    )


def test_a_non_adverse_decision_closes_at_once_for_the_administrator() -> None:
    for outcome in (DecisionOutcome.NO_VIOLATION, DecisionOutcome.INCONCLUSIVE):
        recent = facts(Status.DECIDED, latest_outcome=outcome, latest_decision_at=NOW)
        assert guard(Action.CLOSE, ADMIN, recent, NOW) is Status.CLOSED
    for actor in (REVIEWER, SUPPORT):
        recent = facts(Status.DECIDED, latest_decision_at=NOW - timedelta(days=3))
        with pytest.raises(RuleViolation) as refused:
            guard(Action.CLOSE, actor, recent, NOW)
        assert refused.value.code == "ROLE_NOT_ALLOWED"


def test_a_waiver_lets_the_administrator_close_an_adverse_case_inside_the_window() -> None:
    recent = facts(Status.DECIDED, latest_decision_at=NOW - timedelta(days=3))
    assert guard(Action.CLOSE, ADMIN, recent, NOW, waived=True) is Status.CLOSED


def test_only_an_administrator_adverse_case_inside_the_window_is_waivable() -> None:
    recent = facts(Status.DECIDED, latest_decision_at=NOW - timedelta(days=3))
    checks = {c.action: c for c in action_checks(ADMIN, recent, NOW)}
    assert checks[Action.CLOSE].waivable
    assert not checks[Action.CLOSE].allowed
    assert not any(c.waivable for c in action_checks(REVIEWER, recent, NOW))
    assert not any(c.waivable for c in action_checks(SUPPORT, recent, NOW))
    after = facts(Status.DECIDED, latest_decision_at=NOW - timedelta(days=15))
    assert not any(c.waivable for c in action_checks(ADMIN, after, NOW))
    clean = facts(
        Status.DECIDED,
        latest_outcome=DecisionOutcome.NO_VIOLATION,
        latest_decision_at=NOW - timedelta(days=3),
    )
    assert not any(c.waivable for c in action_checks(ADMIN, clean, NOW))
    assert Action.CLOSE in allowed_actions(ADMIN, clean, NOW)


def test_appeal_is_refused_from_the_window_end_and_allowed_just_before() -> None:
    decided = NOW - timedelta(days=14)  # the 14-day window ends exactly at NOW
    closed = facts(Status.DECIDED, latest_decision_at=decided)
    with pytest.raises(RuleViolation) as raised:
        guard(Action.FILE_APPEAL, SUPPORT, closed, NOW)
    assert raised.value.code == "APPEAL_WINDOW_CLOSED"
    assert raised.value.message == (
        "The appeal window closed on 1 Oct 2026. Appeals can no longer be filed."
    )
    last_moment = NOW - timedelta(seconds=1)
    assert guard(Action.FILE_APPEAL, SUPPORT, closed, last_moment) is Status.APPEALED


def test_closed_appeal_window_is_refused_in_action_checks() -> None:
    late = facts(Status.DECIDED, latest_decision_at=NOW - timedelta(days=15))
    assert Action.FILE_APPEAL not in allowed_actions(SUPPORT, late, NOW)
    check = next(c for c in action_checks(SUPPORT, late, NOW) if c.action is Action.FILE_APPEAL)
    assert [r.code for r in check.reasons] == ["APPEAL_WINDOW_CLOSED"]


def test_admin_can_reassign_the_appeal_reviewer_while_it_is_under_review() -> None:
    held = facts(Status.APPEAL_REVIEW, appeal_filed=True, appeal_reviewer_id="REV-000010")
    assert guard(Action.ASSIGN_APPEAL_REVIEWER, ADMIN, held, NOW) is Status.APPEAL_REVIEW
    with pytest.raises(RuleViolation) as raised:
        guard(Action.ASSIGN_APPEAL_REVIEWER, SUPPORT, held, NOW)
    assert raised.value.code == "ROLE_NOT_ALLOWED"


def test_close_after_the_window_leads_to_closed() -> None:
    assert guard(Action.CLOSE, ADMIN, facts(Status.DECIDED), NOW) is Status.CLOSED
    late = facts(Status.DECIDED, latest_decision_at=NOW - timedelta(days=15))
    assert guard(Action.CLOSE, ADMIN, late, NOW) is Status.CLOSED


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
    assert allowed_actions(REVIEWER, under_review, NOW) == [
        Action.ADD_EVIDENCE,
        Action.DECIDE,
        Action.RECUSE,
    ]


def test_decision_must_cite_evidence_of_this_case() -> None:
    guard_cited_evidence(["EVD-1"], ["EVD-1", "EVD-2"])
    for cited in ([], ["EVD-9"]):
        with pytest.raises(RuleViolation):
            guard_cited_evidence(cited, ["EVD-1"])


def test_role_that_cannot_review_is_a_validation_error_not_a_conflict() -> None:
    reasons = conflict_reasons(conflict(reviewer_role=Role.ACADEMIC_ADMINISTRATOR))
    with pytest.raises(RuleViolation) as raised:
        guard_assignment(reasons, "REV-000009", "CONFLICT_OF_INTEREST")
    assert raised.value.code == "VALIDATION_ERROR"
    assert "ROLE_CANNOT_REVIEW" in raised.value.details["reasons"]


def test_only_an_assigned_reviewer_can_step_aside_while_under_review() -> None:
    assert guard(Action.RECUSE, REVIEWER, facts(Status.UNDER_REVIEW), NOW) is Status.UNDER_REVIEW
    outsider = Actor("REV-000008", Role.ACADEMIC_REVIEWER)
    with pytest.raises(RuleViolation) as unassigned:
        guard(Action.RECUSE, outsider, facts(Status.UNDER_REVIEW), NOW)
    assert unassigned.value.code == "NOT_ASSIGNED"
    for actor in (ADMIN, SUPPORT):
        with pytest.raises(RuleViolation) as role:
            guard(Action.RECUSE, actor, facts(Status.UNDER_REVIEW), NOW)
        assert role.value.code == "ROLE_NOT_ALLOWED"


@pytest.mark.parametrize("status", [Status.OPEN, Status.DECIDED, Status.CLOSED])
def test_recusal_is_refused_outside_under_review(status: Status) -> None:
    with pytest.raises(RuleViolation) as raised:
        guard(Action.RECUSE, REVIEWER, facts(status), NOW)
    assert raised.value.code == "INVALID_TRANSITION"


def test_blank_recusal_reason_is_refused_with_a_plain_message() -> None:
    guard_recusal_reason("Known to the learner's family.")
    with pytest.raises(RuleViolation) as raised:
        guard_recusal_reason("   ")
    assert raised.value.code == "RECUSAL_REASON_REQUIRED"


def test_on_case_reason_can_be_ignored_at_decision_time() -> None:
    on_case = conflict(on_case=True)
    assert [r.code for r in conflict_reasons(on_case)] == ["ALREADY_ON_CASE"]
    assert conflict_reasons(on_case, ignore_on_case=True) == []
    clashing = conflict(on_case=True, reviewer_department="Law")
    assert [r.code for r in conflict_reasons(clashing, ignore_on_case=True)] == ["SAME_DEPARTMENT"]
