"""Response shapes of the API contract (v1.2) that are not shared with the rules."""

from pydantic import BaseModel, Field

from integrity.models import (
    Action,
    ActionCheck,
    AppealOutcome,
    Band,
    DecisionOutcome,
    DismissalReason,
    EventType,
    EvidenceKind,
    ExplainStep,
    Reason,
    Reviewer,
    Rule,
    Score,
    Status,
    UtcTime,
)


class LearnerRef(BaseModel):
    learner_id: str
    name: str
    department: str


class AssessmentRef(BaseModel):
    assessment_id: str
    title: str
    instructor_id: str


class FlagDetail(BaseModel):
    similarity_report_id: str
    rule: Rule
    raw_score: Score
    quoted_score: Score
    template_score: Score
    adjusted_score: Score
    band: Band
    explanation: list[ExplainStep]


class CaseReviewerOut(BaseModel):
    reviewer_id: str
    name: str
    role_in_case: str
    assigned_at: UtcTime


class EvidenceOut(BaseModel):
    evidence_id: str
    kind: EvidenceKind
    description: str
    added_at: UtcTime
    added_by: str | None


class DecisionOut(BaseModel):
    decision_id: str
    outcome: DecisionOutcome
    rationale: str
    reviewer_id: str | None
    decided_at: UtcTime
    cited_evidence_ids: list[str]


class AppealOut(BaseModel):
    appeal_id: str
    grounds: str
    filed_at: UtcTime
    reviewer_id: str | None
    outcome: AppealOutcome | None
    outcome_rationale: str | None
    decided_at: UtcTime | None


class CaseDetail(BaseModel):
    case_id: str
    status: Status
    opened_at: UtcTime
    closed_at: UtcTime | None
    learner: LearnerRef
    assessment: AssessmentRef
    flag: FlagDetail
    reviewers: list[CaseReviewerOut]
    evidence: list[EvidenceOut]
    decisions: list[DecisionOut]
    appeal: AppealOut | None
    effective_outcome: DecisionOutcome | None
    allowed_actions: list[Action]
    action_checks: list[ActionCheck]


class QueueRow(BaseModel):
    case_id: str
    learner_id: str
    learner_name: str
    assessment_title: str
    adjusted_score: Score
    band: Band
    status: Status
    assignee_ids: list[str]
    opened_at: UtcTime
    needs_my_action: bool


class QueueFilter(BaseModel):
    """Query parameters of GET /queue."""

    status: Status | None = None
    band: Band | None = None
    assigned_to: str | None = None
    needs_my_action: bool = False
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class QueueCounts(BaseModel):
    needs_me: int
    under_review: int
    awaiting_appeal: int
    decided: int
    closed: int
    dismissed_flags: int


class QueuePage(BaseModel):
    items: list[QueueRow]
    total: int
    counts: QueueCounts


class DismissedFlag(BaseModel):
    similarity_report_id: str
    submission_id: str
    learner_id: str
    raw_score: Score
    quoted_score: Score
    template_score: Score
    adjusted_score: Score
    dismissal_reason: DismissalReason


class FlagPage(BaseModel):
    items: list[DismissedFlag]
    total: int


class TimelineEvent(BaseModel):
    event_id: int
    event_type: EventType
    occurred_at: UtcTime
    actor_id: str | None
    actor_name: str | None
    from_status: Status | None
    to_status: Status | None
    ref_id: str | None
    reason: str | None


class EligibleReviewer(Reviewer):
    eligible: bool
    reasons: list[Reason]


class FindingOut(BaseModel):
    issue_type: str
    case_id: str
    entity_id: str
    detail: str


class AuditFindings(BaseModel):
    counts: dict[str, int]
    findings: list[FindingOut]
