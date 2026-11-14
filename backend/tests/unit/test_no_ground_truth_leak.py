"""Brief rule I2: ground truth is never read by application code.

Only the generator (integrity/datagen, writes the files) and the evaluation (integrity/eval,
scores against them) may mention it.
The API, services, validator and auditor must not reference it at all.
"""

from pathlib import Path

PKG = Path(__file__).resolve().parents[2] / "src" / "integrity"
NEEDLES = ("ground_truth", "groundtruth")


def test_application_code_never_references_ground_truth() -> None:
    offenders = []
    for path in PKG.rglob("*.py"):
        if {"datagen", "eval"} & set(path.relative_to(PKG).parts):
            continue
        text = path.read_text(encoding="utf-8").lower()
        if any(n in text for n in NEEDLES):
            offenders.append(str(path.relative_to(PKG)))
    assert not offenders, f"ground truth referenced outside datagen: {offenders}"
