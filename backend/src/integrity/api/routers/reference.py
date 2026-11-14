"""Reference data: reviewers (the actor picker) and rule versions."""

from fastapi import APIRouter

from integrity.api.deps import Con, Who
from integrity.models import Reviewer, Rule
from integrity.services import read_service

router = APIRouter(tags=["reference"])


@router.get("/reviewers")
def reviewers(con: Con) -> list[Reviewer]:
    """Open to any caller, because the UI needs it to choose who to act as."""
    return read_service.list_reviewers(con)


@router.get("/rules")
def rules(con: Con, _actor: Who) -> list[Rule]:
    return read_service.list_rules(con)
