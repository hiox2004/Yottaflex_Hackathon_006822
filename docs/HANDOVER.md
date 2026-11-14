# Handover: Integrity Desk

Written 2026-11-14 16:55 for a new IDE or agent session that continues this work. **Deadline 19:30 tonight (stretch 20:30). Feature freeze 18:45.** The last 45 minutes are for verification, README, DEMO.md and rehearsal.
Repo: https://github.com/hiox2004/Yottaflex_Hackathon_006822 (public, MIT), working folder `c:\CandidateWorkspace`, branch `main`. Latest pushed commit at writing: `2b6804d`, CI green.

## 1. What this is
An academic-integrity workflow for a hackathon brief (YottaFlex AI in-office final): similarity flags, evidence, conflict-free reviewer assignment, append-only case timelines, appeals with due process. The brief grades **two things**:
1. **A reproducible synthetic dataset** (10,000 submissions, 1,000 flags, 300 cases, seed `20261022`) with four labelled anomalies, separate ground truth, data dictionary, manifest, validation summary and a reproducibility proof.
2. **A working three-tier app** (React, FastAPI, PostgreSQL) that shows the rules and catches the four negative scenarios. The dataset is graded most heavily, so protect it first.
A flag triggers **human review, never automatic guilt**. Deterministic Python and SQL decide everything. An AI layer is optional, last, off by default, and not started.

## 2. Read first, in this order
1. This file.
2. `docs/plans/05-scope-and-workflow.md`: accepted scope cuts, ownership, milestones, working agreement. **It wins over plans 00 to 03 wherever they differ.**
3. `docs/api-contract.md` (v1.3, frozen): paths, shapes, enums, error codes, fairness-gate mapping.
4. `docs/status/orchestrator.md` (decisions and answers), then `docs/status/database.md`, `backend.md`, `frontend.md`.
5. `docs/plans/00-hld.md`, `01-database-plan.md`, `02-backend-plan.md`, `03-frontend-plan.md`, `04-review.md` (design and the reasons for it), `docs/engineering-guidelines.md`, `docs/decisions/` (0001 to 0011).
6. Local, git-ignored helpers in `_template/` (present on this machine): `_template/design/case-mock.html` + `design-notes.md` (visual language), `_template/tab-prompts/*.md` (the three worker prompts used so far), and a cheap knowledge base: `python _template/tools/kb.py search "<keywords>" -n 5`, then `toc <id>`, then `get <id> --section <name>`.

## 3. State at 16:55
| Track | Done (committed) | In progress or missing |
|---|---|---|
| **Database** (schema, loader, dictionary, validator, auditor) | D1 to D3 (`e2095de`, `99def88`, `aa08621`): schema with 13 tables, views `v_case_status` `v_flag` `v_case_queue`, append-only triggers; `dbload.load(scale)`; dictionary; validator with 15 checks and `summarize`; auditor G1 to G4 in SQL with decoy tests; 38 DB tests pass | **D4**: independent run of validator and auditor on starter and full data (the backend tab reports it already ran them: validator 0 violations, auditor finds 4 on starter and 8/10/8/6 on full) |
| **Backend** (rules, datagen, API, eval) | M1 and M2 (`8587c2c`, `2b6804d`): pure rules (`action_checks`, `explain_triage`, guards, transitions), datagen with quotas, boundary rows, anomalies and decoys, hash-stable export, `repro`, read endpoints (v1.2 fields), error envelope, actor stub. Starter 1,000/100/30 and full 10,000/1,000/300 generate and load. `repro` identical across `PYTHONHASHSEED` values (reported by the tab) | **M3 is written but uncommitted** (see section 4A). M4 not started |
| **Frontend** | M1 to M4 (`128dad7`): four pages at M4 (Queue, Case, Rules, Audit). Since then the queue is the **Cases** page (tabs: Needs you, All cases, Under review, Awaiting appeal, Decided, Closed, Dismissed flags), and **Overview, Guide and Test Lab** were added. Hand-drawn strip, gates, journey rail, "How this flag became a case" panel (always visible; the "Show the engine" switch is gone), eight write actions in dialogs from `action_checks`, Vitest tests, live API is the default (`VITE_USE_FIXTURES=true` for offline) | Never run against the live API. No screenshot check yet of the action dialogs and the Audit page |
| **Docs / orchestration** | Plans, review, scope cuts, contract v1.3, decisions 0001 to 0011, status files, CI (lint, mypy, tests with Postgres, frontend job), per-tab databases, this handover | README final form, `docs/DEMO.md`, final checklist run, decision amendments, `architecture.md` pointer, requirements statuses, prompt-log export, fresh-clone test, demo database load |

