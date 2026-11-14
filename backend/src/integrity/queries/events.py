"""The append-only case timeline."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import psycopg

Row = dict[str, Any]


@dataclass(frozen=True)
class NewEvent:
    case_id: str
    event_type: str
    occurred_at: datetime
    actor_id: str | None
    ref_id: str | None = None
    reason: str | None = None
    from_status: str | None = None
    to_status: str | None = None


def timeline(con: psycopg.Connection[Row], case_id: str) -> list[Row]:
    """Events oldest first with the actor's name; actor NULL means the system."""
    sql = """SELECT e.case_event_id AS event_id, e.event_type, e.occurred_at, e.actor_id,
                    r.name AS actor_name, e.from_status, e.to_status, e.ref_id, e.reason
             FROM case_event e LEFT JOIN reviewer r ON r.reviewer_id = e.actor_id
             WHERE e.case_id = %s ORDER BY e.occurred_at, e.case_event_id"""
    return con.execute(sql, (case_id,)).fetchall()


def insert(con: psycopg.Connection[Row], event: NewEvent) -> None:
    sql = """INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at,
                                     actor_id, ref_id, reason)
             VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
    params = (
        event.case_id,
        event.event_type,
        event.from_status,
        event.to_status,
        event.occurred_at,
        event.actor_id,
        event.ref_id,
        event.reason,
    )
    con.execute(sql, params)
