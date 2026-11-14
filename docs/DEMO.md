# Demo rehearsal script: YottaFlex Hackathon (5 minutes)

Rehearsal script for the team. It is not linked from the README. It follows the live UI as it is in `frontend/src` (labels in `labels.ts`, `components/ActionForms.tsx`, `pages/AuditPage.tsx`, `components/layout/Sidebar.tsx`). Pinned case ids come from the seeded full dataset (`seed: 20261022`) and were checked against `data/full/*.csv`.

Pages in the sidebar: **Overview**, **Guide**, **Cases**, **Test Lab**, **Audit**, **Rules**. A case opens at `/cases/<id>`.

---

## Prerequisites
1. Database and API (the demo database is `integrity`; loading wipes the `public` schema of the database in `DATABASE_URL`):
   ```powershell
   docker compose up -d db
   $env:DATABASE_URL="postgresql://integrity:integrity_dev@localhost:5433/integrity"
   .\.venv\Scripts\python -m integrity.cli load --scale full
   cd backend; ..\.venv\Scripts\uvicorn integrity.main:app --port 8000
   ```
2. Frontend (live API is the default):
   ```powershell
   cd frontend; npm install; npm run dev
   ```
3. Open **`http://localhost:5173`**. The offline fixture demo is `VITE_USE_FIXTURES=true npm run dev`. Writes in fixture mode do not reach the database.

**Who you are.** The sidebar shows the current person. Pick one of the four persona cards, or use **Switch person**, a searchable list of all 64 staff with their ids (names repeat, for example two "Tara Abara": `REV-000048` and `REV-000049`, so always check the id). The actor is a header stub, not authentication. Say so if asked.

---

## Beat 1: Flag is a review, not a finding; a human decides (60 s)
* **Goal**: a similarity flag opens a case for human review. The system never decides guilt, and a decision needs a rationale and cited evidence.
* **Actor**: **Vik Silva** (`REV-000001`, Administrator).
* **Action**:
  1. Open **Cases**. Tabs: **Needs you**, **All cases**, **Under review**, **Awaiting appeal**, **Decided**, **Closed**, **Dismissed flags**. The tile for dismissed flags shows `700`.
  2. Open **`CAS-2026-000300`** (learner Kofi Lopez, History; assessment HIS-077 Project; status Open).
  3. Observe:
     - **Similarity** strip: adjusted (unexplained) score `0.674`, quoted `0.010`, template `0.026`, raw `0.710`. The Adjusted score hint explains that only the unexplained part counts. Band: **Flagged for review**.
     - **Fairness gates**: **Human reviewed**, **No conflict of interest**, **Evidence on record** and similar gates.
     - **How this flag became a case** is always visible on the case (there is no toggle any more).
  4. In **Actions**, **Do now**, click **Assign a reviewer**. In the list choose **Wen Fischer** (`REV-000045`, Computer Science) and confirm.
  5. Switch person to **Wen Fischer**. Click **Record a decision** and pick **Fail: violation confirmed**:
     - Tick **I have reviewed the cited evidence myself** (the checkbox appears under the fail option).
     - Rationale (at least 20 characters): *"Passages match uncited external source without quotation or attribution."*
     - Tick the cited evidence: the matched passage (`EVD-CAS-2026-000300-001`). A matched passage or source reference is required for a confirmed violation.
     - Submit with **Confirm violation**.
  6. The timeline shows **Decision recorded**. Nothing is final yet: the learner may appeal.

---

## Beat 2: Conflicted reviewer blocked (60 s)
* **Goal**: conflicts of interest are checked by the system, not by memory.
* **Actor**: **Vik Silva** (`REV-000001`).
* **Case**: **`CAS-2026-000034`** (learner Jia Evans, Biology; assessment BIO-057 Essay; status Open).
* **Action**:
  1. Click **Assign a reviewer**.
  2. **Ana Jensen** (`REV-000041`, Biology) is listed but disabled with the reason *"This reviewer works in the learner's department."*
  3. If forced through the API the response is `409` with:
     ```json
     {"error":{"code":"CONFLICT_OF_INTEREST","message":"REV-000041 is in the learner's department. Choose a reviewer from another department.","details":{"reviewer_id":"REV-000041","reasons":["SAME_DEPARTMENT"]}}}
     ```
     (`reasons` lists every conflict that applies to that reviewer.)
  4. Pick an eligible reviewer from another department, for example **Hana Abara** (`REV-000050`, Engineering), and assign.

---

