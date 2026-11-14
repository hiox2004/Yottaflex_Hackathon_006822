# Academic Integrity Workflow

End-to-end workflow for similarity flags, evidence, conflict-free reviewer assignment, append-only case timelines and
appeals with due process. A flag triggers **human review, never automatic guilt**.

**Status:** foundations in place (database tier, backend skeleton, CI). Schema, generator, validator and auditor are next;
see [requirements.md](requirements.md) for the tracked checklist.

## Architecture (three tiers)

| Tier | Technology | Where |
|---|---|---|
| Frontend | React + Vite | `frontend/` (built after the data and rules are verified) |
| Backend | FastAPI, Pydantic v2 | `backend/integrity/` |
| Database | PostgreSQL 16 (Docker) | `docker-compose.yml`, `db/` |

Everything that matters is deterministic Python/SQL. An optional local-model "case brief" may be added last; it is off by
default and never writes data. See [docs/decisions/](docs/decisions/) for why each choice was made.

## Quick start

Requires Docker, Python 3.11+.

```bash
docker compose up -d db                  # start PostgreSQL on localhost:5433
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"    # Windows; use .venv/bin/pip on macOS/Linux
cp .env.example .env
.venv/Scripts/uvicorn integrity.main:app --app-dir backend --reload
# http://localhost:8000/health
```

## Development checks

```bash
ruff check . && ruff format --check .   # lint + formatting
mypy                                     # strict type check
pytest                                   # unit + integration (needs the db container)
pytest -m "not integration"              # unit tests only
```

CI runs the same checks against a Postgres service on every push and pull request.
Optional: `pre-commit install` to run lint and hygiene hooks before each commit.

## Documentation

- [docs/](docs/README.md): architecture and reference
- [docs/decisions/](docs/decisions/README.md): decision records (what, why, alternatives)
- [prompts/](prompts/README.md): prompt log, exported from session transcripts with `python scripts/export_prompts.py`
- [requirements.md](requirements.md): requirement matrix, ambiguity log, assumptions
