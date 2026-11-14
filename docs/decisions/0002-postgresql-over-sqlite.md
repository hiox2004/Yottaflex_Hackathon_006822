# 0002. PostgreSQL instead of SQLite
Date: 2026-11-14 · Status: Accepted

## Context
We first leaned to SQLite: zero setup, trivially portable, and 10,000 submissions is tiny. Its downsides for this
project: embedded in the backend process (arguably not a separate tier), loose typing unless `STRICT`, foreign keys
off by default, no real permission model, single writer.

## Decision
Use PostgreSQL 16, run through Docker Compose (host port 5433).

## Why
- A genuine, separate database tier, which matches the three-tier requirement (0001).
- Stronger guarantees for the due-process rules: real types and enums, enforced foreign keys, and the ability to
  `REVOKE UPDATE, DELETE` on the append-only event table from the application role, which is stronger than a trigger alone.
- Docker Desktop was already available on the team's machine, so the setup risk was low.

## Alternatives considered
SQLite behind a repository layer (kept the door open to swap). Rejected once the separate-tier requirement was confirmed.

## Consequences / revisit when
- Anyone running the project needs Docker. Mitigation: documented one-command start, plus exported CSV/JSON/SQL seed data.
- Use portable, standard SQL where possible; keep all SQL behind `integrity/db.py` and repositories.
- Seed data is checksummed from the exported files, never from the database files.
