# Backend

FastAPI service plus the deterministic data tooling. Self-contained: its own `pyproject.toml`, tests and tooling.
It never imports from `frontend/`; the only contract between them is the HTTP API.

```
src/integrity/
  api/            routers + request/response schemas (HTTP only, no business logic, no SQL)
  services/       use-cases; enforce business rules; call repositories
  repositories/   all SQL lives here (plus db.py)
  rules/          pure functions: thresholds, conflict of interest, lifecycle transitions
  domain/         enums, ID formats, typed models shared by all layers
  datagen/        seeded generator + anomaly injection (only package allowed to write ground truth)
  validation/     dataset validators and the reproducibility check
  auditor/        independent due-process auditor (never reads ground truth)
  ai/             OPTIONAL local-model case brief (off by default)
  config.py db.py main.py
tests/
  unit/           fast, need nothing running
  integration/    need the database: docker compose up -d db
```

Dependency direction (never upwards): `api → services → repositories → db`, and `services → rules → domain`.

## Commands (run from `backend/`)
```bash
pip install -e ".[dev]"
uvicorn integrity.main:app --reload       # http://localhost:8000/health
```
Quality checks are run at checkpoints, not after every small change; see the root README.
