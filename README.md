# Integrity Desk: Academic Integrity Due-Process Workflow

Integrity Desk is a three-tier academic integrity management system designed for similarity flag triage, evidence collation, conflict-free reviewer assignment, append-only audit timelines, and due-process appeals.

**Core Philosophy**: A similarity score is purely investigative evidence. It triggers **human review, never automatic guilt**. Every case decision and appeal outcome is governed strictly by deterministic rules and preserved in an immutable, append-only event ledger.

---

## 🏛️ Architecture Overview

```
React (Vite)  ──HTTP/JSON──▶  FastAPI Service  ──SQL──▶  PostgreSQL 16
  frontend/                     backend/src/integrity      docker-compose.yml, database/
```

| Layer | Technology | Key Responsibilities |
|---|---|---|
| **Frontend** | React 18, Vite, Radix UI, TanStack Query | Single-page UI with actor switcher, similarity strip, fairness gates, action dialogs from `action_checks`, and live Audit dashboard. |
| **Backend** | FastAPI, Pydantic v2, Psycopg 3 | Pure business rules (`rules.py`), `SELECT ... FOR UPDATE` transactional concurrency, frozen API contract (v1.3), deterministic dataset generator & evaluation. |
| **Database** | PostgreSQL 16 (Docker) | 13 normalized tables, generated `adjusted_score`, views (`v_case_status`, `v_flag`, `v_case_queue`), and append-only audit triggers on `case_event`. |

---

## ⚡ Quick Start

### Prerequisites
* Docker Desktop
* Python 3.12 (venv at `.venv`)
* Node.js 22

### 1. Launch PostgreSQL Container
```powershell
docker compose up -d db
```
*PostgreSQL 16 runs on `localhost:5433` (databases: `integrity`, `integrity_api`, `integrity_dbtab`).*

### 2. Backend Setup & Demo Database Initialization
```powershell
# Set up Python environment
.\.venv\Scripts\python -m pip install -r backend/requirements.lock
.\.venv\Scripts\python -m pip install -e backend --no-deps

# Load the demo database with full synthetic data
$env:DATABASE_URL="postgresql://integrity:integrity_dev@localhost:5433/integrity"
.\.venv\Scripts\python -m integrity.cli load --scale full

# Start the FastAPI backend
cd backend
..\.venv\Scripts\uvicorn integrity.main:app --port 8000
```
API health: `http://localhost:8000/api/health`

### 3. Frontend Setup
```powershell
# In a separate terminal
cd frontend
npm install
npm run dev
```
Open UI: **`http://localhost:5173`** (proxies `/api` requests to backend at `:8000`).

---

## 📐 How It Works: The Integrity Rule

1. **Similarity Flag vs. Case**:
   A submission generates a similarity report with raw similarity, quoted material, and template match scores. A **Flag** is created whenever `raw_score >= review_threshold` (0.30 in Rule v1; 0.35 in Rule v2).
   $$\text{adjusted\_score} = \text{raw\_score} - \text{quoted\_score} - \text{template\_score}$$
2. **Review Triage**:
   A formal **Case** opens only if the $\text{adjusted\_score}$ reaches the review threshold ($\ge 0.60$ for `review`, $\ge 0.80$ for `priority_review`). Otherwise, the flag is **auto-dismissed** with reason `quote_only` or `template_match` (the larger exclusion; ties go to `quote_only`). In the full dataset of 1,000 flags, exactly **700 flags are auto-dismissed**, saving reviewer effort while strictly protecting learners.
3. **Four Negative Scenarios (Fairness Gates)**:
   * **G1: Auto-Guilt Without Human Review**: Violation confirmed without an assigned human reviewer (prevented by API; detected by auditor).
   * **G2: Reviewer Conflict of Interest**: Assignment of an instructor of the course, a reviewer in the learner's department, or a reviewer who previously assessed the learner (blocked with `409 CONFLICT_OF_INTEREST`).
   * **G3: Post-Decision Evidence Without History**: Adding evidence after a decision without formal reopening is refused (`409 REOPEN_REQUIRED`).
   * **G4: Non-Independent Appeal Review**: The original reviewer or anyone previously involved in the case cannot review an appeal (`409 NOT_INDEPENDENT`), and cases cannot close with pending appeals (`409 APPEAL_UNRESOLVED`).

