"""Session setup shared by all tests."""

import os
import re

import psycopg
import pytest

from integrity import db
from tests.db_schema import PREFIX, quote


@pytest.fixture(scope="session", autouse=True)
def _drop_stale_test_schemas() -> None:
    """Drop leftover `scratch_<pid>` schemas that this process's pid owns (from an earlier run).

    Other processes' schemas are never touched. Skipped when the database is unreachable.
    """
    pattern = re.compile(rf"{PREFIX}_(\d+)(_\w+)?")
    try:
        with db.connect(autocommit=True) as con:
            names = [row[0] for row in con.execute("SELECT nspname FROM pg_namespace")]
            for name in names:
                match = pattern.fullmatch(name)
                if match and int(match.group(1)) == os.getpid():
                    con.execute(f"DROP SCHEMA IF EXISTS {quote(name)} CASCADE")
    except psycopg.OperationalError:
        pass
