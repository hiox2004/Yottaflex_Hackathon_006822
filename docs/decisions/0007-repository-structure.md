# 0007. Repository structure and working method
Date: 2026-11-14 · Status: Accepted

## Context
The first scaffold put `pyproject.toml` at the root and mixed concerns. We want frontend and backend not to clash or
intertwine, a layout a newcomer can navigate, and a lean way of working that does not spend effort running tests after
every small change.

## Decision
- Top-level folders by tier and purpose: `backend/`, `frontend/`, `database/`, `data/`, `docs/`, `scripts/`, `prompts/`.
- `backend/` and `frontend/` are independent projects with their own tooling; the HTTP API is their only contract.
- Backend uses a `src/` layout with layers `api → services → repositories → db`, pure `rules/`, shared `domain/`, and
  separate `datagen/`, `validation/`, `auditor/` and optional `ai/` packages.
- Shared lint config (`ruff.toml`) at the root because Python also lives in `scripts/`; project config in `backend/pyproject.toml`.
- Tests are few, concise and behaviour-focused, split into `unit/` (nothing running) and `integration/` (needs the database).
  They run at checkpoints (end of a build step, before a commit that closes a requirement, before release), not after each edit.
  CI runs them on every push so local runs can stay infrequent.

## Why
Clear ownership of each folder, one-way dependencies that stop logic leaking into the API or SQL leaking into services,
and a cheap feedback loop that still guarantees every pushed commit is checked.

## Consequences / revisit when
Adding a layer or moving a package needs an update to `backend/README.md`. Revisit the checkpoint cadence if bugs start
slipping between checkpoints.
