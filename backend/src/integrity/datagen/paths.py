"""Where generated files go, and the reproducibility check (generate twice, compare SHA-256)."""

import sys
import tempfile
from pathlib import Path

from integrity.config import REPO_ROOT
from integrity.datagen.build import generate
from integrity.datagen.export import write_dataset
from integrity.datagen.scale import SCALES

DATA = REPO_ROOT / "data"


def generate_to_default_dirs(scale_name: str) -> str:
    """Write data/<scale>/ and data/ground_truth/<scale>/; returns a one-line summary."""
    dataset = generate(SCALES[scale_name])
    write_dataset(dataset, DATA / scale_name, DATA / "ground_truth" / scale_name)
    counts = {name: len(rows) for name, rows in dataset.tables.items()}
    return (
        f"{scale_name}: {len(dataset.tables['submission'])} submissions, "
        f"{len(dataset.flags)} flags, "
        f"{counts['integrity_case']} cases -> data/{scale_name}"
    )


def reproduce(scale_name: str) -> int:
    """Generate twice into temp folders and compare counts and checksums; 0 when identical."""
    runs = []
    for _ in range(2):
        with tempfile.TemporaryDirectory() as tmp:
            dataset = generate(SCALES[scale_name])
            hashes = write_dataset(dataset, Path(tmp) / "out", Path(tmp) / "truth")
            runs.append((len(dataset.truth), hashes))
    same = runs[0] == runs[1]
    sys.stdout.write(
        f"repro {scale_name}: {'IDENTICAL' if same else 'DIFFERENT'} ({len(runs[0][1])} files)\n"
    )
    for name, digest in runs[0][1].items():
        sys.stdout.write(f"  {digest}  {name}\n")
    return 0 if same else 1
