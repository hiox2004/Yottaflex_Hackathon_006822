"""Command line: python -m integrity.validation [--write PATH]; exits 1 on any violation."""

import argparse
import sys
from pathlib import Path

from integrity import db
from integrity.validation.checks import run_checks
from integrity.validation.summary import render_markdown, summarize


def main() -> int:
    """Print one line per check, optionally write validation_summary.md; return the exit code."""
    parser = argparse.ArgumentParser(description="Validate the loaded database.")
    parser.add_argument("--write", type=Path, help="write the markdown summary to this path")
    args = parser.parse_args()
    with db.connect() as con:
        violations = run_checks(con)
        summary = summarize(con, violations)
    for check in summary["checks"]:
        status = "PASS" if check["violations"] == 0 else f"FAIL ({check['violations']})"
        sys.stdout.write(f"{check['name']:<28} {status}\n")
    for violation in violations[:20]:
        sys.stdout.write(f"  {violation.check}: {violation.entity_id} {violation.detail}\n")
    sys.stdout.write(f"{len(summary['checks'])} checks, {len(violations)} violations\n")
    if args.write:
        args.write.write_text(render_markdown(summary), encoding="utf-8", newline="\n")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
