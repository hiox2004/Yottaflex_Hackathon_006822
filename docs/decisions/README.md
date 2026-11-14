# Decision log

One short record per significant decision: what we chose, why, what we gave up, and when to revisit it.
Numbered, never deleted. If a decision changes, add a new record that supersedes the old one.

| # | Decision | Status |
|---|---|---|
| [0001](0001-three-tier-architecture.md) | Three-tier architecture: React, FastAPI, PostgreSQL | Accepted |
| [0002](0002-postgresql-over-sqlite.md) | PostgreSQL instead of SQLite | Accepted |
| [0003](0003-deterministic-core-optional-ai.md) | Deterministic core; local AI is an optional add-on | Accepted |
| [0004](0004-where-rules-are-enforced.md) | Structural rules in the database, business rules in code | Accepted (amended by 0010) |
| [0005](0005-id-scheme.md) | ID scheme for Case and IntegrityRule | Accepted (amended by 0010) |
| [0006](0006-repository-scope.md) | What is and is not in the public repository | Accepted |
| [0007](0007-repository-structure.md) | Repository structure and working method (checkpoint testing) | Accepted |
| [0008](0008-simplicity-guardrails.md) | Simplicity and readability guardrails | Accepted |
| [0009](0009-generated-data-and-loading.md) | Generated data policy and database loading | Accepted (amended by 0010) |
| [0010](0010-adopt-reviewed-plans-with-scope-cuts.md) | Adopt the reviewed plans, with scope cuts | Accepted |
| [0011](0011-parallel-tabs-and-delegation.md) | Parallel tabs and delegation policy | Accepted |

## Template

```markdown
# NNNN. Title
Date: YYYY-MM-DD · Status: Proposed | Accepted | Superseded by NNNN

## Context
## Decision
## Why
## Alternatives considered
## Consequences / revisit when
```
