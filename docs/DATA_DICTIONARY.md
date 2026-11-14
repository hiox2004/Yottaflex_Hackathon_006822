# Data Dictionary: Academic Integrity Workflow

This dictionary describes the PostgreSQL 16 schema in `database/schema.sql`, which is the source of truth. Intent is taken from `docs/requirements.md` (sections B, C, D, E, G and ambiguity log Q1-Q8). The database is PostgreSQL. All timestamps are `timestamptz` and are stored in UTC. The entity called "Case" is the table `integrity_case`, because `CASE` is an SQL keyword. Where the schema does not state a rule, the rule is marked "Not enforced in the database (checked by the validator/auditor)."

## 1. ID formats

Child IDs must embed their parent's ID (similarity report in its submission, evidence, decision and appeal in their case); a `CHECK` rejects any mismatch.

Source line numbers refer to `database/schema.sql`.

| Entity (table) | Format | Regex (as in schema) | Example | Source |
|---|---|---|---|---|
| Department (`department`) | DEP-nn | `^DEP-[0-9]{2}$` | DEP-07 | line 10 |
| Reviewer (`reviewer`) | RVW-nnnn | `^RVW-[0-9]{4}$` | RVW-0042 | line 15 |
| Course (`course`) | CRS-nnn | `^CRS-[0-9]{3}$` | CRS-112 | line 25 |
| Learner (`learner`) | LRN-nnnnnn | `^LRN-[0-9]{6}$` | LRN-004213 | line 32 |
| Assessment (`assessment`) | ASM-nnnn | `^ASM-[0-9]{4}$` | ASM-0317 | line 46 |
| Integrity rule (`integrity_rule`) | INT-2026-nnnnnn | `^INT-2026-[0-9]{6}$` | INT-2026-000001 | line 56 |
| Submission (`submission`) | SUB-2026-nnnnnn | `^SUB-2026-[0-9]{6}$` | SUB-2026-004213 | line 71 |
| Similarity report (`similarity_report`) | SIM-SUB-2026-nnnnnn-nn | `^SIM-SUB-2026-[0-9]{6}-[0-9]{2}$` | SIM-SUB-2026-004213-01 | line 80 |
| Case (`integrity_case`) | CAS-2026-nnnnnn | `^CAS-2026-[0-9]{6}$` | CAS-2026-000145 | line 98 |
| Evidence item (`evidence_item`) | EVD-CAS-2026-nnnnnn-nnn | `^EVD-CAS-2026-[0-9]{6}-[0-9]{3}$` | EVD-CAS-2026-000145-001 | line 112 |
| Decision (`decision`) | DEC-CAS-2026-nnnnnn-nn | `^DEC-CAS-2026-[0-9]{6}-[0-9]{2}$` | DEC-CAS-2026-000145-01 | line 121 |
| Appeal (`appeal`) | APL-CAS-2026-nnnnnn-nn | `^APL-CAS-2026-[0-9]{6}-[0-9]{2}$` | APL-CAS-2026-000145-01 | line 137 |

`flag_event` and `case_event` use `bigint GENERATED ALWAYS AS IDENTITY` keys (lines 152-171). `enrollment`, `case_reviewer` and `decision_evidence` use composite keys and have no ID format of their own.

## 2. Core entities

### 2.1 learner

- **Primary key:** `learner_id`
- **Foreign keys:** `department_id` -> `department`
- **Cardinality:** 1:N to `submission` (via `submission.learner_id`). N:M to `course` through the bridge `enrollment` (PK `(learner_id, course_id)`).
- **Optional relationships:** none. `department_id` is required.
- **Effective-date columns:** `enrolled_on` (date)
- **Lifecycle states:** none in the schema.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| learner_id | text | Yes | Pattern `^LRN-[0-9]{6}$` | - | Yes (PK) | CHECK regex |
| department_id | text | Yes | Existing `department.department_id` | - | No | FK to `department` |
| enrolled_on | date | Yes | Calendar date | date (YYYY-MM-DD) | No | NOT NULL. Not enforced in the database (checked by the validator/auditor) for ordering against enrollment rows |

