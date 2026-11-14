"""Name of the throwaway schema a DB test uses.

Postgres makes a transaction that creates a schema wait for another open transaction that
creates the same name. So each pytest process gets its own schema, and the fixtures create it
inside a transaction that is rolled back.
"""

import os
import re

PREFIX = "scratch"
_VALID = re.compile(r"[a-z0-9_]+")


def quote(name: str) -> str:
    """Double-quoted SQL identifier. Names are checked first, so quoting cannot inject SQL."""
    if not _VALID.fullmatch(name):
        raise ValueError(f"invalid test schema name: {name!r}")
    return f'"{name}"'


def schema_name() -> str:
    """`scratch_<pid>`, or `scratch_<pid>_<xdist worker>`; overridable by INTEGRITY_TEST_SCHEMA."""
    override = os.environ.get("INTEGRITY_TEST_SCHEMA")
    if override:
        return quote(override)[1:-1]
    name = f"{PREFIX}_{os.getpid()}"
    worker = os.environ.get("PYTEST_XDIST_WORKER")
    if worker:
        name = f"{name}_{worker}"
    return quote(name)[1:-1]
