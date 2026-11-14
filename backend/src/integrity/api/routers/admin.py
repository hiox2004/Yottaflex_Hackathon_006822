"""The administrator's work overview: staff workload and assignment suggestions."""

from fastapi import APIRouter

from integrity.api.deps import Con, Now, Who
from integrity.services import workload_service

router = APIRouter(tags=["admin"])


@router.get("/admin/workload")
def admin_workload(con: Con, actor: Who, clock: Now) -> workload_service.Workload:
    return workload_service.overview(con, actor, clock.now())