### 2.2 assessment

- **Primary key:** `assessment_id`
- **Foreign keys:** `course_id` -> `course`
- **Cardinality:** N:1 to `course`. 1:N to `submission`.
- **Optional relationships:** none.
- **Effective-date columns:** `opens_at`, `due_at` (submission window, timestamptz)
- **Lifecycle states:** none in the schema.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| assessment_id | text | Yes | Pattern `^ASM-[0-9]{4}$` | - | Yes (PK) | CHECK regex |
| course_id | text | Yes | Existing `course.course_id` | - | No | FK to `course` |
| title | text | Yes | Free text | - | No | NOT NULL only |
| kind | text | Yes | `essay`, `report`, `coding`, `short_answer` | - | No | CHECK `kind IN (...)` |
| opens_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL. Must be earlier than `due_at` (table CHECK) |
| due_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL. Must be later than `opens_at` (table CHECK `due_at > opens_at`) |

### 2.3 submission

- **Primary key:** `submission_id`
- **Foreign keys:** `learner_id` -> `learner`; `assessment_id` -> `assessment`
- **Cardinality:** N:1 to `learner`; N:1 to `assessment`; 1:N to `similarity_report`. `UNIQUE (learner_id, assessment_id)` allows at most one submission per learner per assessment.
- **Optional relationships:** none. Both foreign keys are required.
- **Effective-date columns:** `submitted_at`
- **Lifecycle states:** none in the schema.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| submission_id | text | Yes | Pattern `^SUB-2026-[0-9]{6}$` | - | Yes (PK) | CHECK regex |
| learner_id | text | Yes | Existing `learner.learner_id` | - | Yes (pair with `assessment_id`) | FK to `learner`. Pair is UNIQUE |
| assessment_id | text | Yes | Existing `assessment.assessment_id` | - | Yes (pair with `learner_id`) | FK to `assessment`. Pair is UNIQUE |
| submitted_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL. Not enforced in the database (checked by the validator/auditor) against the assessment window |
| word_count | integer | Yes | Integer greater than 0 | words | No | CHECK `word_count > 0` |

### 2.4 similarity_report

- **Primary key:** `similarity_report_id`
- **Foreign keys:** `submission_id` -> `submission`; `rule_id` -> `integrity_rule` (the rule version used to judge this report)
- **Cardinality:** N:1 to `submission` (no UNIQUE on `submission_id`, so the schema allows more than one report per submission). N:1 to `integrity_rule`. 1:0..1 to `integrity_case` (`integrity_case.similarity_report_id` is UNIQUE). 1:N to `flag_event`.
- **Optional relationships:** `integrity_case` (a report may have no case).
- **Effective-date columns:** `generated_at`
- **Lifecycle states:** flag events (`flagged`, `auto_dismissed`, `case_opened`) in `flag_event`. Band (`no_action`, `log_only`, `review`, `priority_review`) is derived in `v_report_band`. Neither is stored on this row.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| similarity_report_id | text | Yes | Pattern `^SIM-SUB-2026-[0-9]{6}-[0-9]{2}$` | - | Yes (PK) | CHECK regex. Digits are not tied to `submission_id` by any constraint (not enforced in the database; checked by the validator/auditor) |
| submission_id | text | Yes | Existing `submission.submission_id` | - | No | FK to `submission` |
| rule_id | text | Yes | Existing `integrity_rule.rule_id` | - | No | FK to `integrity_rule`. Rule effective dates are not enforced in the database (checked by the validator/auditor) |
| total_words | integer | Yes | Integer greater than 0 | words | No | CHECK `total_words > 0` |
| matched_words | integer | Yes | Integer 0 or greater, at most `total_words` | words | No | CHECK `matched_words >= 0`; table CHECK `matched_words <= total_words` |
| template_words | integer | Yes | Integer 0 or greater | words | No | CHECK `template_words >= 0`; table CHECK `template_words + quoted_words <= matched_words` |
| quoted_words | integer | Yes | Integer 0 or greater | words | No | CHECK `quoted_words >= 0`; table CHECK `template_words + quoted_words <= matched_words` |
| generated_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL |
| raw_score | numeric(4,3) | derived (GENERATED ALWAYS) | Ratio, 0.000 to 1.000 | ratio (dimensionless) | No | Formula: `round(matched_words::numeric / total_words, 3)`, STORED |
| adjusted_score | numeric(4,3) | derived (GENERATED ALWAYS) | Ratio, 0.000 to 1.000 (non-negative because of the template/quoted CHECK) | ratio (dimensionless) | No | Formula: `round((matched_words - template_words - quoted_words)::numeric / total_words, 3)`, STORED. This is the value compared with the thresholds |

