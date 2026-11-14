"""Audit endpoints: the live auditor, the evaluation metrics and the validation summary."""

from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from integrity.api.deps import Con, Who
from integrity.config import REPO_ROOT, get_settings
from integrity.schemas import AuditFindings
from integrity.services import audit_service

router = APIRouter(tags=["audit"])


def get_data_dir() -> Path:
    """The data/<scale>/ folder whose evaluation files the API serves."""
    return REPO_ROOT / "data" / get_settings().data_scale


DataDir = Annotated[Path, Depends(get_data_dir)]


@router.get("/audit/findings")
def findings(con: Con, _actor: Who, case_id: str | None = None) -> AuditFindings:
    return audit_service.findings(con, case_id)


@router.get("/audit/metrics")
def metrics(_actor: Who, data_dir: DataDir) -> dict[str, Any]:
    return audit_service.read_file(data_dir, "metrics.json")


@router.get("/audit/validation")
def validation(_actor: Who, data_dir: DataDir) -> dict[str, Any]:
    return audit_service.read_file(data_dir, "validation.json")
