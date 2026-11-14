"""Brief rule I2: ground truth is never read by application code.

Only the generator package (integrity/datagen) may mention it, because it writes the files.
The API, services, validator and auditor must not reference it at all.
"""

from pathlib import Path

PKG = Path(__file__).resolve().parents[1] / "integrity"
NEEDLES = ("ground_truth", "groundtruth")


def test_application_code_never_references_ground_truth() -> None:
    offenders = []
    for path in PKG.rglob("*.py"):
        if "datagen" in path.relative_to(PKG).parts:
            continue
        text = path.read_text(encoding="utf-8").lower()
        if any(n in text for n in NEEDLES):
            offenders.append(str(path.relative_to(PKG)))
    assert not offenders, f"ground truth referenced outside datagen: {offenders}"
