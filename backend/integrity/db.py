"""Database access. All SQL lives behind this module and the repositories that use it."""

import psycopg

from integrity.config import get_settings


def connect(url: str | None = None) -> psycopg.Connection:
    """Open a new connection. Short timeout so a missing database fails fast."""
    return psycopg.connect(url or get_settings().database_url, connect_timeout=3)


def ping(url: str | None = None) -> bool:
    try:
        with connect(url) as con:
            return con.execute("SELECT 1").fetchone() == (1,)
    except psycopg.Error:
        return False
