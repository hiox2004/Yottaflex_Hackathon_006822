"""Test Lab import: turn Test Lab cases into real submissions, reports, cases and evidence.

The whole request is one transaction (all or nothing). Each case is triaged by the in-force rule
with the real `triage()`, so the outcome matches the pipeline. Only a case that opens gets a case,
its evidence and the timeline events. Dismissed flags and non-flags keep a submission and report
only, and surface in the Dismissed tab through v_flag.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from integrity import ids
from integrity.clock import Clock
from integrity.errors import RuleViolation
from integrity.models import Role, Rule, Status
from integrity.queries import events, lab_import, writes
from integrity.queries.events import NewEvent
from integrity.rules import Actor, Scores, triage
from integrity.services import read_service
from integrity.services.common import Connection
from integrity.services.lab_service import LabCase

WORD_COUNT = 1000  # a Test Lab case has no document; word_count only has to be positive
STEP = Decimal("0.001")  # similarity_report scores are numeric(4,3)
ADMIN_ONLY = "Only an academic administrator can import test cases."


class LabImportCase(LabCase):
    """A Test Lab case to import. Its reviewer, decision, late_evidence and expect are ignored."""

    learner_id: str | None = Field(default=None, pattern=r"^LRN-\d{6}$")
    assessment_id: str | None = Field(default=None, pattern=r"^ASM-\d{6}$")


class LabImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cases: list[LabImportCase] = Field(min_length=1, max_length=100)


class LabImported(BaseModel):
    lab_id: str
    submission_id: str
    similarity_report_id: str
    outcome: Literal["case_opened", "dismissed", "not_flagged"]
    case_id: str | None
    evidence_ids: list[str]


class LabImportResponse(BaseModel):
    created: list[LabImported]


def _invalid(message: str) -> RuleViolation:
    return RuleViolation("VALIDATION_ERROR", message)


def _score(value: float, case_id: str, name: str) -> Decimal:
    exact = Decimal(str(value))
    if exact != exact.quantize(STEP, rounding=ROUND_HALF_UP):
        raise _invalid(f"Case {case_id}: the {name} score may have at most three decimals.")
    return exact


def _scores(case: LabCase) -> Scores:
    raw = _score(case.scores.raw, case.id, "raw")
    quoted = _score(case.scores.quoted, case.id, "quoted")
    template = _score(case.scores.template, case.id, "template")
    if quoted + template > raw:  # the database rule behind similarity_report
        raise _invalid(
            f"Case {case.id}: quoted and template scores cannot add up to more than raw."
        )
    return Scores(raw, quoted, template)


def _chosen(given: str | None, options: list[str], position: int, label: str, case_id: str) -> str:
    """The id named in the request (it must exist), else a deterministic round-robin pick."""
    if given is not None:
        if given not in options:
            raise _invalid(f"Case {case_id}: {given} is not a {label} in the database.")
        return given
    if not options:
        raise _invalid(f"There are no {label}s to attach the test cases to.")
    return options[position % len(options)]


@dataclass(frozen=True)
class _Batch:
    """What every case in one import shares: who imports, the rule, the instant and the id pools."""

    actor: Actor
    rule: Rule
    at: datetime
    learners: list[str]
    assessments: list[str]


def _add_evidence(con: Connection, batch: _Batch, case_id: str, case: LabImportCase) -> list[str]:
    """Evidence rows for a case that has just opened, numbered 001.. with one event each."""
    seen: set[tuple[str, str]] = set()
    evidence_ids: list[str] = []
    for number, item in enumerate(case.evidence, start=1):
        key = (item.kind.value, item.description)
        if key in seen:
            raise _invalid(f"Case {case.id}: the same evidence is listed twice.")
        seen.add(key)
        evidence_id = ids.evidence_id(case_id, number)
        writes.insert_evidence(
            con,
            {
                "evidence_id": evidence_id,
                "case_id": case_id,
                "kind": item.kind.value,
                "description": item.description,
                "added_at": batch.at,
                "added_by": batch.actor.reviewer_id,
            },
        )
        events.insert(
            con,
            NewEvent(
                case_id, "evidence_added", batch.at, batch.actor.reviewer_id, ref_id=evidence_id
            ),
        )
        evidence_ids.append(evidence_id)
    return evidence_ids


def _import_one(con: Connection, batch: _Batch, position: int, case: LabImportCase) -> LabImported:
    at, rule = batch.at, batch.rule
    scores = _scores(case)
    learner = _chosen(case.learner_id, batch.learners, position, "learner", case.id)
    assessment = _chosen(case.assessment_id, batch.assessments, position, "assessment", case.id)
    result = triage(scores, rule)

    submission_id = ids.submission_id(lab_import.next_submission_no(con))
    lab_import.insert_submission(
        con,
        {
            "submission_id": submission_id,
            "learner_id": learner,
            "assessment_id": assessment,
            "attempt_no": lab_import.next_attempt_no(con, learner, assessment),
            "submitted_at": at,
            "word_count": WORD_COUNT,
        },
    )
    report_id = ids.report_id(submission_id)
    lab_import.insert_report(
        con,
        {
            "similarity_report_id": report_id,
            "submission_id": submission_id,
            "rule_id": rule.rule_id,
            "raw_score": scores.raw,
            "quoted_score": scores.quoted,
            "template_score": scores.template,
            "generated_at": at,
        },
    )
    if not result.opens_case:
        outcome: Literal["dismissed", "not_flagged"] = (
            "dismissed" if result.is_flag else "not_flagged"
        )
        return LabImported(
            lab_id=case.id,
            submission_id=submission_id,
            similarity_report_id=report_id,
            outcome=outcome,
            case_id=None,
            evidence_ids=[],
        )

    case_id = ids.case_id(lab_import.next_case_no(con))
    lab_import.insert_case(
        con, {"case_id": case_id, "similarity_report_id": report_id, "opened_at": at}
    )
    # Opened by the system (actor NULL), as the seed and the pipeline write it.
    opened = NewEvent(case_id, "case_opened", at, None, to_status=Status.OPEN.value)
    events.insert(con, opened)
    evidence_ids = _add_evidence(con, batch, case_id, case)
    return LabImported(
        lab_id=case.id,
        submission_id=submission_id,
        similarity_report_id=report_id,
        outcome="case_opened",
        case_id=case_id,
        evidence_ids=evidence_ids,
    )


def import_cases(
    con: Connection, clock: Clock, actor: Actor, body: LabImportRequest
) -> LabImportResponse:
    if actor.role is not Role.ACADEMIC_ADMINISTRATOR:
        raise RuleViolation("ROLE_NOT_ALLOWED", ADMIN_ONLY)
    rule = next(r for r in read_service.list_rules(con) if r.effective_to is None)
    # A submission falls under the rule it is scored by, so never earlier than that rule's start.
    at = max(clock.now(), rule.effective_from)
    with con.transaction():
        lab_import.lock_import(con)
        batch = _Batch(actor, rule, at, lab_import.learner_ids(con), lab_import.assessment_ids(con))
        created = [
            _import_one(con, batch, position, case) for position, case in enumerate(body.cases)
        ]
    return LabImportResponse(created=created)
