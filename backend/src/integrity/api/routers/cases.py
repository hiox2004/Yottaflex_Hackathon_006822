"""Reading one case: detail, timeline and eligible reviewers."""

from typing import Literal

from fastapi import APIRouter

from integrity.api.deps import Con, Now, Who
from integrity.schemas import CaseDetail, EligibleReviewer, TimelineEvent
from integrity.services import read_service

router = APIRouter(tags=["cases"])


@router.get("/cases/{case_id}")
def case(case_id: str, con: Con, actor: Who, clock: Now) -> CaseDetail:
    return read_service.case_detail(con, actor, case_id, clock.now())


@router.get("/cases/{case_id}/timeline")
def timeline(case_id: str, con: Con, _actor: Who) -> list[TimelineEvent]:
    return read_service.timeline(con, case_id)


@router.get("/cases/{case_id}/eligible-reviewers")
def eligible_reviewers(
    case_id: str, con: Con, _actor: Who, purpose: Literal["case", "appeal"] = "case"
) -> list[EligibleReviewer]:
    return read_service.eligible_reviewers(con, case_id, purpose)
