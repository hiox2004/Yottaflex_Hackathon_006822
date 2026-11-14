"""Helpers for the mutation tests: change the scratch copy of the data, never the live database.

Every change runs inside the `con` fixture's transaction, which the fixture rolls back.
"""

from collections import Counter
from typing import Any

import psycopg

from integrity.validation.checks import run_checks


def unseal(con: psycopg.Connection[Any], table: str) -> None:
    """Disable one table's append-only trigger inside the scratch transaction (rolled back)."""
    con.execute(f"ALTER TABLE {table} DISABLE TRIGGER {table}_no_change")


def failing_counts(con: psycopg.Connection[Any]) -> Counter[str]:
    """Violation count per SQL check for the current scratch data."""
    return Counter(v.check for v in run_checks(con))


# A second case on a second submission, as in test_validation.py.
# Its evidence is the one to cite.
OTHER_CASE = """
INSERT INTO submission VALUES
  ('SUB-2026-000002', 'LRN-000001', 'ASM-000001', 2, '2026-01-30 11:00Z', 900);
INSERT INTO similarity_report VALUES
  ('SIM-SUB-2026-000002-01', 'SUB-2026-000002', 'INT-2026-000001',
                                      0.850, 0.000, 0.000, DEFAULT, '2026-01-30 11:05Z');
INSERT INTO integrity_case VALUES
  ('CAS-2026-000002', 'SIM-SUB-2026-000002-01', '2026-01-31 10:00Z');
INSERT INTO evidence_item VALUES ('EVD-CAS-2026-000002-001', 'CAS-2026-000002', 'matched_passage',
                                  'Other case passage', '2026-02-02 10:00Z', NULL);
INSERT INTO case_event (case_id, event_type, from_status, to_status, occurred_at)
  VALUES ('CAS-2026-000002', 'case_opened', NULL, 'open', '2026-01-31 10:00Z');
"""

DECISION_ON_CASE_ONE = """
INSERT INTO decision VALUES ('DEC-CAS-2026-000001-01', 'CAS-2026-000001', 'REV-000002',
                             'violation_confirmed', 'Clear copying', '2026-02-03 09:00Z');
"""
