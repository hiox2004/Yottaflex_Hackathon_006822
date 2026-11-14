"""Data-quality checks (stub until D2)."""

from dataclasses import dataclass
from typing import Any

import psycopg


@dataclass(frozen=True)
class Violation:
    """One failed data-quality check, located by the offending row."""

    check: str
    entity_id: str
    detail: str


def run_checks(con: psycopg.Connection[Any]) -> list[Violation]:
    """Run every data-quality check and return the violations."""
    raise NotImplementedError


def summarize(con: psycopg.Connection[Any]) -> dict[str, Any]:
    """Counts, per-check results and distribution tables."""
    raise NotImplementedError
