"""Reference data: reviewers (the actor picker) and rule versions."""

from typing import Annotated, Literal

from fastapi import APIRouter, Query

from integrity.api.deps import Con, Who
from integrity.models import Reviewer, Rule
from integrity.schemas import ActorOut
from integrity.services import read_service

router = APIRouter(tags=["reference"])


@router.get("/reviewers")
def reviewers(con: Con) -> list[Reviewer]:
    """Open to any caller, because the UI needs it to choose who to act as."""
    return read_service.list_reviewers(con)


@router.get("/actors")
def actors(
    con: Con,
    role: Literal["learner", "staff"] = "staff",
    q: str = "",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[ActorOut]:
    """Learners or staff matching `q` by id, name or department. Open to any caller."""
    return read_service.search_actors(con, role, q, limit)


@router.get("/rules")
def rules(con: Con, _actor: Who) -> list[Rule]:
    return read_service.list_rules(con)
