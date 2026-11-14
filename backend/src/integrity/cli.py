"""CLI: python -m integrity.cli bootstrap|datagen|load|validate|audit|eval|repro."""

import argparse
import sys
from collections.abc import Callable, Sequence

SCALES = ("starter", "full")


def _load(args: argparse.Namespace) -> int:
    from integrity import dbload

    dbload.load(args.scale)
    return 0


def _validate(args: argparse.Namespace) -> int:
    from integrity import db
    from integrity.config import REPO_ROOT
    from integrity.eval.score import dataset_hash, write_json
    from integrity.validation import render_markdown, run_checks, summarize
    from integrity.validation.summary import failing_checks

    with db.connect() as con:
        violations = run_checks(con)
        summary = summarize(con, violations, scale=args.scale)
    for violation in violations:
        sys.stdout.write(f"{violation}\n")
    sys.stdout.write(f"{summary['violations']} unexpected violations\n")
    failed = failing_checks(summary)
    if failed:
        sys.stdout.write(f"FAILED: {', '.join(failed)}\n")
    elif args.scale:  # only a clean run may write the PASS artifacts
        folder = REPO_ROOT / "data" / args.scale
        write_json(
            folder / "validation.json", {"dataset_hash": dataset_hash(args.scale), **summary}
        )
        (folder / "validation_summary.md").write_bytes(render_markdown(summary).encode("utf-8"))
    return 1 if failed else 0


def _audit(_args: argparse.Namespace) -> int:
    from integrity import db
    from integrity.auditor import audit

    with db.connect() as con:
        findings = audit(con)
    for finding in findings:
        sys.stdout.write(f"{finding}\n")
    sys.stdout.write(f"{len(findings)} findings\n")
    return 0


def _eval(args: argparse.Namespace) -> int:
    from integrity import db
    from integrity.auditor import audit
    from integrity.config import REPO_ROOT
    from integrity.eval.score import evaluate, write_json

    with db.connect() as con:
        metrics = evaluate(con, audit(con), args.scale)
    write_json(REPO_ROOT / "data" / args.scale / "metrics.json", metrics)
    for row in metrics["auditor"]:
        sys.stdout.write(f"{row}\n")
    for row in metrics["triage"]:
        sys.stdout.write(f"{row}\n")
    return 0


def _bootstrap(args: argparse.Namespace) -> int:
    """Container start: generate the scale if files are missing, load only an empty database."""
    from integrity import db, dbload
    from integrity.config import REPO_ROOT
    from integrity.datagen.paths import generate_to_default_dirs

    folder = REPO_ROOT / "data" / args.scale
    if not (folder / "seed.sql").is_file() or not (folder / "manifest.json").is_file():
        sys.stdout.write(f"bootstrap: generating {args.scale} (seed 20261022)\n")
        sys.stdout.write(f"{generate_to_default_dirs(args.scale)}\n")
    with db.connect() as con:
        table = con.execute("SELECT to_regclass('public.integrity_case')").fetchone()
        loaded = False
        if table and table[0] is not None:
            rows = con.execute("SELECT EXISTS (SELECT 1 FROM integrity_case)").fetchone()
            loaded = bool(rows and rows[0])
    if loaded:
        sys.stdout.write("bootstrap: database already loaded, keeping existing data\n")
        return 0
    dbload.load(args.scale)
    sys.stdout.write(f"bootstrap: {args.scale} loaded\n")
    return 0


def _datagen(args: argparse.Namespace) -> int:
    from integrity.datagen.paths import generate_to_default_dirs

    sys.stdout.write(f"{generate_to_default_dirs(args.scale)}\n")
    return 0


def _repro(args: argparse.Namespace) -> int:
    from integrity.datagen.paths import reproduce

    return reproduce(args.scale)


_COMMANDS: dict[str, Callable[[argparse.Namespace], int]] = {
    "bootstrap": _bootstrap,
    "datagen": _datagen,
    "load": _load,
    "validate": _validate,
    "audit": _audit,
    "eval": _eval,
    "repro": _repro,
}
_NEEDS_SCALE = ("bootstrap", "datagen", "load", "eval", "repro")
_OPTIONAL_SCALE = ("validate",)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="integrity.cli", description="Integrity Desk data tools.")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in _COMMANDS:
        sub = commands.add_parser(name)
        if name in _NEEDS_SCALE or name in _OPTIONAL_SCALE:
            sub.add_argument("--scale", choices=SCALES, required=name in _NEEDS_SCALE)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return _COMMANDS[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
