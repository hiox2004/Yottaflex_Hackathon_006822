"""Command line entry points: python -m integrity.cli datagen|load|validate|audit|eval|repro."""

import argparse
import sys
from collections.abc import Callable, Sequence

SCALES = ("starter", "full")


def _load(args: argparse.Namespace) -> int:
    from integrity import dbload

    dbload.load(args.scale)
    return 0


def _validate(_args: argparse.Namespace) -> int:
    from integrity import db
    from integrity.validation import run_checks

    with db.connect() as con:
        violations = run_checks(con)
    for violation in violations:
        sys.stdout.write(f"{violation}\n")
    sys.stdout.write(f"{len(violations)} violations\n")
    return 1 if violations else 0


def _audit(_args: argparse.Namespace) -> int:
    from integrity import db
    from integrity.auditor import audit

    with db.connect() as con:
        findings = audit(con)
    for finding in findings:
        sys.stdout.write(f"{finding}\n")
    sys.stdout.write(f"{len(findings)} findings\n")
    return 0


def _datagen(args: argparse.Namespace) -> int:
    from integrity.datagen.paths import generate_to_default_dirs

    sys.stdout.write(f"{generate_to_default_dirs(args.scale)}\n")
    return 0


def _repro(args: argparse.Namespace) -> int:
    from integrity.datagen.paths import reproduce

    return reproduce(args.scale)


def _not_built(args: argparse.Namespace) -> int:
    sys.stderr.write(f"{args.command}: not built yet\n")
    return 2


_COMMANDS: dict[str, Callable[[argparse.Namespace], int]] = {
    "datagen": _datagen,
    "load": _load,
    "validate": _validate,
    "audit": _audit,
    "eval": _not_built,
    "repro": _repro,
}
_NEEDS_SCALE = ("datagen", "load", "eval", "repro")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="integrity.cli", description="Integrity Desk data tools.")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in _COMMANDS:
        sub = commands.add_parser(name)
        if name in _NEEDS_SCALE:
            sub.add_argument("--scale", choices=SCALES, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return _COMMANDS[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
