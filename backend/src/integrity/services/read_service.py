"""Read use cases: lists, the case detail with its checks and explanation, the timeline."""

from datetime import datetime

from integrity.errors import NotFoundError
from integrity.models import Reviewer, Rule, Status
from integrity.queries import cases, events, flags, reviewers
from integrity.rules import (
    Actor,
    Scores,
    action_checks,
    allowed_actions,
    conflict_reasons,
    explain_triage,
    independence_reasons,
    triage,
)
from integrity.schemas import (
    AppealOut,
    AssessmentRef,
    CaseDetail,
    CaseReviewerOut,
    DecisionOut,
    DismissedFlag,
    EligibleReviewer,
    EvidenceOut,
    FlagDetail,
    FlagPage,
    LearnerRef,
    QueueCounts,
    QueueFilter,
    QueuePage,
    QueueRow,
    TimelineEvent,
)
from integrity.services.common import Connection, facts_from_row, reviewer_candidates


def list_reviewers(con: Connection) -> list[Reviewer]:
    return [Reviewer.model_validate(r) for r in reviewers.list_reviewers(con)]


def list_rules(con: Connection) -> list[Rule]:
    return [Rule.model_validate(r) for r in reviewers.list_rules(con)]


def _matches(row: dict[str, object], needs: bool, wanted: QueueFilter) -> bool:
    assignees = row["assignee_ids"]
    return (
        (wanted.status is None or row["status"] == wanted.status)
        and (wanted.band is None or row["band"] == wanted.band)
        and (wanted.assigned_to is None or wanted.assigned_to in assignees)  # type: ignore[operator]
        and (needs or not wanted.needs_my_action)
    )


def _counts(statuses: list[str], needs_me: int, dismissed: int) -> QueueCounts:
    def total(*names: Status) -> int:
        return sum(1 for s in statuses if s in names)

    return QueueCounts(
        needs_me=needs_me,
        under_review=total(Status.OPEN, Status.UNDER_REVIEW),
        awaiting_appeal=total(Status.APPEALED, Status.APPEAL_REVIEW),
        decided=total(Status.DECIDED, Status.APPEAL_DECIDED),
        closed=total(Status.CLOSED),
        dismissed_flags=dismissed,
    )


def queue(con: Connection, actor: Actor, wanted: QueueFilter, now: datetime) -> QueuePage:
    """Cases newest first with the actor's needs_my_action, a page and counts over all cases."""
    rows = cases.all_facts(con)
    needs = [bool(allowed_actions(actor, facts_from_row(r), now)) for r in rows]
    shown = [(r, n) for r, n in zip(rows, needs, strict=True) if _matches(r, n, wanted)]
    page = shown[wanted.offset : wanted.offset + wanted.limit]
    items = [QueueRow.model_validate({**r, "needs_my_action": n}) for r, n in page]
    counts = _counts([r["status"] for r in rows], sum(needs), flags.count_dismissed(con))
    return QueuePage(items=items, total=len(shown), counts=counts)


def dismissed_flags(con: Connection, limit: int, offset: int) -> FlagPage:
    rows, total = flags.dismissed(con, limit, offset)
    return FlagPage(items=[DismissedFlag.model_validate(r) for r in rows], total=total)


def case_detail(con: Connection, actor: Actor, case_id: str, now: datetime) -> CaseDetail:
    """The full case with this actor's allowed actions and every action's checks."""
    head = cases.header(con, case_id)
    facts_row = cases.facts(con, case_id)
    if head is None or facts_row is None:
        raise NotFoundError(f"Case {case_id} does not exist.")
    rule = Rule.model_validate(head)
    scores = Scores(head["raw_score"], head["quoted_score"], head["template_score"])
    facts = facts_from_row(facts_row)
    appeal = cases.appeal_of(con, case_id)
    return CaseDetail(
        case_id=case_id,
        status=head["status"],
        opened_at=head["opened_at"],
        closed_at=head["closed_at"],
        learner=LearnerRef(
            learner_id=head["learner_id"],
            name=head["learner_name"],
            department=head["learner_department"],
        ),
        assessment=AssessmentRef(
            assessment_id=head["assessment_id"],
            title=head["assessment_title"],
            instructor_id=head["instructor_id"],
        ),
        flag=FlagDetail(
            similarity_report_id=head["similarity_report_id"],
            rule=rule,
            raw_score=scores.raw,
            quoted_score=scores.quoted,
            template_score=scores.template,
            adjusted_score=scores.adjusted,
            band=triage(scores, rule).band,
            explanation=explain_triage(scores, rule),
        ),
        reviewers=[CaseReviewerOut.model_validate(r) for r in cases.reviewers_of(con, case_id)],
        evidence=[EvidenceOut.model_validate(r) for r in cases.evidence_of(con, case_id)],
        decisions=[DecisionOut.model_validate(r) for r in cases.decisions_of(con, case_id)],
        appeal=AppealOut.model_validate(appeal) if appeal else None,
        effective_outcome=head["effective_outcome"],
        allowed_actions=allowed_actions(actor, facts, now),
        action_checks=action_checks(actor, facts, now),
    )


def timeline(con: Connection, case_id: str) -> list[TimelineEvent]:
    if cases.header(con, case_id) is None:
        raise NotFoundError(f"Case {case_id} does not exist.")
    return [TimelineEvent.model_validate(r) for r in events.timeline(con, case_id)]


def eligible_reviewers(con: Connection, case_id: str, purpose: str) -> list[EligibleReviewer]:
    """Everyone with a verdict: conflict reasons for a case, independence reasons for its appeal."""
    judge = independence_reasons if purpose == "appeal" else conflict_reasons
    result = []
    for row, facts in reviewer_candidates(con, case_id):
        reasons = judge(facts)
        result.append(
            EligibleReviewer(
                **Reviewer.model_validate(row).model_dump(), eligible=not reasons, reasons=reasons
            )
        )
    return result
