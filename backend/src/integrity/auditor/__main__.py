"""Command line: python -m integrity.auditor [--case CAS-...]. Prints findings; always exits 0."""

import argparse
import sys
from collections import Counter

from integrity import db
from integrity.auditor.findings import DETECTORS, audit


def main() -> int:
    """Print every finding and a count per issue type."""
    parser = argparse.ArgumentParser(description="Run the due-process auditor on the database.")
    parser.add_argument("--case", help="only this case id")
    args = parser.parse_args()
    with db.connect() as con:
        findings = audit(con, args.case)
    for f in findings:
        sys.stdout.write(f"{f.issue_type} {f.case_id} {f.entity_id}: {f.detail}\n")
    counts = Counter(f.issue_type for f in findings)
    for issue_type in DETECTORS:
        sys.stdout.write(f"{issue_type:<38} {counts[issue_type]}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
