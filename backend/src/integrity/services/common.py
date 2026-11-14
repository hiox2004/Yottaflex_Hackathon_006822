"""Helpers shared by the read and write services: the actor, case facts and reviewer candidates."""

from typing import Any

import psycopg

from integrity.errors import NotFoundError, RuleViolation
from integrity.models import DecisionOutcome, Role, Status
from integrity.queries import cases, learners, reviewers
from integrity.rules import Actor, CaseFacts, ConflictFacts

Row = dict[str, Any]
Connection = psycopg.Connection[Row]


def load_actor(con: Connection, actor_id: str | None) -> Actor:
    """The acting staff member from the X-Actor-Id header; unknown or missing is a 401."""
    if actor_id and actor_id.startswith("LRN-"):
        learner = learners.get_learner(con, actor_id)
        if learner is not None:
            return Actor(learner["learner_id"], Role.LEARNER)
    elif actor_id:
        reviewer = reviewers.get_reviewer(con, actor_id)
        if reviewer is not None:
            return Actor(reviewer["reviewer_id"], Role(reviewer["role"]))
    raise RuleViolation(
        "UNKNOWN_ACTOR",
        "You are not signed in as a known staff member. Choose a staff member and try again.",
    )


def facts_from_row(row: Row) -> CaseFacts:
    outcome = row["latest_outcome"]
    return CaseFacts(
        status=Status(row["status"]),
        reviewer_ids=frozenset(row["assignee_ids"]),
        latest_outcome=DecisionOutcome(outcome) if outcome else None,
        latest_decision_at=row["latest_decision_at"],
        appeal_filed=row["appeal_filed"],
        appeal_reviewer_id=row["appeal_reviewer_id"],
        appeal_window_days=row["appeal_window_days"],
        learner_id=row["learner_id"],
    )


def case_facts(con: Connection, case_id: str) -> CaseFacts:
    row = cases.facts(con, case_id)
    if row is None:
        raise NotFoundError(
            f"We could not find case {case_id}. Check the case number and try again."
        )
    return facts_from_row(row)


def reviewer_candidates(
    con: Connection, case_id: str, reviewer_id: str | None = None
) -> list[tuple[Row, ConflictFacts]]:
    """Every reviewer (or the one named) with the facts needed to judge conflict or independence."""
    head = cases.header(con, case_id)
    if head is None:
        raise NotFoundError(
            f"We could not find case {case_id}. Check the case number and try again."
        )
    result = []
    for row in reviewers.conflict_facts(con, case_id, reviewer_id):
        facts = ConflictFacts(
            reviewer_id=row["reviewer_id"],
            reviewer_role=Role(row["role"]),
            reviewer_department=row["department"],
            learner_department=head["learner_department"],
            assessment_instructor_id=head["instructor_id"],
            reviewed_learner_before=row["reviewed_learner_before"],
            on_case=row["on_case"],
            decided_case=row["decided_case"],
        )
        result.append((row, facts))
    return result