Uncommitted files on disk at 16:55 (backend M3 in flight, plus regenerated starter data): `backend/src/integrity/api/{app,deps}.py`, `cli.py`, `db.py`, `schemas.py`, `services/read_service.py`, `tests/api/conftest.py`, new `api/routers/{actions,audit}.py`, `services/{case_service,appeal_service,audit_service}.py`, new `eval/` package, new `tests/api/{test_write_endpoints,test_audit_endpoints}.py`, `data/starter/*` (regenerated) and `data/full/manifest.json`, deleted empty `domain/__init__.py` and `repositories/__init__.py`, plus an edit to `docs/plans/01-database-plan.md`. **Run `git status` first. Do not discard these.**

## 4. What remains, in order
**A. Finish and commit backend M3** (about 30 to 45 minutes)
- Run `ruff check . && ruff format --check .` (repo root), `mypy` and `pytest` (in `backend/`). Fix what shows. Known earlier: lint errors in `queries/writes.py` and `schemas.py` were in-progress files.
- Write endpoints per the contract: assign reviewer, add evidence, reopen, decision, appeal, appeal reviewer, appeal outcome, close. One transaction each, `SELECT ... FOR UPDATE` on the case, row and `case_event` together, response is the updated `CaseDetail` with `action_checks`. Roles 401/403; rule refusals 409 with the contract's codes.
- G1 to G4 API tests: each scenario is rejected by the API. One `security-review`-style pass over the write endpoints (SQL parameterisation, role checks).
- Then commit with a pathspec (see section 7) and push.

**B. Backend M4** (about 30 minutes)
- `/audit/findings?case_id=` (calls the auditor live), `/audit/metrics` and `/audit/validation` (serve `data/<scale>/metrics.json` and `validation.json`, with `dataset_hash`; shapes are final in the contract), `cli eval`, manifest, a contract test that a `CaseDetail` has the contract's keys.
- Full scale: `cli datagen --scale full`, `cli load --scale full`, `cli validate`, `cli eval`, `cli repro --scale full`. Commit `data/starter/*`, `data/full/manifest.json`, `validation_summary.md`, `validation.json`, `metrics.json` (the `.gitignore` now allows these; bulk full CSVs stay untracked on purpose, decision 0009).

**C. Database D4** (about 15 minutes): load starter and full into your own database, run `python -m integrity.validation` and `python -m integrity.auditor`, confirm 0 violations and exactly the labelled findings with decoys ignored. Fix mismatches in your own paths.

**D. Frontend live pass** (about 30 minutes, after the backend has a loaded database and the API running)
- Start API: `cd backend; ..\.venv\Scripts\uvicorn integrity.main:app --reload`; set `DATABASE_URL` first (section 6). Run `cd frontend; npm run dev` (live is the default).
- Walk the five demo beats (section 4F) against real data; fix response-shape mismatches **client-side**; report contract problems in `docs/status/frontend.md`.
- One screenshot check of the action dialogs and the Audit page in light, dark and 400 px. The previous tab used headless Chrome.

**E. Final phase (orchestrator work, from about 17:45)**
1. `README.md` final: overview, architecture picture, how to run, how it works (rule in one paragraph), dataset deliverables (command, seed, manifest, validation, reproducibility), evaluation numbers, assumptions and limits (synthetic data proves rule coverage, not generalisation; actor header is an auth stub; no reviewer removal; appeal window of 14 days enforced when filing; auto-dismissal favours the learner), AI statement.
2. `docs/DEMO.md`: 5-minute script with **pinned case ids** taken from the generated full data (one clean case, a conflicted-assignment attempt, evidence-after-decision refusal, an independent-appeal case, and one failing gate per anomaly from `python -m integrity.cli audit`).
3. `docs/architecture.md` becomes a short pointer to `docs/plans/00-hld.md`. Mark decisions 0004, 0005, 0009 as amended by 0010 in `docs/decisions/README.md`. Update `docs/requirements.md` statuses (VERIFIED only with a passing check or a produced artifact).
4. Prompt log: `python prompts/export_prompts.py` writes `prompts/prompts.md`. It currently includes pasted problem-statement text; change the exporter to replace pasted blocks with an "omitted" marker, review the output, then `git add -f prompts/prompts.md`.
5. Fresh-clone test: clone the repo into a temp folder, follow the README quick start only, run `cli load --scale starter`, validator, auditor, API, `npm ci && npm run build`. Fix whatever the README missed.
6. Load the demo database: unset `DATABASE_URL` (default database `integrity`), `python -m integrity.cli load --scale full`, start API and UI, rehearse the demo with the fixed case ids.
7. Confirm CI is green on the final commit, the repo is public, and no secrets or personal data are tracked (`git grep -i -E "gmail|password"` should only hit the throwaway dev password in `docker-compose.yml`, `.env.example`, CI).

