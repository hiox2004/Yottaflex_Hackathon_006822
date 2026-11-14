# Academic Integrity Workflow

End-to-end workflow for similarity flags, evidence, conflict-free reviewer assignment, append-only case timelines and
appeals with due process. A flag triggers **human review, never automatic guilt**.

**Status:** foundations in place. Schema, generator, validator and auditor are next; progress is tracked in
[docs/requirements.md](docs/requirements.md).

## Repository layout

```
backend/     FastAPI service + deterministic data tooling (own pyproject, tests)   -> backend/README.md
frontend/    React + Vite app (own package.json; talks to the backend only over HTTP) -> frontend/README.md
database/    PostgreSQL schema and notes                                           -> database/README.md
data/        generated seed data (starter, full) and isolated ground truth         -> data/README.md
docs/        architecture, requirements, decision records
prompts/     prompt log and its export script
.github/     CI
docker-compose.yml   database tier
```

| Tier | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | FastAPI, Pydantic v2 |
| Database | PostgreSQL 16 (Docker) |

Everything that matters is deterministic Python/SQL. An optional local-model "case brief" may be added last; it is off by
default and never writes data. [docs/decisions/](docs/decisions/README.md) records why each choice was made.

## Quick start

Requires Docker and Python 3.11+.

```bash
docker compose up -d db                       # PostgreSQL on localhost:5433
python -m venv .venv
.venv/Scripts/pip install -e "backend[dev]"   # Windows; .venv/bin/pip on macOS/Linux
cp .env.example .env
cd backend && ../.venv/Scripts/uvicorn integrity.main:app --reload    # http://localhost:8000/health
```

## Quality checks

Run at **checkpoints** (end of a build step, before closing a requirement, before release), not after every edit.
CI runs everything on each push.

```bash
ruff check . && ruff format --check .         # from the repo root
cd backend && mypy                            # strict type check
cd backend && pytest tests/unit               # fast, nothing running
cd backend && pytest                          # unit + integration (needs the db container)
```

Optional: `pre-commit install` for lint and hygiene hooks on commit.

## Documentation

- [docs/architecture.md](docs/architecture.md), [docs/requirements.md](docs/requirements.md)
- [docs/decisions/](docs/decisions/README.md): what we decided, why, and the alternatives
- [prompts/](prompts/README.md): prompt log, exported from session transcripts with `python prompts/export_prompts.py`
