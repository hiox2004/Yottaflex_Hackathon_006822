"""Shared fixture: a throwaway schema holding one clean case (under review), rolled back after use.

Tests add or change rows through `con` to build the situation they need.
The dev database is never touched.
"""

from collections.abc import Iterator

import psycopg
import pytest
from tests.db_schema import quote, schema_name

from integrity import db
from integrity.dbload import SCHEMA

CLEAN_CASE = """
INSERT INTO reviewer VALUES
  ('REV-000001', 'Ines Instructor', 'instructor', 'Computing'),
  ('REV-000002', 'Rae Reviewer', 'academic_reviewer', 'Law'),
  ('REV-000003', 'Adam Admin', 'academic_administrator', 'Registry');
INSERT INTO learner VALUES ('LRN-000001', 'Lena Learner', 'Biology', 2025);
INSERT INTO assessment
  VALUES ('ASM-000001', 'Essay 1', 'essay', 'Computing', 'REV-000001', '2026-02-01 12:00Z');
INSERT INTO integrity_rule
  VALUES ('INT-2026-000001', 'Default', 1, 0.300, 0.600, 0.800, 14, '2026-01-01 00:00Z', NULL);
INSERT INTO submission
  VALUES ('SUB-2026-000001', 'LRN-000001', 'ASM-000001', 1, '2026-01-30 10:00Z', 1200);
INSERT INTO similarity_report
  VALUES ('SIM-SUB-2026-000001-01', 'SUB-2026-000001', 'INT-2026-000001',
          0.900, 0.100, 0.050, DEFAULT, '2026-01-30 10:05Z');
INSERT INTO integrity_case
  VALUES ('CAS-2026-000001', 'SIM-SUB-2026-000001-01', '2026-01-31 09:00Z');
INSERT INTO case_reviewer
  VALUES ('CAS-2026-000001', 'REV-000002', 'primary', '2026-02-01 09:00Z', 'REV-000003');
INSERT INTO evidence_item
  VALUES ('EVD-CAS-2026-000001-001', 'CAS-2026-000001', 'matched_passage',
          'Paragraph 3 matches a web page', '2026-02-02 09:00Z', 'REV-000002');
INSERT INTO case_event
  (case_id, event_type, from_status, to_status, occurred_at, actor_id, ref_id) VALUES
  ('CAS-2026-000001', 'case_opened', NULL, 'open', '2026-01-31 09:00Z', NULL, NULL),
  ('CAS-2026-000001', 'reviewer_assigned', 'open', 'under_review', '2026-02-01 09:00Z',
   'REV-000003', 'REV-000002'),
  ('CAS-2026-000001', 'evidence_added', NULL, NULL, '2026-02-02 09:00Z', 'REV-000002',
   'EVD-CAS-2026-000001-001');
"""


@pytest.fixture
def con() -> Iterator[psycopg.Connection]:
    with db.connect() as connection:
        schema = quote(schema_name())
        connection.execute(f"CREATE SCHEMA {schema}; SET LOCAL search_path TO {schema}")
        connection.execute(SCHEMA.read_text(encoding="utf-8"))
        connection.execute(CLEAN_CASE)
        yield connection
        connection.rollback()
