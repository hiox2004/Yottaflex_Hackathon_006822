# 0010. Adopt the reviewed plans, with scope cuts
Date: 2026-11-14 · Status: Accepted

## Context
A separate planning pass produced an HLD and database, backend and frontend plans, and a critical review that fixed 23 problems
(score scale, flag rule, validator versus auditor, UI action contract, evaluation). The plans were still larger than the time left
(deadline 19:30, stretch 20:30), and the brief grades the generated data most heavily.

## Decision
Adopt `docs/plans/` as the design, amended by [05-scope-and-workflow.md](../plans/05-scope-and-workflow.md): no optimistic versioning, offset
pagination, no request ids, one DB user with trigger-enforced history, derived case status, fewer scenarios, no decision-agreement
metric. Work is split into two parallel tracks against a frozen [API contract](../api-contract.md), and the dataset steps are built before the app polish.

## Why
The review's corrections are right and cheap now. The cuts remove features that nothing in the brief asks for and that would
not fit the time.

## Supersedes
`docs/architecture.md`, `database/schema.sql` (rewrite), and decisions 0004, 0005 and 0009 where they differ: validator and auditor are
separate tools; reviewer ids use the `REV-` format; the seed.sql load path stays. Decisions 0001-0003, 0006-0008 stand.

## Consequences / revisit when
The earlier draft code is partly discarded. If the deadline moves to 20:30, the AI brief and the removed polish can return.
