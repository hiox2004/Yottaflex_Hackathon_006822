"""Due-process detectors (stub until D3)."""

from dataclasses import dataclass
from typing import Any

import psycopg


@dataclass(frozen=True)
class Finding:
    """One due-process violation, located by its case and the entity that breaks the rule."""

    issue_type: str
    case_id: str
    entity_id: str
    detail: str


def audit(con: psycopg.Connection[Any], case_id: str | None = None) -> list[Finding]:
    """Run the four detectors, optionally for one case."""
    raise NotImplementedError
