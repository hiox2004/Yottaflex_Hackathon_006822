# Architecture

```
React (Vite)  ──HTTP/JSON──▶  FastAPI  ──SQL──▶  PostgreSQL 16
 frontend/                    backend/src/integrity  docker-compose.yml, database/
                                 │
                                 └─ optional, off by default: local LLM "case brief" (read-only, advisory)
```

## Backend layers (target)
`api → services → repositories → db`. Rules are pure functions in `rules/` called by the services. Only `db.py` and the
repositories contain SQL. Full package map: [backend/README.md](../backend/README.md).

## Where rules are enforced
See [decision 0004](decisions/0004-where-rules-are-enforced.md). Structure and append-only history are guaranteed by
the database; business rules are enforced by services and checked independently by the auditor.

## Data flow
1. The seeded generator (`integrity/datagen`) writes CSV, JSON and SQL seed files to `data/<scale>/` and the ground truth to
   the separate `data/ground_truth/<scale>/`.
2. The seed SQL is loaded into PostgreSQL using the same schema (`database/schema.sql`) the application uses.
3. The validator checks keys, joins, enums, date order, reconciliation and lifecycle transitions.
4. The auditor, which never reads ground truth, detects the four injected scenarios; its output is scored against
   ground truth offline to produce precision, recall and F1.

## Determinism
Fixed seed `20261022`, one RNG stream per purpose, an injected clock (no `now()`), sorted output. Reproducibility is
proven by regenerating twice and comparing SHA-256 checksums of the exported files (not the database files).
