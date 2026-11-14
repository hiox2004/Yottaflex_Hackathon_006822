"""Auto-dismissed flags (read-only), from the v_flag view."""

from typing import Any

import psycopg

Row = dict[str, Any]


def count_dismissed(con: psycopg.Connection[Row]) -> int:
    row = con.execute("SELECT count(*) AS n FROM v_flag WHERE outcome = 'dismissed'").fetchone()
    return int(row["n"]) if row else 0


def dismissed(con: psycopg.Connection[Row], limit: int, offset: int) -> tuple[list[Row], int]:
    """A page of dismissed flags in id order, and the total."""
    sql = """SELECT similarity_report_id, submission_id, learner_id, raw_score, quoted_score,
                    template_score, adjusted_score, dismissal_reason
             FROM v_flag WHERE outcome = 'dismissed'
             ORDER BY similarity_report_id LIMIT %s OFFSET %s"""
    rows = con.execute(sql, (limit, offset)).fetchall()
    return rows, count_dismissed(con)
