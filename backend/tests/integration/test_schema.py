"""Schema behaviour that matters: derived scores, bands and the append-only history.

Runs inside a throwaway schema that is rolled back, so it never touches the dev database.
"""

from collections.abc import Iterator

import psycopg
import pytest

from integrity import db
from integrity.dbload import SCHEMA

ONE_CASE = """
INSERT INTO department VALUES ('DEP-01', 'Computing');
INSERT INTO reviewer VALUES ('RVW-0001', 'DEP-01', 'instructor', '2026-01-01', NULL);
INSERT INTO course VALUES ('CRS-001', 'DEP-01', 'RVW-0001', 'Intro');
INSERT INTO learner VALUES ('LRN-000001', 'DEP-01', '2026-01-01');
INSERT INTO assessment
  VALUES ('ASM-0001', 'CRS-001', 'Essay 1', 'essay', '2026-02-01', '2026-03-01');
INSERT INTO submission VALUES ('SUB-2026-000001', 'LRN-000001', 'ASM-0001', '2026-02-20', 100);
INSERT INTO integrity_rule
  VALUES ('INT-2026-000001', 'Default', 0.3, 0.6, 0.8, '2026-01-01', NULL);
INSERT INTO similarity_report (similarity_report_id, submission_id, rule_id, total_words,
                               matched_words, template_words, quoted_words, generated_at)
  VALUES ('SIM-SUB-2026-000001-01', 'SUB-2026-000001', 'INT-2026-000001',
          100, 70, 10, 10, '2026-02-20');
INSERT INTO integrity_case VALUES ('CAS-2026-000001', 'SIM-SUB-2026-000001-01', '2026-02-21');
INSERT INTO case_event (case_id, event_type, occurred_at)
  VALUES ('CAS-2026-000001', 'opened', '2026-02-21');
"""


@pytest.fixture
def con() -> Iterator[psycopg.Connection]:
    with db.connect() as connection:
        connection.execute("CREATE SCHEMA scratch; SET LOCAL search_path TO scratch")  # type: ignore[arg-type]
        connection.execute(SCHEMA.read_text(encoding="utf-8"))  # type: ignore[arg-type]
        connection.execute(ONE_CASE)  # type: ignore[arg-type]
        yield connection
        connection.rollback()


def test_scores_are_derived_and_band_uses_the_rule_thresholds(con: psycopg.Connection) -> None:
    raw, adjusted = con.execute(
        "SELECT raw_score, adjusted_score FROM similarity_report"
    ).fetchone()  # type: ignore[misc]
    band = con.execute("SELECT band FROM v_report_band").fetchone()
    assert (float(raw), float(adjusted)) == (
        0.7,
        0.5,
    )  # 70 matched, minus 20 template/quoted, over 100
    assert band == ("log_only",)  # 0.5 is below the 0.6 review threshold


def test_event_history_cannot_be_edited_or_deleted(con: psycopg.Connection) -> None:
    with pytest.raises(psycopg.errors.RaiseException, match="append-only"):
        con.execute("UPDATE case_event SET detail = 'x'")
    con.rollback()


def test_case_status_comes_from_latest_event(con: psycopg.Connection) -> None:
    assert con.execute("SELECT status FROM v_case_status").fetchone() == ("open",)
