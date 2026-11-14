"""Test Lab: run externally written test cases through the pure rules. Stateless, never writes."""

from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from integrity.models import Band, DismissalReason, EvidenceKind, ExplainStep, Reason, Role, Rule
from integrity.rules import (
    ConflictFacts,
    Scores,
    conflict_reasons,
    explain_triage,
    independence_reasons,
    triage,
)

Unit = Field(ge=0, le=1)  # a score is a fraction


class LabScores(BaseModel):
    model_config = ConfigDict(extra="forbid")
    raw: float = Unit
    quoted: float = Unit
    template: float = Unit


class LabReviewer(BaseModel):
    """A candidate reviewer and how they relate to the case (the facts the conflict rule needs)."""

    model_config = ConfigDict(extra="forbid")
    reviewer_id: str
    role: Role = Role.ACADEMIC_REVIEWER
    department: str
    learner_department: str
    assessment_instructor_id: str = "INS-NONE"
    reviewed_learner_before: bool = False
    on_case: bool = False
    decided_case: bool = False


class LabDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    outcome: Literal["no_violation", "violation_confirmed", "inconclusive"]
    reviewer_id: str | None = None
    rationale: str = ""


class LabLateEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    case_reopened_first: bool


class LabExpect(BaseModel):
    """Any subset; only the fields present are compared."""

    model_config = ConfigDict(extra="forbid")
    is_flag: bool | None = None
    opens_case: bool | None = None
    band: Band | None = None
    dismissal_reason: DismissalReason | None = None
    reviewer_blocked: bool | None = None
    appeal_reviewer_blocked: bool | None = None
    decision_blocked: bool | None = None
    evidence_blocked: bool | None = None


class LabEvidence(BaseModel):
    """Evidence a case would carry if the import opens it. The Test Lab accepts and ignores it."""

    model_config = ConfigDict(extra="forbid")
    kind: EvidenceKind
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
    ]


class LabCase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=40)
    title: str = Field(default="", max_length=200)
    scores: LabScores
    reviewer: LabReviewer | None = None
    appeal_reviewer: LabReviewer | None = None
    decision: LabDecision | None = None
    late_evidence: LabLateEvidence | None = None
    expect: LabExpect | None = None
    evidence: list[LabEvidence] = Field(default_factory=list, max_length=6)


class LabRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cases: list[LabCase] = Field(min_length=1, max_length=200)


class LabCheck(BaseModel):
    name: str
    blocked: bool
    reasons: list[Reason]


class LabResult(BaseModel):
    id: str
    title: str
    is_flag: bool
    opens_case: bool
    band: Band
    adjusted_score: float
    dismissal_reason: DismissalReason | None
    explanation: list[ExplainStep]
    checks: list[LabCheck]
    mismatches: list[str]
    verdict: Literal["pass", "fail", "no_expectation"]


class LabResponse(BaseModel):
    rule: Rule
    passed: int
    failed: int
    no_expectation: int
    results: list[LabResult]


def _facts(r: LabReviewer) -> ConflictFacts:
    return ConflictFacts(
        reviewer_id=r.reviewer_id,
        reviewer_role=r.role,
        reviewer_department=r.department,
        learner_department=r.learner_department,
        assessment_instructor_id=r.assessment_instructor_id,
        reviewed_learner_before=r.reviewed_learner_before,
        on_case=r.on_case,
        decided_case=r.decided_case,
    )


def _decision_reasons(d: LabDecision) -> list[Reason]:
    reasons: list[Reason] = []
    if d.outcome == "violation_confirmed" and d.reviewer_id is None:
        reasons.append(
            Reason(
                code="NO_HUMAN_REVIEWER",
                message="A violation cannot be confirmed without a human reviewer.",
            )
        )
    if not d.rationale.strip():
        reasons.append(
            Reason(code="RATIONALE_REQUIRED", message="Every decision needs a written rationale.")
        )
    return reasons


def _checks(case: LabCase) -> list[LabCheck]:
    out: list[LabCheck] = []
    if case.reviewer:
        why = conflict_reasons(_facts(case.reviewer))
        out.append(LabCheck(name="reviewer_assignment", blocked=bool(why), reasons=why))
    if case.appeal_reviewer:
        why = independence_reasons(_facts(case.appeal_reviewer))
        out.append(LabCheck(name="appeal_reviewer_independence", blocked=bool(why), reasons=why))
    if case.decision:
        why = _decision_reasons(case.decision)
        out.append(LabCheck(name="decision", blocked=bool(why), reasons=why))
    if case.late_evidence:
        why = (
            []
            if case.late_evidence.case_reopened_first
            else [
                Reason(
                    code="REOPEN_REQUIRED",
                    message="Evidence after a decision needs the case reopened first, "
                    "so history is kept.",
                )
            ]
        )
        out.append(LabCheck(name="late_evidence", blocked=bool(why), reasons=why))
    return out


_BLOCKED_KEY = {
    "reviewer_assignment": "reviewer_blocked",
    "appeal_reviewer_independence": "appeal_reviewer_blocked",
    "decision": "decision_blocked",
    "late_evidence": "evidence_blocked",
}


def _mismatches(expect: LabExpect, actual: dict[str, object]) -> list[str]:
    wanted = expect.model_dump(exclude_none=True)
    return [
        f"{k}: expected {v}, got {actual.get(k)}" for k, v in wanted.items() if actual.get(k) != v
    ]


def run_case(case: LabCase, rule: Rule) -> LabResult:
    scores = Scores(
        Decimal(str(case.scores.raw)),
        Decimal(str(case.scores.quoted)),
        Decimal(str(case.scores.template)),
    )
    result = triage(scores, rule)
    checks = _checks(case)
    actual: dict[str, object] = {
        "is_flag": result.is_flag,
        "opens_case": result.opens_case,
        "band": result.band,
        "dismissal_reason": result.dismissal_reason,
        **{_BLOCKED_KEY[c.name]: c.blocked for c in checks},
    }
    misses = _mismatches(case.expect, actual) if case.expect else []
    verdict: Literal["pass", "fail", "no_expectation"] = (
        "no_expectation" if case.expect is None else ("fail" if misses else "pass")
    )
    return LabResult(
        id=case.id,
        title=case.title,
        is_flag=result.is_flag,
        opens_case=result.opens_case,
        band=result.band,
        adjusted_score=float(scores.adjusted),
        dismissal_reason=result.dismissal_reason,
        explanation=explain_triage(scores, rule),
        checks=checks,
        mismatches=misses,
        verdict=verdict,
    )


def run(request: LabRequest, rule: Rule) -> LabResponse:
    results = [run_case(c, rule) for c in request.cases]

    def count(verdict: str) -> int:
        return sum(1 for r in results if r.verdict == verdict)

    return LabResponse(
        rule=rule,
        passed=count("pass"),
        failed=count("fail"),
        no_expectation=count("no_expectation"),
        results=results,
    )
