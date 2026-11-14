"""Enums and Pydantic models of the API contract (v1.1), shared by every layer."""

from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, PlainSerializer

# Scores are exact Decimals inside the code and JSON numbers with three decimals on the wire.
Score = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


def _iso(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


UtcTime = Annotated[datetime, PlainSerializer(_iso, return_type=str, when_used="json")]


class Role(StrEnum):
    INSTRUCTOR = "instructor"
    ACADEMIC_REVIEWER = "academic_reviewer"
    ACADEMIC_ADMINISTRATOR = "academic_administrator"
    SUPPORT_STAFF = "support_staff"
    LEARNER = "learner"  # the actor is a learner id (LRN-...); learners see only their own cases


class Band(StrEnum):
    NO_ACTION = "no_action"
    LOG_ONLY = "log_only"
    REVIEW = "review"
    PRIORITY_REVIEW = "priority_review"


class Status(StrEnum):
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    DECIDED = "decided"
    APPEALED = "appealed"
    APPEAL_REVIEW = "appeal_review"
    APPEAL_DECIDED = "appeal_decided"
    CLOSED = "closed"


class EvidenceKind(StrEnum):
    MATCHED_PASSAGE = "matched_passage"
    SOURCE_REFERENCE = "source_reference"
    TEMPLATE_MATCH = "template_match"
    QUOTE_CITATION = "quote_citation"
    LEARNER_STATEMENT = "learner_statement"


class DecisionOutcome(StrEnum):
    NO_VIOLATION = "no_violation"
    VIOLATION_CONFIRMED = "violation_confirmed"
    INCONCLUSIVE = "inconclusive"


class AppealOutcome(StrEnum):
    UPHELD = "upheld"
    OVERTURNED = "overturned"
    PARTIALLY_UPHELD = "partially_upheld"


class EventType(StrEnum):
    CASE_OPENED = "case_opened"
    REVIEWER_ASSIGNED = "reviewer_assigned"
    EVIDENCE_ADDED = "evidence_added"
    DECISION_RECORDED = "decision_recorded"
    CASE_REOPENED = "case_reopened"
    APPEAL_FILED = "appeal_filed"
    APPEAL_REVIEWER_ASSIGNED = "appeal_reviewer_assigned"
    APPEAL_DECIDED = "appeal_decided"
    CASE_CLOSED = "case_closed"
    RECUSED = "reviewer_recused"


class DismissalReason(StrEnum):
    QUOTE_ONLY = "quote_only"
    TEMPLATE_MATCH = "template_match"


class IssueType(StrEnum):
    AUTO_GUILT_WITHOUT_REVIEW = "AUTO_GUILT_WITHOUT_REVIEW"
    REVIEWER_CONFLICT = "REVIEWER_CONFLICT"
    EVIDENCE_AFTER_DECISION_NO_HISTORY = "EVIDENCE_AFTER_DECISION_NO_HISTORY"
    APPEAL_CLOSED_NO_INDEPENDENT_REVIEW = "APPEAL_CLOSED_NO_INDEPENDENT_REVIEW"


class Action(StrEnum):
    ASSIGN_REVIEWER = "assign_reviewer"
    ADD_EVIDENCE = "add_evidence"
    REOPEN = "reopen"
    DECIDE = "decide"
    FILE_APPEAL = "file_appeal"
    ASSIGN_APPEAL_REVIEWER = "assign_appeal_reviewer"
    DECIDE_APPEAL = "decide_appeal"
    CLOSE = "close"
    RECUSE = "recuse"


class ConflictCode(StrEnum):
    INSTRUCTOR_OF_ASSESSMENT = "INSTRUCTOR_OF_ASSESSMENT"
    SAME_DEPARTMENT = "SAME_DEPARTMENT"
    REVIEWED_LEARNER_BEFORE = "REVIEWED_LEARNER_BEFORE"
    ALREADY_ON_CASE = "ALREADY_ON_CASE"
    DECIDED_THIS_CASE = "DECIDED_THIS_CASE"
    ROLE_CANNOT_REVIEW = "ROLE_CANNOT_REVIEW"


class Rule(BaseModel):
    """One version of the integrity rule: the thresholds and the appeal window."""

    rule_id: str
    version: int
    log_threshold: Score
    review_threshold: Score
    priority_threshold: Score
    appeal_window_days: int
    effective_from: UtcTime
    effective_to: UtcTime | None


class Reviewer(BaseModel):
    reviewer_id: str
    name: str
    role: Role
    department: str


class Reason(BaseModel):
    """Why something is refused: a code from the contract and a plain-language message."""

    code: str
    message: str


class ActionCheck(BaseModel):
    action: Action
    allowed: bool
    reasons: list[Reason]
    # True when a recorded waiver can override the refusal (close inside the appeal window).
    waivable: bool = False


class ExplainStep(BaseModel):
    step: str
    text: str
    value: float | str | None
    threshold: float | None
