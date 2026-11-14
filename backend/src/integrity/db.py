"""Database access. All SQL lives behind this module and the repositories that use it."""

from typing import Any

import psycopg
from psycopg.rows import dict_row, tuple_row

from integrity.config import get_settings


def connect(url: str | None = None, *, dict_rows: bool = False) -> psycopg.Connection[Any]:
    """Open a new connection (UTC session). Short timeout so a missing database fails fast."""
    return psycopg.connect(
        url or get_settings().database_url,
        connect_timeout=3,
        options="-c timezone=UTC",
        row_factory=dict_row if dict_rows else tuple_row,
    )


def ping(url: str | None = None) -> bool:
    try:
        with connect(url) as con:
            return con.execute("SELECT 1").fetchone() == (1,)
    except psycopg.Error:
        return False
