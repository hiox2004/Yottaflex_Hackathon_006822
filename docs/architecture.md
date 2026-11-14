# Architecture

> **Primary Architecture Specification**: Please refer to the complete, reviewed High-Level Design at **[docs/plans/00-hld.md](plans/00-hld.md)** and the Scope & Workflow agreement at **[docs/plans/05-scope-and-workflow.md](plans/05-scope-and-workflow.md)**.

---

## System Overview

```
React (Vite)  ──HTTP/JSON──▶  FastAPI  ──SQL──▶  PostgreSQL 16
 frontend/                    backend/src/integrity  docker-compose.yml, database/
```

### Key Principles
1. **Three-Tier Separation**:
   - `frontend/`: Single-page app with accessible dialogs, similarity strip, fairness gates, and audit insights. Communicates solely via HTTP/JSON.
   - `backend/`: FastAPI application enforcing strict validation, `action_checks`, `SELECT ... FOR UPDATE` transactional concurrency, and append-only event logging.
   - `database/`: PostgreSQL 16 schema with 13 tables, computed `adjusted_score`, views (`v_case_status`, `v_flag`, `v_case_queue`), and append-only triggers.
2. **Deterministic Domain Core**:
   - Pure Python business rules in `rules.py` (no I/O, no wall-clock time).
   - Seeded synthetic datagen (`20261022`) guaranteeing byte-identical reproducibility across platforms and hash seeds (`repro`).
3. **Decoupled Verification**:
   - **Validator** (`integrity.validation`): 15 structural checks confirming data integrity; passes with 0 violations even when anomalies are present.
   - **Auditor** (`integrity.auditor`): Independent due-process auditor detecting exactly the 4 injected anomalies (G1–G4) while ignoring legitimate near-miss decoys.
