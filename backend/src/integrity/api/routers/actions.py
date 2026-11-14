"""Write endpoints: each runs one service transaction and returns the updated CaseDetail."""

from fastapi import APIRouter

from integrity.api.deps import Con, Now, Who
from integrity.schemas import (
    AppealBody,
    AppealOutcomeBody,
    AppealReviewerBody,
    AssignReviewerBody,
    CaseDetail,
    CloseBody,
    DecisionBody,
    EvidenceBody,
    RecuseBody,
    ReopenBody,
)
from integrity.services import appeal_service, case_service

router = APIRouter(tags=["actions"])


@router.post("/cases/{case_id}/reviewers")
def assign_reviewer(
    case_id: str, body: AssignReviewerBody, con: Con, actor: Who, clock: Now
) -> CaseDetail:
    return case_service.assign_reviewer(con, clock, actor, case_id, body)


@router.post("/cases/{case_id}/evidence")
def add_evidence(case_id: str, body: EvidenceBody, con: Con, actor: Who, clock: Now) -> CaseDetail:
    return case_service.add_evidence(con, clock, actor, case_id, body)


@router.post("/cases/{case_id}/reopen")
def reopen(case_id: str, body: ReopenBody, con: Con, actor: Who, clock: Now) -> CaseDetail:
    return case_service.reopen(con, clock, actor, case_id, body)


@router.post("/cases/{case_id}/recuse")
def recuse(case_id: str, body: RecuseBody, con: Con, actor: Who, clock: Now) -> CaseDetail:
    return case_service.recuse(con, clock, actor, case_id, body)


@router.post("/cases/{case_id}/decision")
def decide(case_id: str, body: DecisionBody, con: Con, actor: Who, clock: Now) -> CaseDetail:
    return case_service.decide(con, clock, actor, case_id, body)


@router.post("/cases/{case_id}/appeal")
def file_appeal(case_id: str, body: AppealBody, con: Con, actor: Who, clock: Now) -> CaseDetail:
    return appeal_service.file_appeal(con, clock, actor, case_id, body)


@router.post("/cases/{case_id}/appeal/reviewer")
def assign_appeal_reviewer(
    case_id: str, body: AppealReviewerBody, con: Con, actor: Who, clock: Now
) -> CaseDetail:
    return appeal_service.assign_appeal_reviewer(con, clock, actor, case_id, body)


@router.post("/cases/{case_id}/appeal/outcome")
def decide_appeal(
    case_id: str, body: AppealOutcomeBody, con: Con, actor: Who, clock: Now
) -> CaseDetail:
    return appeal_service.decide_appeal(con, clock, actor, case_id, body)


@router.post("/cases/{case_id}/close")
def close(
    case_id: str, con: Con, actor: Who, clock: Now, body: CloseBody | None = None
) -> CaseDetail:
    return case_service.close(con, clock, actor, case_id, body)
