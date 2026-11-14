# Scope cuts and team workflow

Status: accepted (user), 2026-11-14, amended 15:50 (third tab, transparency additions). Where this differs from plans 00-03, **this file wins**.
Contract: [api-contract.md](../api-contract.md) (v1.1). Deadline planned for 19:30 (stretch 20:30). Feature freeze 18:45; the last 45 minutes are for
verification, README, DEMO.md and rehearsal.

## 1. Answers to the review's open questions (defaults accepted)
1. Auto-dismissed flags need no human confirmation (they only favour the learner; state it in the README).
2. "Same department = conflict" stays; generate staff across at least 6 departments.
3. Appeal window 14 days, stored on `integrity_rule`. Seeded decided cases are older than that, so the demo can close them; a case decided live cannot be closed (say so in DEMO.md).
4. Full-scale data: commit the manifest and validation summary only; starter (full / 10) is committed.
5. No reviewer removal from a case (stated limit).
6. AI brief only if M4 is verified before the freeze.

## 2. Scope cuts (replace the matching parts of plans 00-03)
| Cut | Replaced by |
|---|---|
| `expected_version`, `version`, `STALE_VERSION` | `SELECT ... FOR UPDATE` inside each write transaction; the UI refetches after every write |
| Keyset cursor | `limit` / `offset` (default 50, max 200) with a `total` |
| `x-request-id` header and request id in the UI | none; one log line per request (method, path, actor, status, ms) |
| `integrity_app` / `integrity_owner` roles and column grants | one DB user; append-only enforced by triggers |
| Stored `status`, `version`, `closed_at` on the case plus `v_case_status_replay` | status and closed_at derived from `case_event` by view `v_case_status` |
| `supersedes_decision_id`, `tool_version` | dropped |
| `repeat_offender` scenario, 5% reviewer-disagreement noise, decision-agreement metric | dropped. Scenarios: clean, legitimate_quote, shared_template, false_positive, genuine_copy |
| OpenAPI type generation | hand-written types mirroring the contract |

Kept: `v_flag` view, flag on raw score and case on the adjusted band, append-only history, four anomalies with decoys, ground truth kept apart,
live auditor, triage-versus-scenario evaluation, `allowed_actions`, 401/403 role checks, Rules page and a small Audit page.
**Added for transparency (contract v1.1):** `flag.explanation` steps, `action_checks` with reasons, `needs_my_action`, findings filtered by case.
Metrics on the Audit page: auditor precision/recall/F1 per issue type, triage-versus-scenario, validation summary.

## 3. Tracks, owners and milestones (three worker tabs plus this orchestrator tab)
| | Database tab | Backend tab | Frontend tab | Time |
|---|---|---|---|---|
| D1 | `schema.sql` (tables, views, triggers, checks) and `load(scale)` | | | 16:20 |
| M1 | | ids, models, pure rules (incl. `explain_triage`, `action_checks`) with boundary tests; CLI skeleton | Router, actor picker, API client with fixtures, design tokens, Queue page | 16:40 |
| M2 | Dictionary, validator, DB tests (D2 17:05) | Datagen starter, export, repro, read endpoints; load via DB tab's loader | Case page read-only (similarity strip, gates, journey rail, engine panel), Rules page | 17:20 |
| M3 | Auditor with decoy tests, validation summary writer (D3 17:50) | Write endpoints and guards, G1-G4 API tests, full scale, eval | Write actions from `action_checks`, error states | 18:10 |
| M4 | Run both tools on starter and full, fix (D4 18:15) | `/audit/*`, manifest, CI green | Audit page, live API switch, tests, build | 18:45 freeze |
| Final | README, DEMO.md, rehearsal, repro and CI check (orchestrator with all tabs) | | | 19:30 |

## 4. Ownership and shared files
| Path | Owner |
|---|---|
| `database/`, `backend/src/integrity/{dbload.py,validation/,auditor/}`, `backend/tests/integration/conftest.py`, their tests (`backend/tests/db/`), `docs/DATA_DICTIONARY.md`, `docs/status/database.md` | database tab |
| rest of `backend/` (ids, models, rules, queries, services, api, datagen, eval, cli, ai), `data/`, `docs/status/backend.md` | backend tab |
| `frontend/`, `docs/status/frontend.md` | frontend tab |
| `docs/` (everything else), `README.md`, `.github/`, `ruff.toml`, `docker-compose.yml`, root configs, `_template/design/` | orchestrator tab (this one) |
A tab that needs a change in a path it does not own writes a request in its status file; the orchestrator makes it. The backend tab may import and call, but not edit, the database tab's modules.

