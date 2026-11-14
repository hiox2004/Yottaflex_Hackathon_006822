# Database

PostgreSQL 16, run by `../docker-compose.yml` (host port 5433).

- `schema.sql`: tables, enums, keys, constraints, views, append-only event protections (added in the schema step).
- Structural rules live here; business rules live in the backend (see `docs/decisions/0004-where-rules-are-enforced.md`).
- Generated seed data is in `../data/`, not here.
