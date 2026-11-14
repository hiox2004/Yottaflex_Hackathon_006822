"""Replay each case's event log through the lifecycle rules; keep the SQL transition table honest.

`lifecycle_replay` walks every case's events in order, tracking the status the rules say the case
is in. It reports events the rules would not allow there, and events whose recorded (from, to)
is not what the rules expect (a broken chain counts as a from that is not the current status).
`transition_table_matches` compares the hand-copied SQL table in checks.py with `rules.TRANSITIONS`.
Both return (violation count, up to five example strings).
"""

import re
from typing import Any

import psycopg

from integrity.models import Action, EventType, Status
from integrity.rules import TRANSITIONS
from integrity.validation.checks import EVENT_TRANSITIONS

MAX_EXAMPLES = 5

# Which event records each rules action. case_opened has no action: it moves a case to open.
EVENT_ACTIONS: dict[str, Action] = {
    EventType.REVIEWER_ASSIGNED: Action.ASSIGN_REVIEWER,
    EventType.EVIDENCE_ADDED: Action.ADD_EVIDENCE,
    EventType.RECUSED: Action.RECUSE,
    EventType.DECISION_RECORDED: Action.DECIDE,
    EventType.CASE_REOPENED: Action.REOPEN,
    EventType.APPEAL_FILED: Action.FILE_APPEAL,
    EventType.APPEAL_REVIEWER_ASSIGNED: Action.ASSIGN_APPEAL_REVIEWER,
    EventType.APPEAL_DECIDED: Action.DECIDE_APPEAL,
    EventType.CASE_CLOSED: Action.CLOSE,
}
ACTION_EVENTS: dict[Action, str] = {action: event for event, action in EVENT_ACTIONS.items()}

_LEGAL_ROW = re.compile(r"\('(\w+)',\s*(NULL|'\w+'),\s*(NULL|'\w+')\)")
_EVENTS_SQL = """SELECT case_id, case_event_id, event_type, from_status, to_status FROM case_event
                 ORDER BY case_id, occurred_at, case_event_id"""

Step = tuple[str | None, str | None]


def _expected(state: str | None, event_type: str) -> tuple[set[Step], str | None] | None:
    """The (from, to) recordings the rules accept for this event at this status, and the next state.

    None when the rules allow no such event at this status. An event that leaves the status as it
    is may be recorded with NULL on both sides or as the same status on both sides: the writers do
    both, and they are one transition.
    """
    if event_type == EventType.CASE_OPENED:
        return ({(None, Status.OPEN.value)}, Status.OPEN.value) if state is None else None
    action = EVENT_ACTIONS.get(event_type)
    if state is None or action is None or (Status(state), action) not in TRANSITIONS:
        return None
    target = TRANSITIONS[(Status(state), action)].value
    if target == state:
        return {(None, None), (state, state)}, state
    return {(state, target)}, target


def _replay_case(events: list[tuple[Any, ...]]) -> list[str]:
    """Problems in one case's events, given as (event id, type, recorded from, recorded to)."""
    problems: list[str] = []
    state: str | None = None
    for event_id, event_type, recorded_from, recorded_to in events:
        expected = _expected(state, event_type)
        label = f"event {event_id} {event_type}"
        if expected is None:
            problems.append(f"{label} is not allowed while the case is {state or 'unopened'}")
            continue
        allowed, state_after = expected
        if (recorded_from, recorded_to) not in allowed:
            want = " or ".join(f"{a or '-'} -> {b or '-'}" for a, b in sorted(allowed, key=str))
            if recorded_from != state:
                problems.append(
                    f"{label} chain broken: from {recorded_from or '-'} but the case was "
                    f"{state or 'unopened'}"
                )
            else:
                problems.append(
                    f"{label} recorded {recorded_from or '-'} -> {recorded_to or '-'}, "
                    f"rules expect {want}"
                )
        state = state_after
    return problems


def lifecycle_replay(con: psycopg.Connection[Any]) -> tuple[int, list[str]]:
    """Replay every case's events through the rules; return (problem count, first examples)."""
    by_case: dict[str, list[tuple[Any, ...]]] = {}
    for case_id, event_id, event_type, from_status, to_status in con.execute(_EVENTS_SQL):
        by_case.setdefault(case_id, []).append((event_id, event_type, from_status, to_status))
    problems = [
        f"{case_id}: {problem}"
        for case_id, events in by_case.items()
        for problem in _replay_case(events)
    ]
    return len(problems), problems[:MAX_EXAMPLES]


def _canonical(event: str, frm: str | None, to: str | None) -> tuple[str, str, str]:
    """One legal transition as (event, from, to); an unchanged status is '*' on both sides."""
    if frm == to:
        return (event, "*", "*")
    return (event, frm or "-", to or "-")


def _sql_transitions() -> set[tuple[str, str, str]]:
    """The legal rows of the SQL table in checks.py, read from its literal text."""
    rows = set()
    for event, frm, to in _LEGAL_ROW.findall(EVENT_TRANSITIONS):
        rows.add(_canonical(event, _unquote(frm), _unquote(to)))
    return rows


def _unquote(sql_value: str) -> str | None:
    return None if sql_value == "NULL" else sql_value.strip("'")


def _rules_transitions() -> set[tuple[str, str, str]]:
    """The same legal rows, derived from rules.TRANSITIONS."""
    rows = {_canonical(EventType.CASE_OPENED.value, None, Status.OPEN.value)}
    for (state, action), target in TRANSITIONS.items():
        rows.add(_canonical(ACTION_EVENTS[action], state.value, target.value))
    return rows


def transition_table_matches() -> tuple[int, list[str]]:
    """Legal transitions in either table but not the other, as (count, first examples).

    Zero means checks.py and rules.TRANSITIONS agree.
    """
    sql, rules = _sql_transitions(), _rules_transitions()
    differences = [f"only in checks.py: {row}" for row in sorted(sql - rules)]
    differences += [f"only in rules: {row}" for row in sorted(rules - sql)]
    return len(differences), differences[:MAX_EXAMPLES]


def run_replay_checks(con: psycopg.Connection[Any]) -> list[dict[str, Any]]:
    """Both replay checks, shaped like the SQL checks: name, description, violations, examples."""
    replay_count, replay_examples = lifecycle_replay(con)
    table_count, table_examples = transition_table_matches()
    return [
        {
            "name": "lifecycle_replay",
            "description": "every event is allowed by rules.TRANSITIONS at the status the case "
            "had, with its recorded from/to and the chain of statuses intact",
            "violations": replay_count,
            "examples": replay_examples,
        },
        {
            "name": "transition_table_matches",
            "description": "the SQL legal-transition table in checks.py equals rules.TRANSITIONS",
            "violations": table_count,
            "examples": table_examples,
        },
    ]
