"""Audit use cases: run the auditor live, and serve the evaluation and validation files."""

import json
from pathlib import Path
from typing import Any

from psycopg.rows import tuple_row

from integrity.auditor import audit
from integrity.errors import NotFoundError
from integrity.models import IssueType
from integrity.queries import cases
from integrity.schemas import AuditFindings, FindingOut
from integrity.services.common import Connection


def findings(con: Connection, case_id: str | None) -> AuditFindings:
    """Run the due-process auditor now (optionally for one case); counts include zero types."""
    if case_id is not None and cases.header(con, case_id) is None:
        raise NotFoundError(f"Case {case_id} does not exist.")
    previous = con.row_factory
    con.row_factory = tuple_row  # type: ignore[assignment]  # the auditor unpacks plain tuples
    try:
        found = audit(con, case_id)
    finally:
        con.row_factory = previous
    counts = {issue.value: sum(1 for f in found if f.issue_type == issue) for issue in IssueType}
    return AuditFindings(
        counts=counts,
        findings=[FindingOut(**vars(f)) for f in found],
    )


def read_file(data_dir: Path, name: str) -> dict[str, Any]:
    """A JSON file written by `cli eval` or `cli validate --scale`; 404 until it exists."""
    path = data_dir / name
    if not path.is_file():
        raise NotFoundError(f"{name} has not been generated yet (run the CLI for this scale).")
    payload: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return payload