---

## 📦 Synthetic Dataset Deliverables

The repository includes a complete, deterministic, ground-truth-labelled synthetic dataset generated with fixed seed **`20261022`**:
* **Volume**: 10,000 submissions, 1,000 similarity flags, and 300 formal cases.
* **Commands**:
  ```powershell
  python -m integrity.cli datagen --scale full    # Generates full dataset
  python -m integrity.cli load --scale full       # Applies schema and loads seed.sql
  python -m integrity.cli validate --scale full   # Runs 15 structural validation checks
  python -m integrity.cli audit --scale full      # Runs independent due-process auditor
  python -m integrity.cli eval --scale full       # Computes precision/recall/F1 metrics
  python -m integrity.cli repro --scale full      # Proves byte-identical reproducibility
  ```
* **Dataset Artifacts**:
  * Data Dictionary: **[docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md)**
  * Full Manifest & SHA-256 Hashes: **[data/full/manifest.json](data/full/manifest.json)**
  * Validation Summary (15/15 Passed, 0 Violations): **[data/full/validation_summary.md](data/full/validation_summary.md)**
  * Evaluation Metrics: **[data/full/metrics.json](data/full/metrics.json)**

---

## 📊 Evaluation & Anomaly Detection Performance

The independent due-process auditor (`integrity.auditor`), which operates with zero access to ground truth, achieves **100% precision and recall** across all injected anomalies while ignoring all legitimate near-miss decoys:

| Anomaly Type | Injected Count | Detected (TP) | False Alarms (FP) | Precision | Recall | F1 Score |
|---|---|---|---|---|---|---|
| **G1: Auto-Guilt** | 8 | 8 | 0 | **1.000** | **1.000** | **1.000** |
| **G2: Reviewer Conflict** | 10 | 10 | 0 | **1.000** | **1.000** | **1.000** |
| **G3: Evidence After Decision** | 8 | 8 | 0 | **1.000** | **1.000** | **1.000** |
| **G4: Appeal Independence** | 6 | 6 | 0 | **1.000** | **1.000** | **1.000** |
| **Total Findings** | **32** | **32** | **0** | **1.000** | **1.000** | **1.000** |

### Latent Scenario vs. Triage Matrix
* **Legitimate Quote** (360 submissions): 360 Auto-dismissed (100%)
* **Shared Template** (310 submissions): 310 Auto-dismissed (100%)
* **False Positive** (90 submissions): 90 Cases opened for human review (0 dismissed)
* **Genuine Copy** (240 submissions): 210 Cases opened, 30 below adjusted threshold dismissed

---

## 🔍 Quality & Verification Checks

Run quality gates from the repository root:
```powershell
# Code style and formatting
.\.venv\Scripts\ruff check .
.\.venv\Scripts\ruff format --check .

# Static type verification (mypy strict)
Set-Location backend; ..\.venv\Scripts\mypy src

# Backend test suite (89 unit & integration tests)
Set-Location backend; ..\.venv\Scripts\pytest -v

# Frontend tests & production build
Set-Location frontend
npm run lint
npm run typecheck
npm test
npm run build
```

---

## ⚠️ Stated Design Limits & Assumptions

1. **Synthetic Data Coverage**: Synthetic similarity scores and scenario quotas prove deterministic rule coverage, boundary conditions, and detector accuracy. They are not intended as predictive machine-learning models.
2. **Actor Authentication**: The `X-Actor-Id` header is an authentication stub designed for demonstration and actor switching in the UI. In production, this would be replaced by an OAuth2/OIDC JWT session.
3. **No Reviewer Removal**: Once assigned, a reviewer remains on the case record for historical auditability; unassignment is not permitted.
4. **Appeal Window Duration**: The legal appeal window is 14 days. Cases decided during a live session cannot be closed immediately without simulating the passage of time (seeded older cases can be closed).
5. **AI Statement**: An optional local LLM case-brief component was evaluated but omitted by design per the scope agreement to ensure 100% deterministic, reproducible, and verifiable due process.

---

## 🎬 5-Minute Live Demo Script
For a step-by-step walkthrough of all five demo beats with **pinned case IDs**, see **[docs/DEMO.md](docs/DEMO.md)**.
