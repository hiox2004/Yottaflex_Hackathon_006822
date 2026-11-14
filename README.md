# YottaFlex Hackathon: Academic Integrity Due-Process Workflow

Integrity Desk is a three-tier web application for academic integrity cases. It takes similarity reports, triages
them into flags and cases, collects evidence, assigns conflict-free reviewers, records decisions and appeals in an
append-only timeline, and shows staff the rules behind every step.

A similarity score is investigative evidence only. It can open a case for human review. It never finds anyone guilty.
Every step is decided by deterministic, tested rules and written to an append-only event ledger. The repository also
contains a seeded synthetic dataset generator, a validator and an auditor, so the workflow can be checked against
known answers.

All data is fully synthetic. No real student, staff or institution data is used. There is no sign-in: the acting
person is named by a request header (see [Security and governance](#security-and-governance)).

## AI approach in brief

**The product contains no AI.** Every flag, triage band, reviewer conflict, evidence requirement, appeal window and
lifecycle transition is a deterministic rule in `backend/src/integrity/rules/`. Same input, same outcome, and each
outcome names the rule that produced it. The package `backend/src/integrity/ai/` is an empty stub that only states the
intent: an optional, local, read-only, advisory case brief that is off by default and falls back to deterministic text.
Nothing imports it, and no backend module imports a model SDK.

There are two places where AI is involved, and neither is inside the product's decision path:

- **Development.** The application was built with Claude Code agents. The prompts used are exported to
  [prompts/prompts.md](prompts/prompts.md) (see [AI use and prompt history](#ai-use-and-prompt-history)).
- **Test Lab.** A person can ask an external AI to write test cases in the Test Lab's JSON format, paste them in, and
  see how the rules judge each case. The AI writes the cases. The rules give the verdicts. The product never calls a
  model. See [Test Lab](#test-lab-bring-your-own-test-cases).

Why the product stays deterministic: a case decision affects a student's record, so the answer has to be the same on
every run, explainable from a rule and the evidence, and checkable by a person. Details are in
[Why there is no AI inside the product](#why-there-is-no-ai-inside-the-product). The longer argument is in
[docs/ai-position.md](docs/ai-position.md).

## Run it in a container

Only Docker is needed. The compose file starts PostgreSQL 16, the FastAPI backend and the React frontend (served by
nginx).

```powershell
docker compose up --build -d      # starts all three tiers (the first build takes a few minutes)
docker compose ps                 # db, backend and frontend should all show "healthy"
docker compose down               # stops them; data stays in the named volume
docker compose down -v            # stops them and wipes the database (clean reset)
```

| Service | Address |
|---|---|
| Frontend (nginx, React build) | http://localhost:5173 |
| Backend API | http://localhost:8000/api/health |
| PostgreSQL | localhost:5433 (user `integrity`, database `integrity`) |

The frontend waits for the backend to be healthy, and the backend waits for the database. The backend container runs
`python -m integrity.cli bootstrap --scale full` before uvicorn starts, so allow up to two minutes on the first start.
On a fresh clone, bootstrap generates the full dataset itself (seed `20261022`, the same bytes every time) and loads
it into the database. On later starts it finds the data already loaded and keeps it, so `docker compose restart`
never wipes data.

**Reloading.** For a clean, freshly loaded database, run `docker compose down -v` and then
`docker compose up --build -d`. To reload the seed into a running database without removing the volume, run the load
command from a shell where the Python environment is set up (see [Local development setup](#local-development-setup)):

```powershell
.\.venv\Scripts\python -m integrity.cli load --scale full    # localhost:5433 by default
```

`load` drops and recreates the `public` schema, applies `database/schema.sql` and loads `data/full/seed.sql`, so it
also picks up schema changes. Bootstrap does not: it only loads an empty database. **A database created before the
current schema needs either `docker compose down -v` or `cli load`**, otherwise the new tables and triggers are missing.

**Windows build note.** Compose v5 builds through Bake. If `docker compose up --build` fails with a Bake
"additional privileges" error, use the classic builder for that run, which is the fallback named in the header of
`docker-compose.yml`:

```powershell
$env:COMPOSE_BAKE = "false"; docker compose up --build -d
```

## Local development setup

Use this to run the backend and frontend outside containers. PostgreSQL still runs in Docker.

```powershell
# 1. Database (host port 5433)
docker compose up -d db

# 2. Python environment, from the repository root
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.lock
.\.venv\Scripts\python -m pip install -e backend --no-deps

# 3. Generate the full dataset once (writes data/full/, git-ignored), then load it
.\.venv\Scripts\python -m integrity.cli datagen --scale full
.\.venv\Scripts\python -m integrity.cli load --scale full

# 4. Backend (from backend/)
cd backend
..\.venv\Scripts\uvicorn integrity.main:app --reload --port 8000

# 5. Frontend, in a second terminal (from frontend/)
cd frontend
npm install
npm run dev                       # http://localhost:5173, /api is proxied to port 8000
```

`DATABASE_URL` defaults to the compose database in `backend/src/integrity/config.py`
(`postgresql://integrity:integrity_dev@localhost:5433/integrity`), so `cli load` needs no environment variable. The
CORS origins allow `localhost:5173` and `127.0.0.1:5173`. On macOS or Linux, use `.venv/bin/python`, and set
`DATABASE_URL` only when you need a different database.

## Personas and who can do what

There is no login. The frontend sends the acting person's id in an `X-Actor-Id` header. The server checks that the id
is a known staff member (`REV-...`) or a known learner (`LRN-...`) and applies the role rules. A persona switcher in
the header sets that id. Five seeded personas cover the roles that drive the workflow:

| Persona | Seeded id | Role | Typical work |
|---|---|---|---|
| Vik Silva | REV-000001 | academic_administrator | Assigns reviewers and appeal reviewers, closes cases, reads the workload view, imports Test Lab cases |
| Sam Gupta | REV-000007 | support_staff | Adds the learner's statement as evidence, files appeals |
| Ben Novak | REV-000018 | instructor | Decides cases assigned to him |
| Tara Abara | REV-000048 | academic_reviewer | Decides assigned cases, decides appeals assigned to her |
| Ivan Lopez | LRN-001502 | learner | Sees only his own cases, adds a statement, files an appeal |

The frontend falls back to REV-000011 when nothing is stored. The server decides what is allowed; the UI only
shows the same verdicts (`action_checks` returns each action with its reasons).

| Action | Academic administrator | Support staff | Reviewer (instructor or academic reviewer) | Learner (own case only) |
|---|---|---|---|---|
| Assign reviewer (case open or under review) | Yes | No | No | No |
| Add evidence (case open or under review) | No | Yes, learner's statement only | Yes, if assigned | Yes, learner's statement only |
| Reopen a decided case | Yes | No | Yes, if assigned | No |
| Record a decision (case under review) | No | No | Yes, if assigned. Needs a rationale and cited evidence from this case. A Fail (violation confirmed) also needs a rationale of at least 20 characters and a cited matched passage or source reference | No |
| Step aside (recuse) from a case under review | No | No | Yes, if assigned. A reason is required and is kept in the history; the status does not change | No |
| File an appeal (decided case with a confirmed violation, within the appeal window, once) | Yes | Yes | No | Yes |
| Assign an appeal reviewer (must be independent; an administrator may reassign to a different independent reviewer) | Yes | No | No | No |
| Decide an appeal | No | No | Yes, only the assigned appeal reviewer | No |
| Close a case | Yes. Cleared or inconclusive: at once. Confirmed violation: after the window ends, after the appeal is decided, or early with a recorded waiver (reason required). Never while an appeal is open | No | No | No |

The appeal window is 14 days from the latest decision (`appeal_window_days` on the rule). A learner acts only on
their own case, and learner ids pass through the same header and rule checks as staff ids.

Source: `backend/src/integrity/rules/lifecycle.py` (`TRANSITIONS`, `_ROLES`, `_specific_reasons`) and
`backend/src/integrity/rules/conflicts.py`. Not modelled: a separate platform administrator role. Administrators are
academic administrators only.

## Pages at a glance

| Page | Route | Who sees it | What it is for |
|---|---|---|---|
| Overview | `/` | All | Dataset volume and a summary of the case queue |
| Guide | `/guide` | All | Plain-language explanation of flags, cases, who acts when, fairness rules and a glossary |
| Cases | `/cases` | All (learners: own cases) | The case queue, with tabs (see below) |
| Case detail | `/cases/:id` | All (learners: own cases) | Similarity strip, fairness gates, evidence, a stage rail with the next actionable step, an activity log with outcome chips, and the actions the rules allow |
| Test Lab | `/lab` | Staff | Run test cases through the rules and see pass, fail or no-expectation per case. Administrators can import cases into the workflow |
| Audit | `/audit` | Staff | Live auditor findings (each linked to its case), auditor accuracy and the validation summary |
| Rules | `/rules` | All | Rule versions with their thresholds and effective dates |
| Administration | `/admin` | Academic administrators | Workload per staff member, KPI cards, and flagged cases that need a reviewer |

Cases tabs (`/cases?tab=...`): **Needs you** (the default: cases that need the signed-in person's action),
**All cases**, **Unassigned** (open, no reviewer), **Under review**, **Awaiting appeal** (appealed or in appeal review),
**Decided**, **Closed**, and **Dismissed flags** (a read-only list of flags closed automatically because quoted or
template text explains the overlap; no case is opened and nothing is recorded against the learner).

## Results at a glance

Full dataset (seed `20261022`). Numbers are from `data/full/manifest.json`, `data/full/validation.json`,
`data/full/validation_summary.md` and `data/full/metrics.json`.

| Measure | Value |
|---|---|
| Submissions and similarity reports | 10,000 and 10,000 (one report per submission) |
| Learners, assessments | 2,000 and 151 |
| Flags (raw score at or above 0.60) | 1,000 |
| Cases opened (adjusted score at or above 0.60) | 300: 234 `review`, 66 `priority_review` |
| Auto-dismissed flags | 700: 375 `quote_only`, 325 `template_match` |
| Staff | 64: 6 academic administrators, 10 support staff, 24 academic reviewers, 24 instructors |
| Case status | 69 open, 92 under review, 43 decided, 9 appealed, 9 in appeal review, 9 appeal decided, 69 closed |
| Decisions recorded | 147: 111 `violation_confirmed`, 26 `no_violation`, 10 `inconclusive` |
| Appeals | 45: 18 pending, 17 upheld, 6 partially upheld, 4 overturned |
| Validation | 0 violations, `result: PASS` in `validation_summary.md`. The number of checks is in [How we know it works](#how-we-know-it-works) |
| Auditor | 4 issue types, 32 planted issues found, precision 1.0, recall 1.0, F1 1.0 (partly circular, see Known limits) |
| Reproducibility | Same seed gives the same hash: `dataset_hash` `750df00c4691...`, SHA-256 per file in `data/full/manifest.json` |

Triage on the planted scenarios (`data/full/metrics.json`, `triage`):

| Scenario | Flagged | Auto-dismissed | Cases opened |
|---|---|---|---|
| clean | 0 | 0 | 0 |
| legitimate_quote | 360 | 360 | 0 |
| shared_template | 310 | 310 | 0 |
| false_positive | 90 | 0 | 90 |
| genuine_copy | 240 | 30 | 210 |

Honest miss: of the 280 genuine copies, 70 are not opened as cases. 30 are auto-dismissed because quoted or template
text explains the overlap, and 40 never reach the flag gate (raw score below 0.60). `metrics.json` records those 40 as
`not_flagged`.

## Units and basic terms

| Term | Meaning here |
|---|---|
| Similarity report | One per submission: `raw_score`, `quoted_score`, `template_score`, the rule used, and the adjusted score |
| Raw score | Overlap between a submission and other text, as a fraction from 0 to 1 |
| Adjusted score | `raw - quoted - template`. Quoted material and shared template text are excluded |
| Gates (rule v1) | Log at 0.30, review at 0.60, priority at 0.80 (`data/starter/integrity_rule.csv`) |
| Gates (rule v2) | Same, except priority at 0.85; in force from 2026-06-01 |
| Flag | A raw score at or above the review gate. A flag asks for a look, nothing more |
| Band | `no_action`, `log_only`, `review`, `priority_review`. The lower edge of each band is inclusive |
| Case | Opened for a flag whose adjusted score is in `review` or `priority_review` |
| Dismissal reason | Why a flag did not open a case: `quote_only` or `template_match` (the larger exclusion) |
| Decision outcome | `violation_confirmed` (Fail), `no_violation` (Clear) or `inconclusive`, with a rationale and cited evidence |
| Recusal | A reviewer steps aside from a case under review. Logged with a reason; the case stays under review |
| Waiver | An administrator closes a confirmed violation before its appeal window ends, with a recorded reason |
| Appeal window | 14 days from the latest decision (`appeal_window_days` on the rule) |
| Appeal outcome | `upheld`, `partially_upheld` or `overturned` |
| Case status | `open`, `under_review`, `decided`, `appealed`, `appeal_review`, `appeal_decided`, `closed` |
| Event ledger | `case_event`: every status change, assignment, evidence item, decision, recusal and appeal, with actor and time. Insert-only (triggers block update and delete) |

## Generate data

```powershell
python -m integrity.cli datagen --scale full      # data/full/ and data/ground_truth/full/ (bulk files git-ignored)
python -m integrity.cli datagen --scale starter   # data/starter/ and data/ground_truth/starter/ (committed)
python -m integrity.cli repro --scale full        # builds twice in temp folders and compares every file
python -m integrity.cli bootstrap --scale full    # what the container runs: generate if missing, load if empty
```

Run these from an environment where `integrity` is installed (`pip install -e backend --no-deps`).

Each scale folder holds CSV and JSON for the tables, `seed.sql` (loaded into PostgreSQL), `manifest.json` with SHA-256
per file, and the validation and metrics outputs. The answer key lives in a separate `data/ground_truth/` folder.

After a load, the checks and evaluation are run with:

```powershell
python -m integrity.cli validate --scale full     # runs every check; writes validation.json and validation_summary.md; exits 1 on violations
python -m integrity.cli audit                     # prints auditor findings (reads the database)
python -m integrity.cli eval --scale full         # writes metrics.json: auditor and triage scenarios
```

Decision 0009 records the policy: the starter dataset is committed, and full-scale bulk files are regenerated from the
seed.

## How the workflow decides

**1. Triage (per similarity report).** Implemented in `backend/src/integrity/rules/triage.py`.

1. If the raw score is below the review gate (0.60), the report is not a flag. No case, no reviewer.
2. Otherwise compute the adjusted score: raw minus quoted minus template.
3. If the adjusted band is `review` or `priority_review`, open a case.
4. Otherwise dismiss the flag with the larger exclusion as the reason (`quote_only` on a tie).

Every step is explained in plain language by `explain_triage`, which the Test Lab shows.

**2. Case lifecycle.** The lifecycle is written in `TRANSITIONS` in `rules/lifecycle.py`. `validation/checks.py` keeps a
hand-copied SQL list of legal event pairs. The `transition_table_matches` and `lifecycle_replay` checks compare that
list and the event history with `TRANSITIONS` (`validation/replay.py`).

```
open --assign reviewer--> under_review --record decision--> decided --close--> closed
                               ^                              |
                               +-------- reopen --------------+
under_review --recuse (no status change)--> under_review
decided --file appeal--> appealed --assign appeal reviewer--> appeal_review
appeal_review --decide appeal--> appeal_decided --close--> closed
```

**3. Due process.**

- A decision needs a written rationale and at least one piece of this case's evidence. A Fail also needs a rationale of
  at least 20 characters and a cited matched passage or source reference. A quote, a template or a learner statement
  alone cannot support a Fail.
- Evidence cannot be added to a decided case; a reviewer must reopen it first, so the history stays.
- Only a confirmed violation can be appealed, once, within the appeal window (14 days under the current rule), by
  support staff, an administrator or the learner.
- The appeal reviewer must be independent: not the person who decided the case and with no conflict. An administrator
  can reassign the appeal to someone else.
- A case cannot be closed while its appeal is open. A cleared or inconclusive decision can be closed at once. A
  confirmed violation waits for the appeal window to end, or for an administrator to close it early with a recorded
  waiver.

**4. Reviewer conflicts.** `conflicts.py` blocks an assignment when the candidate cannot review (wrong role), taught the
assessment, works in the learner's department, has reviewed this learner before, or is already on the case.

**5. Audit.** `backend/src/integrity/auditor/` checks the ledger for four issue types: an automatic guilt finding without
review, a reviewer conflict, evidence added after a decision without reopening, and an appeal closed without independent
review.

## How we know it works

`cli validate` runs its checks in four groups. Each group reports violations, and the run passes only when all are zero.

| Group | Count (with `--scale`) | What it covers | Where |
|---|---|---|---|
| SQL checks | 17 | Keys, joins, rule in force, triage reconciliation (a case exists exactly for review and priority bands), date order, legal transitions, event references, duplicate evidence, recusals | `backend/src/integrity/validation/checks.py` |
| Sanity guards | 3 | Core tables are not empty; row counts match the manifest (static tables exactly, appendable tables as a floor); each id format is matched by some row | `validation/sanity.py` |
| Replay | 2 | Every event is legal at the status the case had; the SQL transition table equals `TRANSITIONS` | `validation/replay.py` |
| Agreement | 2 | Python triage with each report's rule matches the `v_flag` view; reviewer conflicts agree across three derivations | `validation/agreement.py` |

That is 24 checks in total. The sanity guards exist because row checks pass on an empty database: a check that finds
no rows reports zero violations, so the guards fail first when the database is empty or the wrong size.

The reviewer agreement check compares the Python conflict rules, the auditor's SQL and an independent SQL recount. It
shows that the three implementations flag the same assignments. It does not show that any of them is right.

**Stale output.** The validation files in the working tree (`data/full/validation.json` and
`validation_summary.md`) were written by an earlier run. They list 19 checks and do not include the sanity guards or
the recusal checks. Run `python -m integrity.cli validate --scale full` after a load to regenerate them.

| Check | What it proves | Where |
|---|---|---|
| Validation (above) | Structure, rule, lifecycle and triage consistency on the loaded data | `cli validate`; `data/full/validation.json` |
| Auditor against planted issues | The auditor finds the 32 planted issues, no more and no fewer | `cli eval`; `data/full/metrics.json` (`auditor`) |
| Triage scenarios | Each planted scenario lands in the expected band and dismissal | `data/full/metrics.json` (`triage`) |
| Unit, API and integration tests | Lifecycle guards, triage bands and boundaries, endpoints, error envelope, schema, validation, auditor | `backend/tests/` |
| Ground truth is separate | Application code, validator and auditor never read `data/ground_truth/` | `backend/tests/unit/test_no_ground_truth_leak.py` |
| Reproducibility | Two builds of the same seed are identical | `cli repro`; `manifest.json` SHA-256 values |
| End-to-end UI | Running stack, layout, forms and the lifecycle in a browser | `e2e/tests/` (Playwright) |

The auditor F1 of 1.0 is partly circular: the planted labels and the auditor use the same documented rules. It shows the
rules are applied consistently, not that they find real misconduct.

## Realism and calibration

The dataset is synthetic and nothing is fitted to real academic records. The score gates (0.30, 0.60, 0.80, and 0.85
in rule v2) and the 14-day appeal window are hand-chosen rule constants under test, not outputs of a model. The
generator builds exact quotas per scenario (`backend/src/integrity/datagen/scale.py`), so the score spread is designed,
not observed. `data/full/validation_summary.md` shows the resulting distributions and boundary scores.

## Where to verify the review points

| Point | Evidence |
|---|---|
| a. Distributions | `data/full/validation_summary.md` (distributions section); `flags_by_band`, `flag_outcomes`, `cases_by_status` in `data/full/validation.json` |
| b. IDs and joins | Validation checks `id_sequences`, `report_per_submission`, `event_references`; `backend/tests/unit/test_ids.py` |
| c. Lifecycle | Checks `transition_pairs`, `transition_chain`, `lifecycle_replay`, `transition_table_matches`; `rules/lifecycle.py` (`TRANSITIONS`); `backend/tests/unit/test_rules_lifecycle.py` |
| d. Derived values | `triage.py` (`Scores.adjusted`, `explain_triage` gives the step-by-step explanation shown by the Test Lab) |
| e. Normal, boundary, failure, exception | Triage scenarios and the boundary distribution (scores at 0.299, 0.300, 0.599, 0.600, 0.799, 0.800); `backend/tests/unit/test_rules_triage.py` |
| f. Ground truth separate | `data/ground_truth/` outside the operational tables; `test_no_ground_truth_leak.py` |
| g. Reproducibility and provenance | `cli repro --scale full`; `data/full/manifest.json` (SHA-256 of each table file); `data/full/validation.json` `dataset_hash` |

## Assumptions we made explicit

- The current rule is the one whose `effective_to` is empty. A report is judged by the rule in force on its submission
  date (check `rule_in_force`).
- Rule v2 raises only the priority gate, from 0.80 to 0.85. Its effective date is 2026-06-01.
- A violation can be appealed once and only within the appeal window (14 days under the current rule), by the learner,
  support staff or an administrator. A case cannot be closed while an appeal is open. Cleared and inconclusive cases
  close at once; a confirmed violation waits for the window or a recorded waiver.
- Learners are actors: a learner id in the header sees and acts only on their own case, and can add a statement and
  file an appeal. A platform administrator is not modelled; administrators are academic administrators.
- The Test Lab run stores nothing, and its verdicts come from the same rules as the case workflow. The Test Lab import
  is different: an administrator's import writes submissions, reports, cases and evidence to the database, in one
  transaction.
- Seeded personas are for local use. Identities are not authenticated.

## Architecture

```mermaid
flowchart LR
  subgraph Build["Dataset build (CLI, offline)"]
    G[datagen: seed, quotas, planted cases] --> D[data/full CSV, SQL, manifest]
    G --> T[data/ground_truth: answer key]
  end
  subgraph Run["Running system"]
    UI[React frontend] -- "HTTP JSON, X-Actor-Id" --> API[FastAPI routers]
    API --> SVC[services: transactions, FOR UPDATE]
    SVC --> RULES[rules: pure functions]
    SVC --> DB[(PostgreSQL 16: tables, views, append-only triggers)]
  end
  D -- "cli load" --> DB
  T -. "scoring only" .-> EVAL[validate, audit, eval]
  DB --> EVAL
```

## Design trade-offs

| Decision | Chosen | Alternative | Why | Cost |
|---|---|---|---|---|
| Decision logic | Deterministic rules | A model decides | Same answer each run, explainable, testable against planted cases | Cannot read free text (see AI section) |
| Architecture | React, FastAPI, PostgreSQL in three tiers | One app, or SQLite | Clear boundaries, real transactions and triggers ([0001](docs/decisions/0001-three-tier-architecture.md), [0002](docs/decisions/0002-postgresql-over-sqlite.md)) | Three services to run; Docker or a local database needed |
| Where rules live | Structural rules in the database, business rules in code | All in the database | Business rules are testable without a database ([0004](docs/decisions/0004-where-rules-are-enforced.md)) | Two places to keep consistent: the SQL check copy and `TRANSITIONS`; the replay and transition checks compare them on every `validate` |
| Identity | Staff or learner id in a request header | Real login | Keeps the assignment small; personas can be switched in the UI | No authentication; not safe on a network |
| Test Lab | Run is stateless and uses the same rules; import is admin-only and writes to the workflow | Separate sandbox store | Run cannot change case data; import is the only path that creates records from test cases | Run results are not saved; imported cases are real records in the database |
| Generated data | Seeded generator, bulk files regenerated | Commit all data | Small repository, provable reproduction ([0009](docs/decisions/0009-generated-data-and-loading.md)) | Full dataset needs a generation step first |

## Security and governance

- **No authentication.** The acting person is named by the `X-Actor-Id` header and checked against the reviewer table
  (staff) or the learner table (learners). An unknown id gets 401. Anyone who can reach the API can act as any seeded
  person. The stack is for local or assessment use only.
- **Server-side rules.** Role and state checks run in the backend. The frontend hides actions the server would refuse,
  but a refused request is still refused.
- **Concurrency.** Write services lock the case row (`SELECT ... FOR UPDATE`) inside one transaction.
- **Append-only history.** `case_event` is protected by triggers. Corrections are new events.
- **CORS** allows only `localhost:5173` and `127.0.0.1:5173` by default (`cors_origins` in `config.py`).
- **Secrets.** The compose and `.env.example` values are local development defaults for the database. Do not reuse them.
- **No personal data.** Names, ids and texts are generated.

## Interfaces

All routes are under `/api`. Errors use one envelope: `{"error": {"code", "message", "details"}}`. The contract is in
[docs/api-contract.md](docs/api-contract.md) (v1.3). The endpoints below are the ones the code registers today; the
contract document does not yet list every addition.

| Method and path | Purpose |
|---|---|
| GET `/api/health` | Health check |
| GET `/api/reviewers` | Staff list (no header needed; the persona switcher uses it) |
| GET `/api/actors?role=learner\|staff&q=&limit=` | Search learners or staff by id, name or department (no header needed) |
| GET `/api/rules` | Rule versions |
| GET `/api/queue`, GET `/api/flags` | Case queue (tabs are server filters) and flags |
| GET `/api/cases/{id}`, GET `/api/cases/{id}/timeline` | Case detail with `allowed_actions` and `action_checks`; the event ledger |
| GET `/api/cases/{id}/eligible-reviewers` | Candidates with conflict reasons |
| POST `/api/cases/{id}/reviewers`, `/evidence`, `/reopen`, `/decision` | Assign reviewer, add evidence, reopen, record decision |
| POST `/api/cases/{id}/recuse` | Assigned reviewer steps aside; body `{"reason"}` (required) |
| POST `/api/cases/{id}/appeal`, `/appeal/reviewer`, `/appeal/outcome` | File appeal, assign appeal reviewer, decide appeal |
| POST `/api/cases/{id}/close` | Close. The body is optional. `{"waive_appeal_window": true, "reason": "..."}` closes a confirmed violation early (administrator; reason required) |
| GET `/api/admin/workload` | Staff workload, totals and suggested reviewers for unassigned cases (administrator only) |
| GET `/api/audit/findings`, `/api/audit/metrics`, `/api/audit/validation` | Auditor findings, evaluation metrics, validation results |
| POST `/api/lab/run` | Test Lab: judge 1 to 200 test cases with the current rule (stateless) |
| POST `/api/lab/import` | Test Lab import: create submissions and reports and, for cases that open, cases and evidence (administrator only; 1 to 100 cases, one transaction) |

Status codes: 401 `UNKNOWN_ACTOR`, 403 `ROLE_NOT_ALLOWED` and `NOT_YOUR_CASE`, 404 `NOT_FOUND`, 422 `VALIDATION_ERROR`
(with a `problems` list; also used for a candidate whose role cannot review at all), 409 for any other refused rule
(the first reason becomes the code).

## Test Lab: bring your own test cases

The Test Lab checks whether the rules behave the way you expect, using cases you write or get from an external AI.

1. Open the Test Lab and copy the prompt. It describes the case format and asks for cases in JSON.
2. Give the prompt to any AI tool, then paste its JSON back into the editor. You can also pick one of the 12 example
   packs (plain data in `frontend/src/lib/labPacks*.ts`) or the generated "Everything" pack, and append it.
3. Run. The frontend sends `POST /api/lab/run` with `{"cases": [...]}` (1 to 200 cases).
4. Read the results: for each case, the triage band and dismissal reason, the adjusted score with its steps, the
   reviewer, appeal-reviewer, decision and late-evidence checks, and a pass, fail or no-expectation verdict against
   any `expect` you wrote.
5. Optional, administrators only: **Import into the workflow** sends the cases to `POST /api/lab/import`. Cases that open
   become real cases with their evidence and timeline. Dismissed flags and non-flags keep a submission and report only.
   The import is all or nothing.

Case fields: `id`, `title`, `scores` (`raw`, `quoted`, `template`, each 0 to 1), and optional `reviewer`,
`appeal_reviewer`, `decision`, `late_evidence`, `evidence` (up to 6 items) and `expect`. Unknown fields are refused.
Import also accepts optional `learner_id` and `assessment_id` in their id formats.

The example packs cover triage boundaries and exclusions, reviewer conflicts, appeal independence, decisions and their
guards, history that is not overwritten, and combined journeys. Their `expect` values were computed with the backend
rules, not written by hand. The run endpoint never writes. The API and the page run the same functions the workflow
uses, so a failure is a real rule outcome, not a mock.

## Development and checks

Quality checks run at checkpoints (before a merge), not after each edit. CI (`.github/workflows/ci.yml`) runs the same
commands.

```powershell
# from the repository root
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m ruff format --check .

# backend (unit tests need nothing; integration and API tests need the database on localhost:5433)
cd backend
..\.venv\Scripts\python -m mypy
..\.venv\Scripts\python -m pytest --cov=integrity --cov-report=term-missing

# frontend
cd ..\frontend
npm run lint; npm run typecheck; npm test; npm run build

# end-to-end, against the running stack (docker compose up -d)
cd ..\e2e
npx playwright test
```

Notes:

- `ruff.toml` excludes the template directory, so run ruff from the repository root only.
- **Backend tests and parallel runs.** The database tests build a throwaway schema per pytest process, named
  `scratch_<pid>` (with a worker suffix under pytest-xdist), and roll it back. Two pytest processes can therefore use
  the same database at once. pytest-xdist is not in `backend/requirements.lock`, so parallelism today means running
  separate pytest processes. The backend suite collects 184 tests.
- **Frontend tests** use Vitest (`npm test` runs `vitest run`; 89 test cases).
- **End-to-end tests** are Playwright specs in `e2e/tests/` (seven files, 35 tests). They need the stack on ports 5173
  and 8000 (`docker compose up -d`). [e2e/README.md](e2e/README.md) has the same commands.
- Screenshots for visual review: `cd e2e` then `npx playwright test tests/screens.spec.ts` writes `e2e/results/screens/`.

## AI use and prompt history

- The build used Claude Code agents for planning and implementation. Human decisions are recorded in the
  decision log ([docs/decisions/](docs/decisions/README.md)) and the status files in `docs/status/`.
- `prompts/export_prompts.py` exports the human prompts from the local Claude Code session transcripts to
  [prompts/prompts.md](prompts/prompts.md). It reads local files only and calls no model. Run it with
  `python prompts/export_prompts.py` (add `--latest` for the newest session only).
- The exported log may contain private context from the working sessions; review it before sharing.

## Why there is no AI inside the product

Every outcome that touches a learner's record is set by a plain, versioned rule. We keep it that way for five reasons:

- **Due process:** a finding must come with a reason a person can read and contest.
- **Reproducibility:** same seed, byte-identical data (sha256); same input, same triage (`python -m integrity.cli repro`).
- **Evaluation:** an LLM judge would grade the product with the same kind of process it checks, so it would be circular.
- **Harm:** a wrong automated outcome lands on the learner, so ambiguity goes to a human and exclusions favour the learner.
- **Privacy:** learner work and identities do not leave the system.

AI still helps: Claude Code agents build the product, and the Test Lab lets an external model propose test cases that the
stateless rules judge (admin-only import, human review only). Details: [one-pager](docs/ai-defense-onepager.md) and
[AI position](docs/ai-position.md).

## Known limits (stated, not hidden)

- **Synthetic data.** The scores show that the rules cover the planted scenarios. They do not show how the rules would
  perform on real submissions or generalise to other institutions.
- **Circular evaluation.** The auditor and the planted labels share the same documented rules, so F1 of 1.0 is partly
  a consistency check.
- **Triage misses.** 70 of 280 genuine copies are not opened as cases: 40 never reach the flag gate (raw score below
  0.60) and 30 are auto-dismissed because quoted or template text explains the overlap. This is the cost of the
  exclusion rules.
- **Few appeals.** The dataset has 45 appeals, a small sample for judging the appeal path.
- **Scenario quotas.** Appeals and multi-reviewer cases exist in the data but have no scenario quota in `metrics.json`.
  Requirement F4 is therefore PARTIAL (see [docs/requirements.md](docs/requirements.md)).
- **No AI in the product.** The Test Lab gives a person a way to test the rules with AI-written cases; the product never
  makes a judgement with a model.
- **Decision quality is not judged.** The decision guard requires a rationale and cited evidence from this case. It does
  not check whether the rationale is good. Recusal and waiver reasons are recorded but not reviewed.
- **Appeal reassignment.** An administrator can reassign an appeal reviewer, as long as the new reviewer is independent
  and different from the current one.
- **Actors.** Learners act on their own cases through their id. A platform administrator is not modelled.
- **Identity.** No sign-in. The `X-Actor-Id` header is trusted in local use. Read endpoints are open to every known
  staff member, and learners see only their own cases. `/api/reviewers` and `/api/actors` need no header at all.
- **Test Lab import writes data.** Only the run endpoint is stateless. An administrator's import creates real
  submissions, reports, cases and evidence in the database.
- **Validation output is stale in the working tree.** `data/full/validation.json` lists 19 checks from an earlier run;
  the code runs 24 with `--scale`. Regenerate it with `cli validate --scale full`.
- **Reviewer check is an agreement check.** It shows that three implementations of the conflict rules agree. It does
  not show that they are correct.
- **Manifest coverage.** Ground-truth files are not in the manifest hash list. Bulk files in `data/full/` are git-ignored
  and must be regenerated from the seed.

## Repository map

| Path | Contents |
|---|---|
| `backend/` | FastAPI app (`src/integrity/`), rules, services, datagen, validation, auditor, tests, Dockerfile |
| `frontend/` | React, Vite, Tailwind, Radix UI, TanStack Query, Recharts; Dockerfile and nginx config |
| `database/` | `schema.sql` (tables, views, triggers) and notes |
| `data/` | `starter/` (committed), `full/` (outputs and manifest committed, bulk files regenerated), `ground_truth/` |
| `e2e/` | Playwright end-to-end tests and their [README](e2e/README.md) |
| `docs/` | Index in [docs/README.md](docs/README.md); decision log; API contract; requirements matrix; plans and status |
| `prompts/` | Exported prompt log and the export script |
| `.github/workflows/ci.yml` | CI: frontend lint, typecheck, tests, build; backend ruff, mypy, pytest with PostgreSQL |
| `docker-compose.yml` | Three services: database, backend, frontend |

Governance: [docs/decisions/](docs/decisions/README.md) (twelve records, with the reasoning behind each choice),
[docs/requirements.md](docs/requirements.md) (requirement matrix with statuses and proof),
[docs/engineering-guidelines.md](docs/engineering-guidelines.md). Licensed under the MIT License (see [LICENSE](LICENSE)).
