"""Reset the database, apply database/schema.sql, optionally load a generated seed.

Run from the repo root:  python -m integrity.dbload [--scale starter|full]
"""

import argparse

from integrity import db
from integrity.config import REPO_ROOT

SCHEMA = REPO_ROOT / "database" / "schema.sql"


def load(scale: str | None = None) -> None:
    """Wipe the public schema, recreate it from schema.sql, then run data/<scale>/seed.sql."""
    scripts = ["DROP SCHEMA public CASCADE; CREATE SCHEMA public", SCHEMA.read_text("utf-8")]
    if scale:
        scripts.append((REPO_ROOT / "data" / scale / "seed.sql").read_text("utf-8"))
    with db.connect() as con:
        for script in scripts:
            con.execute(script)  # multi-statement SQL file, so no parameters


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset the database and load schema (+ seed).")
    parser.add_argument("--scale", choices=["starter", "full"], help="seed to load")
    scale = parser.parse_args().scale
    load(scale)
    message = f"database reset, schema applied{f', {scale} seed loaded' if scale else ''}"
    print(message)  # noqa: T201


if __name__ == "__main__":
    main()