**Interfaces between database and backend tabs** (agree once, then stable):
- `integrity.dbload.load(scale: str | None)`: resets the target DB, applies the schema, loads `data/<scale>/seed.sql`.
- `integrity.validation.run_checks(con) -> list[Violation]` and `summarize(con) -> dict`; `python -m integrity.validation` prints a summary and exits non-zero on any violation.
- `integrity.auditor.audit(con, case_id: str | None = None) -> list[Finding]` (`Finding` has the contract's fields); `python -m integrity.auditor`.
- Schema is final enough for datagen at D1. Later schema changes need a note in `docs/status/database.md` the same hour.

## 5. Working agreement
- **Git.** All tabs share one working tree. Commit only your own paths: `git add <paths>` then `git commit -m "..." -- <paths>` (the pathspec stops a commit
  from picking up another tab's staged files). Never `git add -A` or `.`, never force-push, never reset or checkout files you do not own. If `index.lock` exists, wait and retry. Hooks must pass.
- **Databases.** One Postgres container (`docker compose up -d db`, port 5433) with a database per tab so loads never collide:
  database tab `integrity_dbtab`, backend tab `integrity_api`, the default `integrity` is the demo database and is loaded by the orchestrator at the end.
  Set it per shell: PowerShell `$env:DATABASE_URL="postgresql://integrity:integrity_dev@localhost:5433/integrity_dbtab"` (the environment overrides `.env`).
  Loading wipes the `public` schema of whichever database the URL names. Tests use a rolled-back scratch schema. The frontend never touches the DB.
- **Contract.** `docs/api-contract.md` is frozen at v1.1. Need a change? Add it under "Contract change requests" in your status file; the orchestrator decides, edits the contract and notes it in the affected status files.
- **Status.** Update `docs/status/<tab>.md` at each milestone and when blocked: at most 15 lines. The orchestrator reads them on request only.
- **Quality.** [engineering-guidelines.md](../engineering-guidelines.md): simple code, files under 300 lines, few concise tests run at checkpoints only (end of a milestone), docs updated in the same change.
- **Local knowledge base.** Before designing or when unsure, look it up cheaply: `python _template/tools/kb.py search "<keywords>" -n 5`, then `toc <id>`, then `get <id> --section <name>`. Never read an entry whole.
  Each tab prompt lists the entries worth reading first. Use `/research` only for facts the library lacks.
- **Delegation.** [Decision 0011](../decisions/0011-parallel-tabs-and-delegation.md): the tab's main model leads; Haiku subagents only for large, mechanical, self-verifying chunks; at most two at a time.
- **Conflicts and doubt.** Ask the orchestrator through the status file. Do not guess a contract or scope change.

## 6. State of the uncommitted backend draft (all tabs: read this)
Written before the plans existed, against an older schema (separate department, course, enrollment and flag-event tables).
- **Reuse the idea, not the file:** `rules/thresholds.py` (band, score rounding), `datagen/common.py` (per-purpose seeded streams), `tests/integration/conftest.py`
  (rolled-back scratch-schema fixture), the validator's and auditor's check lists.
- **Reshape or delete:** everything else under `datagen/`, `validation/`, `auditor/`; `database/schema.sql` (rewrite); the three draft integration tests (rewrite for the new schema).
- The database tab handles `validation/`, `auditor/`, `schema.sql` and the conftest; the backend tab handles `datagen/`, `rules/`. Do not commit draft files that no longer match the plans; `git status` must show no leftovers by M2.

## 7. Done at the freeze (18:45)
Database: schema final; validator passes 100% on starter and full with anomalies present; auditor finds each labelled anomaly and ignores its decoy; dictionary matches the schema.
Backend: `load --scale full` works from a clean DB; `repro` shows identical checksums (also across two `PYTHONHASHSEED` values); G1-G4 each rejected by the API; CI green.
Frontend: four pages on the live API; only `action_checks` that are allowed offer a button; lint, typecheck, tests and build pass.
All: status files current, no leftover draft code, README quick start works from a fresh clone.
