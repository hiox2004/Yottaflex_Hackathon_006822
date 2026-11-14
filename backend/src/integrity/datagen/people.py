"""Master data: departments, staff, learners, assessments and the two rule versions."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from integrity import ids
from integrity.datagen.common import Row, d3, stream
from integrity.datagen.scale import Scale

DEPARTMENTS = (
    "Biology",
    "Computer Science",
    "Economics",
    "Engineering",
    "History",
    "Law",
    "Physics",
    "Psychology",
)
FIRST = (
    "Ana",
    "Ben",
    "Chen",
    "Dara",
    "Eli",
    "Fatima",
    "Gus",
    "Hana",
    "Ivan",
    "Jia",
    "Kofi",
    "Lena",
    "Mateo",
    "Nia",
    "Omar",
    "Priya",
    "Quinn",
    "Rosa",
    "Sam",
    "Tara",
    "Uma",
    "Vik",
    "Wen",
    "Yusuf",
)
LAST = (
    "Abara",
    "Brandt",
    "Castillo",
    "Dubois",
    "Evans",
    "Fischer",
    "Gupta",
    "Haddad",
    "Ito",
    "Jensen",
    "Khan",
    "Lopez",
    "Muller",
    "Novak",
    "Okafor",
    "Petrov",
    "Quist",
    "Rossi",
    "Silva",
    "Tanaka",
)
KINDS = ("essay", "report", "project", "lab_report", "coding_task")
KIND_TITLES = {
    "essay": "Essay",
    "report": "Report",
    "project": "Project",
    "lab_report": "Lab report",
    "coding_task": "Coding task",
}
ADMINS, SUPPORT, INSTRUCTORS_PER_DEPT, REVIEWERS_PER_DEPT = 6, 10, 3, 3
FIRST_DUE = datetime(
    2026, 1, 19, 12, tzinfo=UTC
)  # earliest due date; submissions come up to 14 days before
LAST_DUE_DAYS = 274  # latest due date is 2026-10-20
RULE_SWITCH = datetime(2026, 6, 1, tzinfo=UTC)


@dataclass
class People:
    reviewers: list[Row]
    learners: list[Row]
    assessments: list[Row]
    rules: list[Row]

    def staff(self, role: str) -> list[Row]:
        return [r for r in self.reviewers if r["role"] == role]


def _name(rng_pick: tuple[str, str]) -> str:
    return f"{rng_pick[0]} {rng_pick[1]}"


def make_reviewers(seed: int) -> list[Row]:
    """Staff across all departments: administrators, support, instructors, academic reviewers."""
    rng = stream(seed, "reviewers")
    plan = (
        [("academic_administrator", DEPARTMENTS[i % 6]) for i in range(ADMINS)]
        + [("support_staff", DEPARTMENTS[i % 8]) for i in range(SUPPORT)]
        + [("instructor", d) for d in DEPARTMENTS for _ in range(INSTRUCTORS_PER_DEPT)]
        + [("academic_reviewer", d) for d in DEPARTMENTS for _ in range(REVIEWERS_PER_DEPT)]
    )
    return [
        {
            "reviewer_id": ids.reviewer_id(n),
            "name": _name((rng.choice(FIRST), rng.choice(LAST))),
            "role": role,
            "department": department,
        }
        for n, (role, department) in enumerate(plan, start=1)
    ]


def make_learners(seed: int, count: int) -> list[Row]:
    rng = stream(seed, "learners")
    return [
        {
            "learner_id": ids.learner_id(n),
            "name": _name((rng.choice(FIRST), rng.choice(LAST))),
            "department": DEPARTMENTS[rng.randrange(len(DEPARTMENTS))],
            "cohort_year": rng.choice((2023, 2024, 2025, 2025, 2026)),
        }
        for n in range(1, count + 1)
    ]


def make_assessments(seed: int, count: int, reviewers: list[Row]) -> list[Row]:
    rng = stream(seed, "assessments")
    instructors = [r for r in reviewers if r["role"] == "instructor"]
    rows = []
    for n in range(1, count + 1):
        department = DEPARTMENTS[(n - 1) % len(DEPARTMENTS)]
        kind = rng.choice(KINDS)
        teacher = rng.choice([r for r in instructors if r["department"] == department])
        rows.append(
            {
                "assessment_id": ids.assessment_id(n),
                "title": f"{department[:3].upper()}-{n:03d} {KIND_TITLES[kind]}",
                "kind": kind,
                "department": department,
                "instructor_id": teacher["reviewer_id"],
                "due_at": FIRST_DUE + timedelta(days=rng.randint(0, LAST_DUE_DAYS)),
            }
        )
    return rows


def make_rules() -> list[Row]:
    """Two rule versions; the second raises the priority gate. Neither is ever edited."""
    base = {"log_threshold": d3(300), "review_threshold": d3(600), "appeal_window_days": 14}
    return [
        {
            "rule_id": ids.rule_id(1),
            "name": "Similarity review rule, version 1",
            "version": 1,
            "priority_threshold": d3(800),
            "effective_from": datetime(2026, 1, 1, tzinfo=UTC),
            "effective_to": RULE_SWITCH,
            **base,
        },
        {
            "rule_id": ids.rule_id(2),
            "name": "Similarity review rule, version 2",
            "version": 2,
            "priority_threshold": d3(850),
            "effective_from": RULE_SWITCH,
            "effective_to": None,
            **base,
        },
    ]


def make_people(seed: int, scale: Scale) -> People:
    reviewers = make_reviewers(seed)
    return People(
        reviewers=reviewers,
        learners=make_learners(seed, scale.learners),
        assessments=make_assessments(seed, scale.assessments, reviewers),
        rules=make_rules(),
    )
