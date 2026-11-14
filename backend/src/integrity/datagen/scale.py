"""Dataset sizes and the exact quotas derived from them (same code for starter and full)."""

from dataclasses import dataclass

# Share of cases ending in each state, per mille. Every state appears at least once at any scale.
STATUS_WEIGHTS = {
    "open": 230,
    "under_review": 280,
    "decided": 170,
    "closed_plain": 170,
    "appealed": 30,
    "appeal_review": 30,
    "appeal_decided": 30,
    "closed_appeal": 60,
}


@dataclass(frozen=True)
class Scale:
    name: str
    submissions: int
    flags: int
    cases: int
    anomalies: tuple[int, int, int, int]  # G1..G4 counts; the same number of decoys is added

    @property
    def learners(self) -> int:
        return self.submissions // 5

    @property
    def assessments(self) -> int:
        return self.submissions // 66


FULL = Scale("full", 10_000, 1_000, 300, (8, 10, 8, 6))
STARTER = Scale("starter", 1_000, 100, 30, (1, 1, 1, 1))
SCALES = {scale.name: scale for scale in (FULL, STARTER)}


def kind_quotas(scale: Scale) -> dict[str, int]:
    """Submissions per latent kind. Flags = dismissed + cases; some genuine copies slip through."""
    dismissed = scale.flags - scale.cases
    masked = max(1, dismissed * 3 // 70)  # genuine copies hidden behind quotes or a template
    legit_quote = (dismissed - masked) * 36 // 67
    low = max(1, scale.submissions * 4 // 1000)  # genuine copies scoring below the review gate
    genuine = scale.cases * 7 // 10
    quotas = {
        "legit_quote": legit_quote,
        "shared_template": dismissed - masked - legit_quote,
        "masked_quote": (masked + 1) // 2,
        "masked_template": masked // 2,
        "genuine_copy": genuine,
        "false_positive": scale.cases - genuine,
        "copy_low": low,
    }
    quotas["clean"] = scale.submissions - scale.flags - low
    return quotas


def status_quotas(cases: int) -> dict[str, int]:
    """Cases per target state: largest remainder, then at least one case per state."""
    total = sum(STATUS_WEIGHTS.values())
    counts = {s: cases * w // total for s, w in STATUS_WEIGHTS.items()}
    remainders = sorted(STATUS_WEIGHTS, key=lambda s: (-(cases * STATUS_WEIGHTS[s] % total), s))
    for state in remainders[: cases - sum(counts.values())]:
        counts[state] += 1
    return counts