### 2.5 integrity_rule

- **Primary key:** `rule_id`
- **Foreign keys:** none
- **Cardinality:** 1:N to `similarity_report`.
- **Optional relationships:** `effective_to` is optional (NULL means no end date).
- **Effective-date columns:** `effective_from`, `effective_to`
- **Lifecycle states:** none stored. Activity is defined only by the effective dates. Non-overlapping ranges are not enforced in the database (checked by the validator/auditor).

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| rule_id | text | Yes | Pattern `^INT-2026-[0-9]{6}$` | - | Yes (PK) | CHECK regex |
| name | text | Yes | Free text | - | No | NOT NULL only. Not enforced in the database (checked by the validator/auditor) for uniqueness |
| log_threshold | numeric(4,3) | Yes | Ratio, greater than 0 and less than `review_threshold` | ratio (same scale as adjusted_score) | No | Table CHECK `0 < log_threshold < review_threshold < priority_threshold <= 1` |
| review_threshold | numeric(4,3) | Yes | Ratio, greater than `log_threshold` and less than `priority_threshold` | ratio | No | Table CHECK (same chain as above). Meaning: at or above this value a human must review; never automatic guilt |
| priority_threshold | numeric(4,3) | Yes | Ratio, greater than `review_threshold` and at most 1 | ratio | No | Table CHECK (same chain as above). Meaning: at or above this value, priority review |
| effective_from | date | Yes | Calendar date | date (YYYY-MM-DD) | No | NOT NULL |
| effective_to | date | No (NULL = open-ended) | Calendar date | date (YYYY-MM-DD) | No | CHECK `effective_to IS NULL OR effective_to >= effective_from` |

Note: the threshold values themselves are not in the schema. The default bands in `requirements.md` (Q7: 0.30, 0.60, 0.80) are data values, not schema constraints.

### 2.6 integrity_case (entity "Case")

- **Primary key:** `case_id`
- **Foreign keys:** `similarity_report_id` -> `similarity_report` (UNIQUE: one case per flag)
- **Cardinality:** 1:1 to `similarity_report` (from the case side). N:M to `reviewer` through `case_reviewer`. 1:N to `evidence_item`. 1:N to `decision`. 0..1 to `appeal`. 1:N to `case_event`.
- **Optional relationships:** `appeal` (0 or 1 per case). Reviewer assignment rows are not required by any constraint.
- **Effective-date columns:** `opened_at`
- **Lifecycle states** (derived by `v_case_status` from the latest non-`evidence_added` event in `case_event`):
  - `open` (event `opened`)
  - `under_review` (events `reviewer_assigned`, `case_reopened`)
  - `decided` (event `decision_recorded`)
  - `appealed` (event `appeal_filed`)
  - `appeal_review` (event `appeal_reviewer_assigned`)
  - `appeal_decided` (event `appeal_decided`)
  - `closed` (event `closed`)

  The schema does not enforce transitions between states (checked by the validator/auditor).

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| case_id | text | Yes | Pattern `^CAS-2026-[0-9]{6}$` | - | Yes (PK) | CHECK regex |
| similarity_report_id | text | Yes | Existing `similarity_report.similarity_report_id` | - | Yes | FK to `similarity_report`. UNIQUE: one case per report |
| opened_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL. Equality with the `opened` event in `case_event` is not enforced in the database (checked by the validator/auditor) |

