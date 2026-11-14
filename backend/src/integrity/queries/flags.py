"""Auto-dismissed flags (read-only), from the v_flag view."""

from typing import Any

import psycopg

Row = dict[str, Any]


# `learner_id` NULL means every learner (staff); a learner passes their own id.
_DISMISSED = """FROM v_flag WHERE outcome = 'dismissed'
  AND (%(learner_id)s::text IS NULL OR learner_id = %(learner_id)s)"""


def count_dismissed(con: psycopg.Connection[Row], learner_id: str | None = None) -> int:
    row = con.execute(f"SELECT count(*) AS n {_DISMISSED}", {"learner_id": learner_id}).fetchone()
    return int(row["n"]) if row else 0


def dismissed(
    con: psycopg.Connection[Row], limit: int, offset: int, learner_id: str | None = None
) -> tuple[list[Row], int]:
    """A page of dismissed flags in id order, and the total."""
    sql = f"""SELECT similarity_report_id, submission_id, learner_id, raw_score, quoted_score,
                     template_score, adjusted_score, dismissal_reason
              {_DISMISSED} ORDER BY similarity_report_id LIMIT %(limit)s OFFSET %(offset)s"""
    params = {"learner_id": learner_id, "limit": limit, "offset": offset}
    rows = con.execute(sql, params).fetchall()
    return rows, count_dismissed(con, learner_id)
