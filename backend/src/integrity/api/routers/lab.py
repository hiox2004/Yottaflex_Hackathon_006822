"""Test Lab: POST cases for the rules' verdicts (nothing stored), or to import them as records."""

from fastapi import APIRouter

from integrity.api.deps import Con, Now, Staff
from integrity.services import lab_import_service, lab_service, read_service
from integrity.services.lab_import_service import LabImportRequest, LabImportResponse
from integrity.services.lab_service import LabRequest, LabResponse

router = APIRouter(tags=["lab"])


@router.post("/lab/run")
def run(body: LabRequest, con: Con, _actor: Staff) -> LabResponse:
    rule = next(r for r in read_service.list_rules(con) if r.effective_to is None)
    return lab_service.run(body, rule)


@router.post("/lab/import")
def import_cases(body: LabImportRequest, con: Con, actor: Staff, clock: Now) -> LabImportResponse:
    return lab_import_service.import_cases(con, clock, actor, body)
