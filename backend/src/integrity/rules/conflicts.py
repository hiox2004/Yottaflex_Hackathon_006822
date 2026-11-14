"""Conflict of interest for case reviewers and independence for appeal reviewers. Pure functions."""

from dataclasses import dataclass

from integrity.models import ConflictCode, Reason, Role

REVIEWER_ROLES = frozenset({Role.INSTRUCTOR, Role.ACADEMIC_REVIEWER})


@dataclass(frozen=True)
class ConflictFacts:
    """What is known about one candidate reviewer in relation to one case."""

    reviewer_id: str
    reviewer_role: Role
    reviewer_department: str
    learner_department: str
    assessment_instructor_id: str
    reviewed_learner_before: bool  # on any other case of the same learner
    on_case: bool
    decided_case: bool


def conflict_reasons(facts: ConflictFacts) -> list[Reason]:
    """Why this person cannot be assigned to review the case (empty when conflict-free)."""
    who = facts.reviewer_id
    reasons: list[Reason] = []
    if facts.reviewer_role not in REVIEWER_ROLES:
        reasons.append(
            Reason(code=ConflictCode.ROLE_CANNOT_REVIEW, message=f"{who} cannot review cases.")
        )
    if facts.assessment_instructor_id == who:
        reasons.append(
            Reason(
                code=ConflictCode.INSTRUCTOR_OF_ASSESSMENT,
                message=f"{who} teaches this assessment.",
            )
        )
    if facts.reviewer_department == facts.learner_department:
        reasons.append(
            Reason(
                code=ConflictCode.SAME_DEPARTMENT, message=f"{who} is in the learner's department."
            )
        )
    if facts.reviewed_learner_before:
        reasons.append(
            Reason(
                code=ConflictCode.REVIEWED_LEARNER_BEFORE,
                message=f"{who} reviewed another case of this learner.",
            )
        )
    if facts.on_case:
        reasons.append(
            Reason(code=ConflictCode.ALREADY_ON_CASE, message=f"{who} is already on this case.")
        )
    return reasons


def independence_reasons(facts: ConflictFacts) -> list[Reason]:
    """Why this person cannot review the appeal: any case conflict, or having decided the case."""
    reasons = conflict_reasons(facts)
    if facts.decided_case:
        reasons.append(
            Reason(
                code=ConflictCode.DECIDED_THIS_CASE,
                message=f"{facts.reviewer_id} decided this case.",
            )
        )
    return reasons


def is_independent(facts: ConflictFacts) -> bool:
    """True when the person may decide the appeal of this case."""
    return not independence_reasons(facts)