## Beat 3: Evidence after a decision needs a reopen (60 s)
* **Goal**: the record of a decided case is kept. New evidence needs a formal reopen, which is itself recorded.
* **Case**: **`CAS-2026-000294`** (learner Ivan Lopez, Psychology; status Decided; decided by Uma Petrov).
* **Actor**: switch to **Uma Petrov** (`REV-000042`, Academic reviewer, assigned to the case).
* **Action**:
  1. Click **Add evidence**. It is refused. The Actions list shows: *"Evidence can't be added to a decided case. An assigned reviewer must reopen it first so history is kept."* with a **Reopen the case first** button.
  2. If forced through the API: `409` with `{"error":{"code":"REOPEN_REQUIRED","message":"Evidence can't be added to a decided case. An assigned reviewer must reopen it first so history is kept."}}`.
  3. Click **Reopen the case**, enter the reason *"Late submission statement received from student."*, and submit **Reopen**.
  4. The status becomes **Under review** and the timeline shows **Case reopened**.
  5. Click **Add evidence** again and record it. The timeline shows **Evidence added**. Evidence stays on the record.

---

## Beat 4: Appeal needs an independent reviewer; closing waits (60 s)
* **Goal**: the person who decided cannot hear the appeal, and the case cannot be closed while an appeal is open.
* **Case**: **`CAS-2026-000281`** (learner Tara Fischer, Biology; status Appeal filed; decided by Fatima Quist, `REV-000024`; grounds: *"The overlapping text is common phrasing in this field."*).
* **Actor**: **Vik Silva** (`REV-000001`).
* **Action**:
  1. Click **Close the case**. It is refused: *"The case can't be closed while its appeal is open. Close it once the appeal is decided."* (`APPEAL_UNRESOLVED`).
  2. Click **Assign appeal reviewer**. **Fatima Quist** is disabled with the reasons *"This reviewer is already assigned to the case."* and *"This reviewer already decided this case."* (The API returns `409 NOT_INDEPENDENT` with the message *"The appeal reviewer must be independent: someone who did not decide this case and has no conflict."*)
  3. Assign **Lena Evans** (`REV-000055`, History). Her department is not the learner's and she has no conflict.
  4. Switch person to **Lena Evans**. In the case, choose **Decide the appeal**. Pick **Uphold the original decision**, write a rationale, and submit **Record appeal outcome**. Only the assigned appeal reviewer can do this.
  5. Switch back to **Vik Silva** and click **Close the case**. It succeeds because the appeal is decided.
  6. Optional: on a case whose appeal is still in review, **Reassign appeal reviewer** appears instead of **Assign appeal reviewer**. The administrator can replace the reviewer, but not with the same person (`SAME_APPEAL_REVIEWER`).

---

## Beat 5: Audit: the independent auditor finds the labelled problems (60 s)
* **Goal**: an independent check looks for due-process failures and is measured against labels. The auditor does not read the labels.
* **Action**:
  1. Click **Audit** in the sidebar (`/audit`). Tabs: **Live findings**, **Auditor accuracy**, **Validation**.
  2. **Live findings** lists the findings by type, each linking to its case with a red gate:
     * **Confirmed without human review**: `CAS-2026-000011`.
     * **Reviewer with a conflict of interest**: `CAS-2026-000088` (`REV-000049`, Economics, learner in Economics).
     * **Evidence changed after decision, no reopen**: `CAS-2026-000039`.
     * **Appeal closed without independent review**: `CAS-2026-000042` (appeal reviewer `REV-000028` was already a case reviewer).
     * The full dataset gives 8, 10, 8 and 6 findings: 32 in total.
  3. **Auditor accuracy** shows precision, recall and F1 per issue type (all `1.000`) and triage by scenario. Say these are measured on our own labelled synthetic data. F1 of 1.0 is partly circular, because the rules and the auditor were written together (see `docs/requirements.md`, known gaps).
  4. **Validation** shows the integrity checks (15 checks, 0 violations) and the record counts. The **Synthetic data.** warning sits at the top of the **Auditor accuracy** tab: these scores show rule coverage, not how the system generalises.

---

## Other pages (only if asked)
* **Overview**: volume against the brief's targets, distributions, due-process health.
* **Guide**: who can do what, step by step, with the same rules the server enforces.
* **Test Lab**: paste JSON from an external AI, run it through the real rules, read the verdicts. The AI is never the decider.
* **Rules**: the rule versions and thresholds (`0.30` logged, `0.60` review, `0.80` priority; appeal window 14 days).

## Limits to state out loud
- Synthetic data: the numbers prove rule coverage, not generalisation.
- The actor header is a stub, not authentication.
- Appeal window is 14 days under the current rule. A confirmed violation decided today cannot be closed until its window ends, unless an appeal is decided or an administrator closes early with a recorded waiver. A cleared or inconclusive case can be closed at once. Seeded older cases can be closed.
