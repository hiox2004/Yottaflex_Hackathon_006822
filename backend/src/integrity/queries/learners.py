"""Learners (students): the actor lookup for learner sign-in and the actor search."""

from typing import Any

import psycopg

Row = dict[str, Any]


def get_learner(con: psycopg.Connection[Row], learner_id: str) -> Row | None:
    sql = "SELECT learner_id, name, department FROM learner WHERE learner_id = %s"
    return con.execute(sql, (learner_id,)).fetchone()


def search_learners(con: psycopg.Connection[Row], pattern: str, limit: int) -> list[Row]:
    """Learners whose id, name or department matches the ILIKE pattern, by name."""
    sql = """SELECT learner_id, name, department FROM learner
             WHERE name ILIKE %(p)s OR learner_id ILIKE %(p)s OR department ILIKE %(p)s
             ORDER BY name, learner_id LIMIT %(n)s"""
    return con.execute(sql, {"p": pattern, "n": limit}).fetchall()
