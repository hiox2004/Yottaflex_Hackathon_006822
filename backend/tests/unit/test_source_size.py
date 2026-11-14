"""Guardrail: keep source files small enough to read in one sitting."""

from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "src"
MAX_LINES = 300


def test_source_files_stay_under_line_limit() -> None:
    too_long = {
        str(p.relative_to(SRC)): n
        for p in SRC.rglob("*.py")
        if (n := len(p.read_text(encoding="utf-8").splitlines())) > MAX_LINES
    }
    assert not too_long, f"split these files (limit {MAX_LINES} lines): {too_long}"
