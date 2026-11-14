# 0001. Three-tier architecture: React, FastAPI, PostgreSQL
Date: 2026-11-14 · Status: Accepted

## Context
The team was told the solution should be a three-tier system (frontend, backend, database). The brief text on file
describes the workflow and the data requirements but does not itself state an architecture, so this comes from the
team's understanding of the event requirements.

## Decision
- **Frontend:** React (Vite). **Backend:** FastAPI (Python). **Database:** PostgreSQL 16 in Docker.
- The frontend talks only to the backend API; only the backend talks to the database.

## Why
Python suits the seeded data generator and validators; FastAPI gives typed request/response models (Pydantic) and
an OpenAPI contract the UI can be typed from; React is the common choice for the dashboard.

## Alternatives considered
Server-rendered UI (fewer moving parts, but weaker as a separate "frontend tier"); Streamlit (fast, but not a real tier).

## Consequences / revisit when
Three processes to run for the demo, so a single `docker compose` plus one dev command must be documented.
The UI is built after the data and rules are verified, not before.
