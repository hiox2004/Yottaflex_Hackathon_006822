# Demo Script: Integrity Desk (5 Minutes)

This script walks through the **five core beats** of the academic-integrity due-process workflow using the live application and **pinned case IDs** from the seeded full dataset (`seed: 20261022`).

---

## Prerequisites for the Demo
1. **Database & API running**:
   ```powershell
   docker compose up -d db
   $env:DATABASE_URL="postgresql://integrity:integrity_dev@localhost:5433/integrity"
   python -m integrity.cli load --scale full
   cd backend; ..\.venv\Scripts\uvicorn integrity.main:app --port 8000
   ```
2. **Frontend running**:
   ```powershell
   cd frontend; npm run dev
   ```
3. Open browser at **`http://localhost:5173`**.

---

## Beat 1: Reviewer Due Process & Reasoned Decision (60s)
* **Goal**: Show that similarity flags trigger human review, not automated guilt, and decisions require evidence-backed rationale.
* **Actor Picker**: Select **Vik Silva (`REV-000001`, Academic Administrator)** or **Tara Abara (`REV-000049`, Academic Reviewer)**.
* **Action**:
  1. Go to **Queue** (`/queue`). Notice the count tiles: `Needs you`, `Under review`, `Awaiting appeal`, `Decided`, `Closed`, and `700 Auto-dismissed flags`.
  2. Open case **`CAS-2026-000300`** (Learner: Kofi Lopez, Assessment: HIS-077 Project).
  3. Observe:
     - **Similarity Strip**: Raw score `0.781`, Quoted exclusion `-0.012`, Template match `-0.095` -> Adjusted score `0.674` (Band: `review`).
     - **Fairness Gates**: Clean green indicators showing no conflict of interest and human review required.
     - Toggle **"Show the engine"** to view the step-by-step triage explanation and rule evaluation.
  4. Click **"Assign Reviewer"** and assign primary reviewer (e.g. `REV-000045`).
  5. As assigned reviewer, click **"Record Decision"**:
     - Outcome: `violation_confirmed`
     - Cited Evidence: Select the initial matched passage
     - Rationale: *"Passages match uncited external source without quotation or attribution."*
  6. Submit. Notice the timeline records a new `decision_recorded` event with append-only integrity.

---

## Beat 2: Conflicted Reviewer Assignment Blocked (60s)
* **Goal**: Prove that reviewer conflict-of-interest checks (course instructor, same department, prior learner review) are enforced deterministically by the system.
* **Actor Picker**: Select **Vik Silva (`REV-000001`, Academic Administrator)**.
* **Case**: Navigate to case **`CAS-2026-000034`** (Learner: Jia Evans in **Biology** department).
* **Action**:
  1. Click **"Assign Reviewer"**.
  2. In the reviewer list, attempt to select **Ana Jensen (`REV-000041`)**, who also belongs to the **Biology** department.
  3. Notice the UI shows the reviewer as ineligible with reason: `SAME_DEPARTMENT`.
  4. If forced via API:
     ```powershell
     # Server returns 409 Conflict:
     {"error":{"code":"CONFLICT_OF_INTEREST","message":"REV-000041 is in the learner's department.","details":{"reviewer_id":"REV-000041","reasons":["SAME_DEPARTMENT"]}}}
     ```
  5. Select an eligible, conflict-free reviewer from another department (e.g. `REV-000050` from Engineering) and complete the assignment.

---

## Beat 3: Evidence After Decision Requires Reopening (60s)
* **Goal**: Demonstrate that once a decision is recorded, the evidentiary record is sealed; new evidence cannot silently alter history without formal reopening.
* **Case**: Navigate to case **`CAS-2026-000294`** (Status: `decided`).
* **Actor Picker**: Switch actor to **Uma Petrov (`REV-000042`, Assigned Reviewer)**.
* **Action**:
  1. Attempt to click **"Add Evidence"**.
  2. The action is disabled or, if submitted via API, returns `409 REOPEN_REQUIRED`:
     ```powershell
     {"error":{"code":"REOPEN_REQUIRED","message":"The case is decided: reopen it before adding evidence."}}
     ```
  3. Click **"Reopen Case"** and provide the rationale: *"Late submission statement received from student."*
  4. Observe the case transitions to `under_review` and a `case_reopened` event is appended to the audit timeline.
  5. Now add the evidence item. The evidence is successfully recorded with an immutable `evidence_added` event.

---

## Beat 4: Appeal Requires Independent Reviewer (60s)
* **Goal**: Show due process during appeals: the original decision-maker cannot review their own appeal, and closure is refused while an appeal is pending.
* **Case**: Navigate to case **`CAS-2026-000281`** (Status: `appealed`, grounds: *"The overlapping text is common phrasing in this field"*).
* **Actor Picker**: Switch actor to **Vik Silva (`REV-000001`, Academic Administrator)**.
* **Action**:
  1. Click **"Assign Appeal Reviewer"**.
  2. Notice that **Fatima Quist (`REV-000024`)**, who rendered the original decision, is disabled and marked ineligible.
  3. If attempted via API, the system rejects it with `409 NOT_INDEPENDENT`:
     ```powershell
     {"error":{"code":"NOT_INDEPENDENT","message":"REV-000024 is already on this case.","details":{"reasons":["ALREADY_ON_CASE","DECIDED_THIS_CASE"]}}}
     ```
  4. Attempt to click **"Close Case"**. The system refuses with `409 APPEAL_UNRESOLVED`:
     ```powershell
     {"error":{"code":"APPEAL_UNRESOLVED","message":"The appeal has no outcome yet, so the case cannot be closed."}}
     ```
  5. Assign an independent reviewer (e.g. `REV-000055`), record the appeal outcome (`upheld`), and then cleanly close the case.

---

## Beat 5: Audit & Anomaly Detection Dashboard (60s)
* **Goal**: Highlight the independent live auditor, showing 100% precision/recall on injected anomalies and zero false alarms on decoys.
* **Action**:
  1. Click **"Audit"** in the top navigation bar (`/audit`).
  2. Review the **Live Anomaly Findings** table (detects all 32 injected anomalies across full scale):
     * **G1 Auto Guilt**: Click **`CAS-2026-000011`** -> Notice the red gate: violation confirmed without human reviewer.
     * **G2 Reviewer Conflict**: Click **`CAS-2026-000088`** -> Notice the red gate: reviewer `REV-000049` in learner's department.
     * **G3 Evidence Post-Decision**: Click **`CAS-2026-000039`** -> Notice the red gate: evidence added after decision with no reopen event.
     * **G4 Dependent Appeal Reviewer**: Click **`CAS-2026-000042`** -> Notice the red gate: appeal decided by non-independent reviewer.
  3. Inspect the **Auditor Performance** scorecard:
     * Precision: **1.000** | Recall: **1.000** | F1: **1.000** across all 4 categories.
     * All legitimate near-miss decoys are correctly classified as normal.
  4. Point to the **Validation Summary**: 15 checks, 0 violations, and the transparent **Synthetic Data Statement**.