**F. Five demo beats** (from `_template/design/design-notes.md`): (1) reviewer opens Cases on the "Needs you" tab, picks a case, sees the similarity strip, fairness gates and the "How this flag became a case" panel, records a reasoned decision; (2) administrator tries a conflicted reviewer, sees the reason, picks an eligible one; (3) adding evidence after a decision is refused until the case is reopened; (4) appeal needs an independent reviewer and closing is refused while the window is open; (5) Audit page: live findings link to cases with a red gate, metrics, validation summary, synthetic-data caveat.

**G. Optional**: the AI "case brief" (local model, advisory, read-only, deterministic fallback, faithfulness check) only if A to E are verified before 18:45. `llama3.2:3b` is not pulled; Ollama is installed; GPU is an RTX 3050 with 4 GB. It is fine to skip it and say why in the README.

## 5. Rules that must not be broken
- **Flag** = report with `raw_score >= review_threshold` of the rule in force at submission time. A **case** opens only if the adjusted score (raw - quoted - template) is in the review band (0.60 or above). Otherwise the flag is **auto-dismissed** with reason `quote_only` or `template_match` (the larger exclusion; a tie is `quote_only`). Thresholds 0.30 / 0.60 / 0.80; the second rule version has a higher review gate. No code path turns a score into a decision.
- **Four anomalies**, injected into structurally valid cases and labelled in ground truth: G1 `AUTO_GUILT_WITHOUT_REVIEW` (violation confirmed with no human; the case keeps a legal assigned-then-decided event path), G2 `REVIEWER_CONFLICT` (instructor of the assessment, same department, or already reviewed a case of this learner), G3 `EVIDENCE_AFTER_DECISION_NO_HISTORY` (evidence after the decision with no reopen and no `evidence_added` event), G4 `APPEAL_CLOSED_NO_INDEPENDENT_REVIEW`. Each has decoys (legitimate near-misses).
- **Validator** checks data quality and must pass 100% with anomalies present. **Auditor** checks due process and finds the anomalies; it never imports `rules`, `services` or `datagen` and never reads ground truth. Ground truth is read only by `datagen` and `eval` (a unit test enforces it).
- **Determinism**: no wall-clock time, `uuid4`, unseeded random or hash-order output in anything that feeds data or ids; every SQL list has a total `ORDER BY`; scores are integers or `Decimal`; hash-stable files (LF, sorted, fixed formats). `cli repro` proves it.
- **Simplicity** (decision 0008): plain functions, Pydantic models, plain SQL, no ORM, files under 300 lines, functions under 30 statements, no new dependency without a reason. **Contract is frozen** at v1.3; changes go through a written request.
- **Scope cuts** (05 section 2): no optimistic versioning, offset pagination, no request ids, one DB user with trigger-enforced history, derived case status, five scenarios, no decision-agreement metric.

## 6. How to run
```powershell
# prerequisites: Docker Desktop, Python 3.12 venv at .venv, Node 22
docker compose up -d db                     # PostgreSQL 16 on localhost:5433 (databases: integrity, integrity_dbtab, integrity_api)
.\.venv\Scripts\python -m pip install -r backend/requirements.lock ; .\.venv\Scripts\python -m pip install -e backend --no-deps
$env:DATABASE_URL="postgresql://integrity:integrity_dev@localhost:5433/integrity_api"   # pick a database; unset = demo database `integrity`
.\.venv\Scripts\python -m integrity.cli datagen --scale starter     # or full; also: load | validate | audit | eval | repro (each takes --scale where relevant)
.\.venv\Scripts\python -m integrity.cli load --scale starter        # WIPES `public` of the database in DATABASE_URL, applies schema, loads seed
cd backend; ..\.venv\Scripts\uvicorn integrity.main:app --reload    # http://localhost:8000/api/health
cd frontend; npm install; npm run dev                              # http://localhost:5173 ; VITE_USE_FIXTURES=true for the offline fixture demo
```
Checks (run at milestones, not after every edit): repo root `ruff check . ; ruff format --check .`; in `backend/` `mypy` and `pytest`; in `frontend/` `npm run lint ; npm run typecheck ; npm test ; npm run build`. CI runs all of them on every push.
Dev database credentials are throwaway and public in `docker-compose.yml`. `.env` is git-ignored; `.env.example` shows the variables.

