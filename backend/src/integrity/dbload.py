"""Reset the database, apply database/schema.sql, optionally load a generated seed.

Run from the repo root:  python -m integrity.dbload [--scale starter|full]
"""

import argparse

from integrity import db
from integrity.config import REPO_ROOT

SCHEMA = REPO_ROOT / "database" / "schema.sql"
RESET = "DROP SCHEMA public CASCADE; CREATE SCHEMA public"
# Seeded rows carry explicit event ids: move the identity past them (next event = max + 1).
SYNC_IDENTITY = """
SELECT setval(pg_get_serial_sequence('case_event', 'case_event_id'),
              COALESCE(max(case_event_id), 1), max(case_event_id) IS NOT NULL)
FROM case_event
"""


def load(scale: str | None = None) -> None:
    """Wipe the public schema, apply schema.sql, load data/<scale>/seed.sql in one transaction."""
    scripts = [RESET, SCHEMA.read_text("utf-8")]
    if scale:
        scripts.append((REPO_ROOT / "data" / scale / "seed.sql").read_text("utf-8"))
    with db.connect() as con:  # commits on success, rolls back on any error
        for script in scripts:
            con.execute(script)  # multi-statement SQL file, so no parameters
        con.execute(SYNC_IDENTITY)


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset the database and load schema (+ seed).")
    parser.add_argument("--scale", choices=["starter", "full"], help="seed to load")
    scale = parser.parse_args().scale
    load(scale)
    message = f"database reset, schema applied{f', {scale} seed loaded' if scale else ''}"
    print(message)  # noqa: T201


if __name__ == "__main__":
    main()
