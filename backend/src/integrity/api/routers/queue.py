"""The case queue and the auto-dismissed flags."""

from typing import Annotated, Literal

from fastapi import APIRouter, Query

from integrity.api.deps import Con, Now, Who
from integrity.schemas import FlagPage, QueueFilter, QueuePage
from integrity.services import read_service

router = APIRouter(tags=["queue"])
Limit = Annotated[int, Query(ge=1, le=200)]
Offset = Annotated[int, Query(ge=0)]


@router.get("/queue")
def queue(con: Con, actor: Who, clock: Now, wanted: Annotated[QueueFilter, Query()]) -> QueuePage:
    return read_service.queue(con, actor, wanted, clock.now())


@router.get("/flags")
def flags(
    con: Con,
    _actor: Who,
    outcome: Literal["dismissed"] = "dismissed",
    limit: Limit = 50,
    offset: Offset = 0,
) -> FlagPage:
    return read_service.dismissed_flags(con, limit, offset)
