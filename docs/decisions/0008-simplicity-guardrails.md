# 0008. Simplicity and readability guardrails
Date: 2026-11-14 · Status: Accepted

## Context
The project is graded on clarity and ownership as well as correctness, is built quickly, and has a small team. The main risk
is over-engineering: abstractions, layers of indirection and features nobody asked for.

## Decision
Adopt [engineering-guidelines.md](../engineering-guidelines.md) and enforce what can be enforced mechanically:
- `ruff` rules for complexity, argument/branch/statement counts, leftover `print` and commented-out code.
- `mypy --strict`.
- A unit test capping source files at 300 lines.
- A pull-request checklist that asks "could this be simpler?" and "are the docs updated?".
- Plain SQL, no ORM; functions and Pydantic models, no class hierarchies; every feature traces to a requirement row.

## Why
Mechanical limits catch drift cheaply and without debate; the written rules cover what tools cannot judge.

## Alternatives considered
Guidelines only (unchecked, tends to erode); heavy tooling such as docstring-coverage and architecture linters
(adds complexity to prevent complexity).

## Consequences / revisit when
Limits may occasionally force a split that feels unnecessary. Raise a limit only with a one-line justification in the commit.