## 7. Working agreement (keep it if several agents work in parallel)
- **Ownership**: database (`database/`, `dbload.py`, `validation/`, `auditor/`, `conftest.py`, dictionary), backend (rest of `backend/`, `data/`), frontend (`frontend/`), orchestration (`docs/`, README, CI, root configs). Ask through `docs/status/<tab>.md` before touching another owner's files.
- **Git**: all agents share one working tree. Commit only your own paths: `git add <paths>` then `git commit -m "..." -- <paths>`. Never `git add -A` or `.`, never force-push, never reset or checkout files you do not own. Pre-commit hooks (ruff, whitespace, secrets) must pass. Push after each milestone.
- **Databases**: one database per agent so `load` never collides (`integrity_dbtab`, `integrity_api`); `integrity` is the demo database, loaded last.
- **Tests**: few, short, behaviour-focused, at milestones; integration tests use a rolled-back scratch schema and never wipe a database.
- **Tokens**: use the knowledge base before researching; read diffs, not whole files; do not poll other agents; the status files are the report.

## 8. Known issues and gotchas
- **Windows PowerShell**: git and docker write progress to stderr, so commands show exit code 255 or red text although they worked; verify with `git rev-parse` and `git log`. `git commit -F -` with a here-string does not pipe; use `-m` or a message file. Git was told `safe.directory` globally for this folder.
- **Commit identity** for this repo is the GitHub noreply address (set locally); do not commit a personal email.
- **Lint config**: `ruff.toml` (repo root) exempts `datagen/` from `S311`, `PLR2004`, `RUF100` on purpose; `_template/` and `.claude/` are excluded.
- **Ignored on purpose**: `_template/`, `.claude/`, `CLAUDE.md`, `.venv`, `node_modules`, `.cache/`, `.vscode/`, `prompts/prompts.md`, bulk `data/full/*` (manifest and summaries are tracked).
- **Frontend**: Vite is pinned to 6 because Node is 22.7; `npm audit` shows dev-tooling warnings, ignored. Dependencies are an allowlist (`react-router-dom`, `@tanstack/react-query`, `@radix-ui/react-dialog`, `lucide-react`).
- **Ollama** was started accidentally earlier and may still be running; harmless. No AI code exists yet.
- **Stated limits** (keep them honest in the README): actor header is spoofable (no auth); synthetic scores prove rule coverage, not generalisation; auto-dismissal of 700 flags is a documented rule that only favours the learner; no reviewer removal; appeal window is 14 days, so a case decided live cannot be closed in the demo (seeded older cases can).

## 9. Open questions for the user
1. What exactly is submitted (repo link only, a demo video, slides, a live demo)? Shapes how the README and `DEMO.md` are written. Never answered.
2. Is 19:30 still the deadline, or 20:30? (Affects only the optional AI brief.)
3. Keep or delete this handover before submission? It is process-internal; deleting it is harmless.

## 10. Suggested first message for the new agent
```
Read docs/HANDOVER.md fully, then docs/plans/05-scope-and-workflow.md and docs/api-contract.md. Run git status (there is uncommitted backend M3 work: do not discard it). Then do section 4A, 4B, 4C, 4D in that order, checking only at milestones, committing only your own paths, and updating docs/status/<tab>.md. Stop and ask me only if blocked or if a contract change is needed. When 4A to 4D are done, do section 4E.
```
If you run several agents in parallel: one for backend (4A, 4B), one for database (4C), one for frontend (4D, starting after backend has a loaded database), and one for final docs (4E). `_template/tab-prompts/{backend,database,frontend}.md` are reusable; replace their milestone sections with the matching part of section 4.
