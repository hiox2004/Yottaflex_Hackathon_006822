"""Sanity checks: an empty database fails, the starter seed passes, deleted content is caught.

Each test works in a throwaway schema that is rolled back at the end; the dev database is untouched.
"""

import contextlib
from collections.abc import Iterator
from typing import Any

import psycopg
import pytest
from tests.db_schema import quote, schema_name

from integrity import cli, db
from integrity.config import REPO_ROOT
from integrity.dbload import SCHEMA
from integrity.eval import score
from integrity.validation.sanity import CORE_TABLES, run_sanity_checks
from integrity.validation.summary import failing_checks, summarize

STARTER_SEED = REPO_ROOT / "data" / "starter" / "seed.sql"


@pytest.fixture
def empty_con() -> Iterator[psycopg.Connection[Any]]:
    """Schema applied, no rows: what a fresh `schema.sql` load looks like."""
    with db.connect() as connection:
        schema = quote(schema_name())
        connection.execute(f"CREATE SCHEMA {schema}; SET LOCAL search_path TO {schema}")
        connection.execute(SCHEMA.read_text(encoding="utf-8"))
        yield connection
        connection.rollback()


@pytest.fixture
def seeded_con(empty_con: psycopg.Connection[Any]) -> psycopg.Connection[Any]:
    """Schema plus the starter seed, loaded as the app loads it."""
    empty_con.execute(STARTER_SEED.read_text(encoding="utf-8"))
    return empty_con


def _by_name(checks: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {check["name"]: check for check in checks}


def test_empty_database_fails_sanity_checks(empty_con: psycopg.Connection[Any]) -> None:
    checks = _by_name(run_sanity_checks(empty_con))
    assert checks["tables_not_empty"]["violations"] == len(CORE_TABLES)
    assert checks["ids_follow_scheme_nonempty"]["violations"] > 0


def test_empty_database_is_flagged_in_summary(empty_con: psycopg.Connection[Any]) -> None:
    summary = summarize(empty_con)
    assert summary["checks"][0]["name"] == "tables_not_empty"  # sanity checks come first
    assert summary["violations"] > 0
    assert "tables_not_empty" in failing_checks(summary)


def test_empty_database_validate_exits_nonzero(
    monkeypatch: pytest.MonkeyPatch, empty_con: psycopg.Connection[Any]
) -> None:
    monkeypatch.setattr(db, "connect", lambda: contextlib.nullcontext(empty_con))
    assert cli.main(["validate"]) == 1


def test_empty_database_never_writes_pass_artifacts(
    monkeypatch: pytest.MonkeyPatch, empty_con: psycopg.Connection[Any]
) -> None:
    written: list[object] = []
    monkeypatch.setattr(db, "connect", lambda: contextlib.nullcontext(empty_con))
    monkeypatch.setattr(score, "write_json", lambda *args, **kwargs: written.append(args))
    assert cli.main(["validate", "--scale", "starter"]) == 1
    assert written == []


def test_seeded_starter_passes_sanity_and_validate(
    monkeypatch: pytest.MonkeyPatch, seeded_con: psycopg.Connection[Any]
) -> None:
    checks = run_sanity_checks(seeded_con, "starter")
    assert [c["name"] for c in checks] == [
        "tables_not_empty",
        "row_counts_match_manifest",
        "ids_follow_scheme_nonempty",
    ]
    assert all(c["violations"] == 0 for c in checks), checks

    monkeypatch.setattr(db, "connect", lambda: contextlib.nullcontext(seeded_con))
    monkeypatch.setattr(score, "write_json", lambda *args, **kwargs: None)  # no data/ writes
    assert cli.main(["validate", "--scale", "starter"]) == 0


def test_deleted_rows_are_caught_by_manifest_count(seeded_con: psycopg.Connection[Any]) -> None:
    # appeal is not append-only (the history tables refuse DELETE), so it can lose rows here.
    seeded_con.execute(
        "DELETE FROM appeal WHERE appeal_id IN (SELECT appeal_id FROM appeal ORDER BY 1 LIMIT 2)"
    )
    check = _by_name(run_sanity_checks(seeded_con, "starter"))["row_counts_match_manifest"]
    assert check["violations"] == 1
    assert check["examples"] == ["appeal: db 3 vs manifest 5"]
    assert _by_name(run_sanity_checks(seeded_con))["tables_not_empty"]["violations"] == 0


def test_extra_master_data_is_caught_by_exact_count(seeded_con: psycopg.Connection[Any]) -> None:
    seeded_con.execute(
        "INSERT INTO learner VALUES ('LRN-999999', 'Extra Learner', 'Biology', 2025)"
    )
    check = _by_name(run_sanity_checks(seeded_con, "starter"))["row_counts_match_manifest"]
    assert check["examples"] == ["learner: db 201 vs manifest 200"]
