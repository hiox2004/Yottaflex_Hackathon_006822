"""Staff workload for the academic administrator: queue totals, reviewer load and assignment hints.

Suggestions reuse the assign endpoint's own verdict (`read_service.eligible_reviewers`), so a
suggested reviewer is always one the assign endpoint would accept.
"""

from datetime import datetime

from pydantic import BaseModel

from integrity.errors import RuleViolation
from integrity.models import Band, Role, Score, Status, UtcTime
from integrity.queries import flags, workload
from integrity.rules import Actor
from integrity.rules.lifecycle import ADMIN
from integrity.services import read_service
from integrity.services.common import Connection

SUGGESTION_CASES = 10  # the oldest open cases get a suggestion list
SUGGESTIONS_PER_CASE = 3


class WorkloadTotals(BaseModel):
    unassigned: int  # status open
    under_review: int
    decided_waiting_close: int  # status decided
    appeals_waiting_reviewer: int  # status appealed
    appeals_in_review: int  # status appeal_review
    closed: int
    dismissed_flags: int


class ReviewerLoad(BaseModel):
    reviewer_id: str
    name: str
    role: Role
    department: str
    active_cases: int  # assigned, or appeal reviewer, on a case under review or in appeal review
    under_review: int
    decided: int  # decisions this reviewer recorded
    appeals_to_decide: int
    total_assigned_ever: int


class SuggestedReviewer(BaseModel):
    reviewer_id: str
    name: str
    active_cases: int


class CaseSuggestion(BaseModel):
    case_id: str
    learner_name: str
    assessment_title: str
    band: Band
    adjusted_score: Score
    suggested: list[SuggestedReviewer]


class Workload(BaseModel):
    generated_at: UtcTime
    totals: WorkloadTotals
    reviewers: list[ReviewerLoad]
    suggested_for_unassigned: list[CaseSuggestion]


def _totals(con: Connection) -> WorkloadTotals:
    counts = workload.status_counts(con)

    def n(status: Status) -> int:
        return counts.get(status.value, 0)

    return WorkloadTotals(
        unassigned=n(Status.OPEN),
        under_review=n(Status.UNDER_REVIEW),
        decided_waiting_close=n(Status.DECIDED),
        appeals_waiting_reviewer=n(Status.APPEALED),
        appeals_in_review=n(Status.APPEAL_REVIEW),
        closed=n(Status.CLOSED),
        dismissed_flags=flags.count_dismissed(con),
    )


def overview(con: Connection, actor: Actor, now: datetime) -> Workload:
    """The administrator's workload view. Only an academic administrator may read it."""
    if actor.role is not ADMIN:
        raise RuleViolation(
            "ROLE_NOT_ALLOWED", "Only an academic administrator can see staff workload."
        )
    reviewers = [ReviewerLoad.model_validate(r) for r in workload.reviewer_load(con)]
    load = {r.reviewer_id: r.active_cases for r in reviewers}
    suggestions = []
    for case in workload.oldest_open(con, SUGGESTION_CASES):
        eligible = [
            SuggestedReviewer(
                reviewer_id=e.reviewer_id, name=e.name, active_cases=load.get(e.reviewer_id, 0)
            )
            for e in read_service.eligible_reviewers(con, case["case_id"], "case")
            if e.eligible
        ]
        eligible.sort(key=lambda s: (s.active_cases, s.name, s.reviewer_id))
        suggestions.append(
            CaseSuggestion(
                case_id=case["case_id"],
                learner_name=case["learner_name"],
                assessment_title=case["assessment_title"],
                band=case["band"],
                adjusted_score=case["adjusted_score"],
                suggested=eligible[:SUGGESTIONS_PER_CASE],
            )
        )
    return Workload(
        generated_at=now,
        totals=_totals(con),
        reviewers=reviewers,
        suggested_for_unassigned=suggestions,
    )
