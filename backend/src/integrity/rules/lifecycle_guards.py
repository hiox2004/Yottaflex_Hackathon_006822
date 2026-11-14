"""Field guards for case writes: who may act on a case, and what evidence and decisions must carry.

Each guard raises `RuleViolation` with a stable code and a plain-language message. They are pure
functions over the values passed in; the state machine itself lives in `lifecycle`.
"""

from collections.abc import Collection
from dataclasses import dataclass
from datetime import datetime

from integrity.errors import RuleViolation
from integrity.models import (
    ConflictCode,
    DecisionOutcome,
    EvidenceKind,
    Reason,
    Role,
    Status,
)
from integrity.rules.lifecycle_messages import INDEPENDENCE_MESSAGE, OWN_CASE_MESSAGE


@dataclass(frozen=True)
class Actor:
    """The signed-in person. `reviewer_id` holds a staff id (REV-...) or a learner id (LRN-...)."""

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
    learner_id: str | None = None  # the learner whose case this is (their own cases only)


def guard_case_owner(actor: Actor, learner_id: str | None) -> None:
    """A learner sees and acts only on their own case; staff are not limited by ownership."""
    if actor.role is Role.LEARNER and actor.reviewer_id != learner_id:
        raise RuleViolation("NOT_YOUR_CASE", OWN_CASE_MESSAGE)


def guard_evidence_kind(actor: Actor, kind: EvidenceKind) -> None:
    """Learners and support staff may only record the learner's own statement."""
    if actor.role is Role.LEARNER and kind is not EvidenceKind.LEARNER_STATEMENT:
        raise RuleViolation("STATEMENT_ONLY", "Learners can add a statement only.")
    if actor.role is Role.SUPPORT_STAFF and kind is not EvidenceKind.LEARNER_STATEMENT:
        raise RuleViolation(
            "ROLE_NOT_ALLOWED", "Support staff can only add the learner's own statement."
        )


def guard_cited_evidence(cited: Collection[str], case_evidence_ids: Collection[str]) -> None:
    """A decision cites at least one evidence item, and only items of this case."""
    unknown = sorted(set(cited) - set(case_evidence_ids))
    if not cited:
        message = "Choose at least one piece of this case's evidence to support the decision."
        raise RuleViolation("EVIDENCE_REQUIRED", message, {"unknown_evidence_ids": unknown})
    if unknown:
        message = (
            "Some cited evidence does not belong to this case. Cite only evidence listed here."
        )
        raise RuleViolation("EVIDENCE_REQUIRED", message, {"unknown_evidence_ids": unknown})


_INCRIMINATING = frozenset({EvidenceKind.MATCHED_PASSAGE, EvidenceKind.SOURCE_REFERENCE})
_MIN_FINDING_LENGTH = 20


def guard_confirmed_violation(
    outcome: DecisionOutcome, rationale: str, cited_kinds: Collection[EvidenceKind]
) -> None:
    """A confirmed violation needs a real finding and at least one incriminating item cited.

    Quotes, templates and learner statements can explain an overlap but cannot prove it.
    No-violation and inconclusive decisions keep the looser rule of `guard_cited_evidence`.
    """
    if outcome is not DecisionOutcome.VIOLATION_CONFIRMED:
        return
    if len(rationale.strip()) < _MIN_FINDING_LENGTH:
        raise RuleViolation(
            "RATIONALE_TOO_SHORT",
            "To confirm a violation, explain the finding in at least 20 characters. "
            "The learner will read this.",
        )
    if not _INCRIMINATING.intersection(cited_kinds):
        raise RuleViolation(
            "NO_INCRIMINATING_EVIDENCE",
            "To confirm a violation, cite at least one matched passage or source reference. "
            "Quotes, templates and learner statements alone do not support it.",
        )


def guard_appeal_reassignment(reviewer_id: str, facts: CaseFacts) -> None:
    """A reassigned appeal must go to someone other than the reviewer who holds it now."""
    if facts.appeal_reviewer_id == reviewer_id:
        raise RuleViolation(
            "SAME_APPEAL_REVIEWER",
            f"{reviewer_id} already holds this appeal. Choose a different appeal reviewer.",
        )


def guard_recusal_reason(reason: str) -> None:
    """A recusal must say why: the reason is the only record of the step aside."""
    if not reason.strip():
        raise RuleViolation(
            "RECUSAL_REASON_REQUIRED",
            "Say why you are stepping aside. The reason is kept in the case history.",
        )


def guard_assignment(reasons: list[Reason], reviewer_id: str, code: str) -> None:
    """Raise `code` (CONFLICT_OF_INTEREST or NOT_INDEPENDENT) if any reason counts against.

    A candidate whose role cannot review at all is a bad request (VALIDATION_ERROR), not a conflict.
    """
    if reasons:
        codes = [r.code for r in reasons]
        if ConflictCode.ROLE_CANNOT_REVIEW in codes:
            code = "VALIDATION_ERROR"
        message = INDEPENDENCE_MESSAGE if code == "NOT_INDEPENDENT" else reasons[0].message
        details = {"reviewer_id": reviewer_id, "reasons": codes}
        raise RuleViolation(code, message, details)
