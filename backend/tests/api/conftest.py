"""API test fixture: the starter dataset in a throwaway schema, rolled back after each test.

The app talks to the same connection as the test, so every write the API makes is undone.
The real database is never touched. Run `python -m integrity.cli datagen --scale starter` first
if data/starter is missing.
"""

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from integrity import db
from integrity.api.app import create_app
from integrity.api.deps import get_clock, get_con
from integrity.clock import FixedClock
from integrity.config import REPO_ROOT
from integrity.dbload import SCHEMA
from integrity.services.common import Connection

SEED = REPO_ROOT / "data" / "starter" / "seed.sql"
NOW = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)  # after every generated event


class Api:
    """A test client plus helpers to act as a staff member."""

    def __init__(self, client: TestClient, con: Connection) -> None:
        self.client = client
        self.con = con

    def get(self, path: str, actor: str) -> dict:  # type: ignore[type-arg]
        return self.client.get(f"/api{path}", headers={"X-Actor-Id": actor}).json()  # type: ignore[no-any-return]

    def post(self, path: str, actor: str, body: dict) -> tuple[int, dict]:  # type: ignore[type-arg]
        response = self.client.post(f"/api{path}", headers={"X-Actor-Id": actor}, json=body)
        return response.status_code, response.json()

    def reviewer(self, role: str, department: str | None = None, skip: tuple[str, ...] = ()) -> str:
        """First reviewer id of a role (optionally in a department), not in `skip`."""
        for row in self.client.get("/api/reviewers").json():
            if (
                row["role"] == role
                and department in (None, row["department"])
                and row["reviewer_id"] not in skip
            ):
                return row["reviewer_id"]  # type: ignore[no-any-return]
        raise LookupError(role)

    def first_case(self, admin: str, **filters: str) -> str:
        """Id of the oldest listed case matching the queue filters."""
        query = "&".join(f"{k}={v}" for k, v in filters.items())
        return self.get(f"/queue?limit=200&{query}", admin)["items"][0]["case_id"]  # type: ignore[no-any-return]


@pytest.fixture
def api() -> Iterator[Api]:
    with db.connect(dict_rows=True) as con:
        con.execute("CREATE SCHEMA scratch; SET LOCAL search_path TO scratch")
        con.execute(SCHEMA.read_text(encoding="utf-8"))
        con.execute(SEED.read_text(encoding="utf-8"))
        app = create_app()
        app.dependency_overrides[get_con] = lambda: con
        app.dependency_overrides[get_clock] = lambda: FixedClock(NOW)
        yield Api(TestClient(app), con)
        con.rollback()