### 2.7 evidence_item

- **Primary key:** `evidence_id`
- **Foreign keys:** `case_id` -> `integrity_case`
- **Cardinality:** N:1 to `integrity_case`. N:M to `decision` through `decision_evidence` (the evidence a decision's rationale cites).
- **Optional relationships:** a decision may cite no evidence. The schema does not require any `decision_evidence` row (checked by the validator/auditor).
- **Effective-date columns:** `added_at`
- **Lifecycle states:** none stored on the row. Additions are recorded as `evidence_added` events in `case_event`. Rows are immutable: a trigger rejects `UPDATE` and `DELETE`. `evidence_id` must embed its `case_id` (`CHECK`).

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| evidence_id | text | Yes | Pattern `^EVD-CAS-2026-[0-9]{6}-[0-9]{3}$` | - | Yes (PK) | CHECK regex |
| case_id | text | Yes | Existing `integrity_case.case_id` | - | No | FK to `integrity_case` |
| kind | text | Yes | `matched_passage`, `source_reference`, `template_match`, `quote_citation`, `learner_statement` | - | No | CHECK `kind IN (...)` |
| description | text | Yes | Free text | - | No | NOT NULL only |
| added_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL. Ordering against `decided_at` of decisions in the same case is not enforced in the database (checked by the validator/auditor) |

### 2.8 reviewer

- **Primary key:** `reviewer_id`
- **Foreign keys:** `department_id` -> `department`
- **Cardinality:** N:1 to `department`. N:M to `integrity_case` through `case_reviewer`. 1:N to `decision` (nullable reference). 1:N to `appeal` (nullable reference). 1:N to `course` (as `instructor_id`). 1:N to `flag_event` and `case_event` (as `actor_id`).
- **Optional relationships:** `decision.reviewer_id` (NULL means the system decided). `appeal.reviewer_id` (NULL until assigned). `active_to` (NULL means no end date).
- **Effective-date columns:** `active_from`, `active_to`
- **Lifecycle states:** none stored. Active status is defined by the date range only.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| reviewer_id | text | Yes | Pattern `^RVW-[0-9]{4}$` | - | Yes (PK) | CHECK regex |
| department_id | text | Yes | Existing `department.department_id` | - | No | FK to `department` |
| role | text | Yes | `instructor`, `academic_administrator`, `support_staff`, `platform_administrator` | - | No | CHECK `role IN (...)`. Who may close a case (Q6) is not enforced in the database (checked by the service layer) |
| active_from | date | Yes | Calendar date | date (YYYY-MM-DD) | No | NOT NULL |
| active_to | date | No (NULL = open-ended) | Calendar date | date (YYYY-MM-DD) | No | CHECK `active_to IS NULL OR active_to >= active_from` |

### 2.9 decision

- **Primary key:** `decision_id`
- **Foreign keys:** `case_id` -> `integrity_case`; `reviewer_id` -> `reviewer` (nullable)
- **Cardinality:** N:1 to `integrity_case` (the schema allows more than one decision per case; no UNIQUE). N:0..1 to `reviewer`. N:M to `evidence_item` through `decision_evidence`.
- **Optional relationships:** `reviewer_id`. NULL means the system decided. The schema comment states this is a rule violation that is "kept loadable on purpose."
- **Effective-date columns:** `decided_at`
- **Lifecycle states:** none. `outcome` is a result value, not a status. Case status `decided` is derived from the `decision_recorded` event.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| decision_id | text | Yes | Pattern `^DEC-CAS-2026-[0-9]{6}-[0-9]{2}$` | - | Yes (PK) | CHECK regex |
| case_id | text | Yes | Existing `integrity_case.case_id` | - | No | FK to `integrity_case` |
| reviewer_id | text | No (NULL = system decided) | Existing `reviewer.reviewer_id`, or NULL | - | No | FK to `reviewer`. Conflict-of-interest check is not enforced in the database (checked by the service layer) |
| outcome | text | Yes | `no_violation`, `violation_confirmed`, `inconclusive` | - | No | CHECK `outcome IN (...)`. A system-made `violation_confirmed` (reviewer_id NULL) is not blocked by the database (checked by the service layer and validator/auditor) |
| rationale | text | Yes | Free text | - | No | NOT NULL only |
| decided_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL |

### 2.10 appeal

- **Primary key:** `appeal_id`
- **Foreign keys:** `case_id` -> `integrity_case` (UNIQUE); `reviewer_id` -> `reviewer` (nullable)
- **Cardinality:** 0..1 to `integrity_case` (UNIQUE: at most one appeal per case). N:0..1 to `reviewer`.
- **Optional relationships:** `reviewer_id` (NULL until assigned). `outcome` and `closed_at` (both NULL while open).
- **Effective-date columns:** `filed_at`, `closed_at`
- **Lifecycle states:** the appeal row has no status column. States are derived from `case_event` and `v_case_status`:
  - filed (`appeal_filed`, case status `appealed`)
  - reviewer assigned (`appeal_reviewer_assigned`, case status `appeal_review`)
  - decided (`appeal_decided`, case status `appeal_decided`), with `outcome` and `closed_at` set

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| appeal_id | text | Yes | Pattern `^APL-CAS-2026-[0-9]{6}-[0-9]{2}$` | - | Yes (PK) | CHECK regex |
| case_id | text | Yes | Existing `integrity_case.case_id` | - | Yes | FK to `integrity_case`. UNIQUE: at most one appeal per case |
| filed_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL |
| grounds | text | Yes | Free text | - | No | NOT NULL only |
| reviewer_id | text | No (NULL until assigned) | Existing `reviewer.reviewer_id`, or NULL | - | No | FK to `reviewer`. Independence from the original decision is not enforced in the database (checked by the service layer and auditor) |
| outcome | text | No (NULL until closed) | `upheld`, `overturned`, `partially_upheld` | - | No | CHECK `outcome IN (...)`. Must be NULL exactly when `closed_at` is NULL (table CHECK) |
| closed_at | timestamptz | No (NULL until closed) | UTC instant | UTC | No | Must be NULL exactly when `outcome` is NULL. Must be `>= filed_at` (table CHECK). Closure without independent review is not enforced in the database (checked by the service layer and auditor) |

## 3. Supporting tables

### 3.1 department

- **Primary key:** `department_id`. No foreign keys.
- **Cardinality:** 1:N to `reviewer`, `course`, `learner`.
- **Optional relationships:** none.
- **Effective-date columns:** none.
- **Lifecycle states:** none.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| department_id | text | Yes | Pattern `^DEP-[0-9]{2}$` | - | Yes (PK) | CHECK regex |
| name | text | Yes | Free text | - | Yes | NOT NULL, UNIQUE |

### 3.2 course

- **Primary key:** `course_id`
- **Foreign keys:** `department_id` -> `department`; `instructor_id` -> `reviewer`
- **Cardinality:** N:1 to `department`; N:1 to `reviewer` (instructor). 1:N to `assessment`. N:M to `learner` through `enrollment`.
- **Optional relationships:** none.
- **Effective-date columns:** none.
- **Lifecycle states:** none.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| course_id | text | Yes | Pattern `^CRS-[0-9]{3}$` | - | Yes (PK) | CHECK regex |
| department_id | text | Yes | Existing `department.department_id` | - | No | FK to `department` |
| instructor_id | text | Yes | Existing `reviewer.reviewer_id` | - | No | FK to `reviewer`. Instructor role is not enforced in the database (checked by the validator/auditor) |
| title | text | Yes | Free text | - | No | NOT NULL only |

### 3.3 enrollment (bridge: learner N:M course)

- **Primary key:** `(learner_id, course_id)`
- **Foreign keys:** `learner_id` -> `learner`; `course_id` -> `course`
- **Cardinality:** bridge between `learner` and `course`.
- **Optional relationships:** none.
- **Effective-date columns:** `enrolled_on`
- **Lifecycle states:** none.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| learner_id | text | Yes | Existing `learner.learner_id` | - | Yes (pair with `course_id`) | FK to `learner`. PK component |
| course_id | text | Yes | Existing `course.course_id` | - | Yes (pair with `learner_id`) | FK to `course`. PK component |
| enrolled_on | date | Yes | Calendar date | date (YYYY-MM-DD) | No | NOT NULL. Not enforced in the database (checked by the validator/auditor) against `learner.enrolled_on` |

### 3.4 case_reviewer (bridge: integrity_case N:M reviewer)

- **Primary key:** `(case_id, reviewer_id)`
- **Foreign keys:** `case_id` -> `integrity_case`; `reviewer_id` -> `reviewer`
- **Cardinality:** bridge between `integrity_case` and `reviewer`.
- **Optional relationships:** none in the schema.
- **Effective-date columns:** `assigned_at`
- **Lifecycle states:** none.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| case_id | text | Yes | Existing `integrity_case.case_id` | - | Yes (pair with `reviewer_id`) | FK to `integrity_case`. PK component |
| reviewer_id | text | Yes | Existing `reviewer.reviewer_id` | - | Yes (pair with `case_id`) | FK to `reviewer`. PK component. Conflict of interest (Q5) is not enforced in the database (checked by the service layer) |
| assigned_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL. Not enforced in the database (checked by the validator/auditor) against the `reviewer_assigned` event |

### 3.5 decision_evidence (bridge: decision N:M evidence_item)

- **Primary key:** `(decision_id, evidence_id)`
- **Foreign keys:** `decision_id` -> `decision`; `evidence_id` -> `evidence_item`
- **Cardinality:** bridge between `decision` and `evidence_item`.
- **Optional relationships:** none in the schema.
- **Effective-date columns:** none.
- **Lifecycle states:** none.

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| decision_id | text | Yes | Existing `decision.decision_id` | - | Yes (pair with `evidence_id`) | FK to `decision`. PK component |
| evidence_id | text | Yes | Existing `evidence_item.evidence_id` | - | Yes (pair with `decision_id`) | FK to `evidence_item`. PK component. Evidence added after `decided_at` without a reopen event is not enforced in the database (checked by the service layer and auditor) |

### 3.6 flag_event (append-only)

- **Primary key:** `flag_event_id` (bigint, GENERATED ALWAYS AS IDENTITY)
- **Foreign keys:** `similarity_report_id` -> `similarity_report`; `actor_id` -> `reviewer` (nullable)
- **Cardinality:** N:1 to `similarity_report`.
- **Optional relationships:** `actor_id` (NULL means the system acted).
- **Effective-date columns:** `occurred_at`
- **Lifecycle states:** `flagged`, `auto_dismissed`, `case_opened`. Table has BEFORE UPDATE, BEFORE DELETE and BEFORE TRUNCATE triggers that raise an exception (`forbid_change`).

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| flag_event_id | bigint | derived (GENERATED ALWAYS AS IDENTITY) | Integer sequence | - | Yes (PK) | Generated by the database. Cannot be supplied by the application |
| similarity_report_id | text | Yes | Existing `similarity_report.similarity_report_id` | - | No | FK to `similarity_report` |
| event_type | text | Yes | `flagged`, `auto_dismissed`, `case_opened` | - | No | CHECK `event_type IN (...)` |
| occurred_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL |
| actor_id | text | No (NULL = system) | Existing `reviewer.reviewer_id`, or NULL | - | No | FK to `reviewer` |
| note | text | No | Free text | - | No | Nullable, no rule |

### 3.7 case_event (append-only)

- **Primary key:** `case_event_id` (bigint, GENERATED ALWAYS AS IDENTITY)
- **Foreign keys:** `case_id` -> `integrity_case`; `actor_id` -> `reviewer` (nullable)
- **Cardinality:** N:1 to `integrity_case`.
- **Optional relationships:** `actor_id` (NULL means the system acted); `ref_id`; `detail`.
- **Effective-date columns:** `occurred_at`
- **Lifecycle states:** not a state table. Event types drive `v_case_status`. Table has BEFORE UPDATE, BEFORE DELETE and BEFORE TRUNCATE triggers that raise an exception (`forbid_change`).

| Field | Type | Required | Allowed values | Units | Unique | Validation rule |
|---|---|---|---|---|---|---|
| case_event_id | bigint | derived (GENERATED ALWAYS AS IDENTITY) | Integer sequence | - | Yes (PK) | Generated by the database. Cannot be supplied by the application |
| case_id | text | Yes | Existing `integrity_case.case_id` | - | No | FK to `integrity_case` |
| event_type | text | Yes | `opened`, `reviewer_assigned`, `evidence_added`, `decision_recorded`, `case_reopened`, `appeal_filed`, `appeal_reviewer_assigned`, `appeal_decided`, `closed` | - | No | CHECK `event_type IN (...)` |
| occurred_at | timestamptz | Yes | UTC instant | UTC | No | NOT NULL. Ordering per case is used by `v_case_status` and indexed on `(case_id, occurred_at)` |
| actor_id | text | No (NULL = system) | Existing `reviewer.reviewer_id`, or NULL | - | No | FK to `reviewer` |
| ref_id | text | No | ID of the evidence, decision or appeal the event concerns | - | No | No foreign key and no format check. Not enforced in the database (checked by the validator/auditor) |
| detail | text | No | Free text | - | No | Nullable, no rule |

## 4. Views

- **`v_report_band`**: one row per `similarity_report`, joined to `integrity_rule` on `rule_id`. It returns `similarity_report_id`, `submission_id`, `rule_id`, `adjusted_score` and `band`. `band` is `priority_review` when `adjusted_score >= priority_threshold`, else `review` when `>= review_threshold`, else `log_only` when `>= log_threshold`, else `no_action`. Thresholds are taken from the rule that judged the report, so a report keeps the band of its own rule version.
- **`v_flag`**: the rows of `v_report_band` whose `band` is `review` or `priority_review`. A flag is a report that needs human review (Q1).
- **`v_case_status`**: one row per case that has at least one non-`evidence_added` event. It takes the latest such event by `occurred_at`, then by `case_event_id` as tie-break, and maps its `event_type` to `status` and `occurred_at` to `status_since`. The mapping is listed in section 2.6. Evidence additions do not change status.

## 5. Rules enforced outside the database

The schema header states that business rules live in the backend, so that injected anomalies can be loaded (decision 0004). The schema does not check the rules below. Intent is taken from `docs/requirements.md`.

- **Reviewer conflict of interest** (E4, G2, Q5). A reviewer must not be the submitting learner's instructor, must not be in the same department, and must not have reviewed the same submission before. Intent: the system blocks or flags the assignment. Checked by: the service layer (blocks assignment in `case_reviewer`); the validator/auditor (flags labelled conflicts in loaded data).
- **Independent appeal review** (E6, G4, Q8). An appeal is closed only after independent review, and the appeal reviewer is not the original decision reviewer. Intent: the system rejects closure without independent review. The schema allows `outcome` and `closed_at` to be set with `reviewer_id` NULL. Checked by: the service layer (rejects closure); the auditor (flags labelled closures without independent review).
- **Evidence after a decision needs a reopen event** (G3). Evidence added after a decision must be recorded as an `evidence_added` event in `case_event`, and the case must have a `case_reopened` event. The row is never overwritten. Checked by: the service layer; the auditor. Evidence and decision rows are immutable (trigger), so the history is carried by the events.
- **No automatic guilt** (E3, G1, Q7). A report at or above a threshold triggers review only. It never produces a finding of guilt on its own. The schema permits `violation_confirmed` with `reviewer_id` NULL so that such records can be loaded. Checked by: the service layer (does not create such decisions automatically); the validator/auditor (flags system-made violation decisions in loaded data).
