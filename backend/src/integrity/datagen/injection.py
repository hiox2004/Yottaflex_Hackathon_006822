"""Shared state for injecting anomalies: the tables, what the generator knows, what is used."""

from dataclasses import dataclass, field

from integrity.datagen.common import Row, Tables, stream

ISSUES = (
    "AUTO_GUILT_WITHOUT_REVIEW",
    "REVIEWER_CONFLICT",
    "EVIDENCE_AFTER_DECISION_NO_HISTORY",
    "APPEAL_CLOSED_NO_INDEPENDENT_REVIEW",
)


@dataclass
class Injection:
    """The tables to change, what the generator knows about each case, and what is already used."""

    seed: int
    tables: Tables
    info: dict[str, tuple[Row, Row]]  # case_id -> (learner, assessment)
    states: dict[str, str]  # case_id -> target state
    used: set[str] = field(default_factory=set)
    truth: list[Row] = field(default_factory=list)

    def candidates(self, purpose: str, wanted_states: tuple[str, ...]) -> list[str]:
        """Unused cases in the given states, in a seeded random order."""
        rng = stream(self.seed, f"anomaly:{purpose}")
        cases = sorted(
            c for c, s in self.states.items() if s in wanted_states and c not in self.used
        )
        rng.shuffle(cases)
        return cases

    def pool(self, purpose: str, wanted_states: tuple[str, ...], count: int) -> list[str]:
        """`count` unused cases, marked as used; fails loudly if there are too few."""
        cases = self.candidates(purpose, wanted_states)[:count]
        require(len(cases), count, f"{purpose} pool {wanted_states}")
        self.used.update(cases)
        return cases

    def rows(self, table: str, case_id: str) -> list[Row]:
        return [r for r in self.tables[table] if r["case_id"] == case_id]

    def label(
        self, kind: str, issue: int, entity: tuple[str, str], case_id: str, note: str
    ) -> None:
        self.truth.append(
            {
                "record_type": kind,
                "issue_type": ISSUES[issue],
                "entity": entity[0],
                "entity_id": entity[1],
                "case_id": case_id,
                "label": note,
            }
        )


def require(found: int, wanted: int, what: str) -> None:
    if found < wanted:
        raise ValueError(f"{what}: found {found} of {wanted}")
