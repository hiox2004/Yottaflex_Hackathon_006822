-- Academic integrity workflow schema (PostgreSQL 16).
-- Structure only: keys, types, allowed values, append-only history. Business rules (conflicts, independent
-- appeal review, evidence-after-decision) live in the backend so the injected anomalies can be loaded (decision 0004).
-- Derived values (scores, bands, case status) are computed from source rows, never typed in by hand.
-- Timestamps are timestamptz (UTC). "Case" is the table integrity_case because CASE is an SQL keyword.

-- ---------- Master data ----------

CREATE TABLE department (
  department_id text PRIMARY KEY CHECK (department_id ~ '^DEP-[0-9]{2}$'),
  name          text NOT NULL UNIQUE
);

CREATE TABLE reviewer (
  reviewer_id   text PRIMARY KEY CHECK (reviewer_id ~ '^RVW-[0-9]{4}$'),
  department_id text NOT NULL REFERENCES department,
  role          text NOT NULL CHECK (role IN
                  ('instructor', 'academic_administrator', 'support_staff', 'platform_administrator')),
  active_from   date NOT NULL,
  active_to     date,
  CHECK (active_to IS NULL OR active_to >= active_from)
);

CREATE TABLE course (
  course_id     text PRIMARY KEY CHECK (course_id ~ '^CRS-[0-9]{3}$'),
  department_id text NOT NULL REFERENCES department,
  instructor_id text NOT NULL REFERENCES reviewer,
  title         text NOT NULL
);

CREATE TABLE learner (
  learner_id    text PRIMARY KEY CHECK (learner_id ~ '^LRN-[0-9]{6}$'),
  department_id text NOT NULL REFERENCES department,
  enrolled_on   date NOT NULL
);

-- N:M bridge: a learner takes many courses, a course has many learners.
CREATE TABLE enrollment (
  learner_id  text NOT NULL REFERENCES learner,
  course_id   text NOT NULL REFERENCES course,
  enrolled_on date NOT NULL,
  PRIMARY KEY (learner_id, course_id)
);

CREATE TABLE assessment (
  assessment_id text PRIMARY KEY CHECK (assessment_id ~ '^ASM-[0-9]{4}$'),
  course_id     text NOT NULL REFERENCES course,
  title         text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('essay', 'report', 'coding', 'short_answer')),
  opens_at      timestamptz NOT NULL,
  due_at        timestamptz NOT NULL,
  CHECK (due_at > opens_at)
);

CREATE TABLE integrity_rule (
  rule_id            text PRIMARY KEY CHECK (rule_id ~ '^INT-2026-[0-9]{6}$'),
  name               text NOT NULL,
  log_threshold      numeric(4, 3) NOT NULL,  -- adjusted score at or above: record only
  review_threshold   numeric(4, 3) NOT NULL,  -- at or above: a human must review (never automatic guilt)
  priority_threshold numeric(4, 3) NOT NULL,  -- at or above: priority review
  effective_from     date NOT NULL,
  effective_to       date,
  CHECK (0 < log_threshold AND log_threshold < review_threshold
         AND review_threshold < priority_threshold AND priority_threshold <= 1),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- ---------- Submissions and similarity ----------

CREATE TABLE submission (
  submission_id text PRIMARY KEY CHECK (submission_id ~ '^SUB-2026-[0-9]{6}$'),
  learner_id    text NOT NULL REFERENCES learner,
  assessment_id text NOT NULL REFERENCES assessment,
  submitted_at  timestamptz NOT NULL,
  word_count    integer NOT NULL CHECK (word_count > 0),
  UNIQUE (learner_id, assessment_id)
);

CREATE TABLE similarity_report (
  similarity_report_id text PRIMARY KEY CHECK (similarity_report_id ~ '^SIM-SUB-2026-[0-9]{6}-[0-9]{2}$'),
  submission_id        text NOT NULL REFERENCES submission,
  rule_id              text NOT NULL REFERENCES integrity_rule,  -- the rule version used to judge this report
  total_words          integer NOT NULL CHECK (total_words > 0),
  matched_words        integer NOT NULL CHECK (matched_words >= 0),
  template_words       integer NOT NULL CHECK (template_words >= 0),  -- matched, but from the shared assignment template
  quoted_words         integer NOT NULL CHECK (quoted_words >= 0),    -- matched, but properly quoted or cited
  generated_at         timestamptz NOT NULL,
  raw_score            numeric(4, 3) GENERATED ALWAYS AS
                         (round(matched_words::numeric / total_words, 3)) STORED,
  adjusted_score       numeric(4, 3) GENERATED ALWAYS AS
                         (round((matched_words - template_words - quoted_words)::numeric / total_words, 3)) STORED,
  CHECK (template_words + quoted_words <= matched_words AND matched_words <= total_words)
);

-- ---------- Cases ----------

CREATE TABLE integrity_case (
  case_id              text PRIMARY KEY CHECK (case_id ~ '^CAS-2026-[0-9]{6}$'),
  similarity_report_id text NOT NULL UNIQUE REFERENCES similarity_report,  -- one case per flag
  opened_at            timestamptz NOT NULL
);

-- N:M bridge: a case can have several reviewers, a reviewer many cases.
CREATE TABLE case_reviewer (
  case_id     text NOT NULL REFERENCES integrity_case,
  reviewer_id text NOT NULL REFERENCES reviewer,
  assigned_at timestamptz NOT NULL,
  PRIMARY KEY (case_id, reviewer_id)
);

CREATE TABLE evidence_item (
  evidence_id text PRIMARY KEY CHECK (evidence_id ~ '^EVD-CAS-2026-[0-9]{6}-[0-9]{3}$'),
  case_id     text NOT NULL REFERENCES integrity_case,
  kind        text NOT NULL CHECK (kind IN
                ('matched_passage', 'source_reference', 'template_match', 'quote_citation', 'learner_statement')),
  description text NOT NULL,
  added_at    timestamptz NOT NULL
);

CREATE TABLE decision (
  decision_id text PRIMARY KEY CHECK (decision_id ~ '^DEC-CAS-2026-[0-9]{6}-[0-9]{2}$'),
  case_id     text NOT NULL REFERENCES integrity_case,
  reviewer_id text REFERENCES reviewer,  -- NULL means the system decided; a rule violation, kept loadable on purpose
  outcome     text NOT NULL CHECK (outcome IN ('no_violation', 'violation_confirmed', 'inconclusive')),
  rationale   text NOT NULL,
  decided_at  timestamptz NOT NULL
);

-- N:M bridge: which evidence a decision's rationale cites.
CREATE TABLE decision_evidence (
  decision_id text NOT NULL REFERENCES decision,
  evidence_id text NOT NULL REFERENCES evidence_item,
  PRIMARY KEY (decision_id, evidence_id)
);

CREATE TABLE appeal (
  appeal_id   text PRIMARY KEY CHECK (appeal_id ~ '^APL-CAS-2026-[0-9]{6}-[0-9]{2}$'),
  case_id     text NOT NULL UNIQUE REFERENCES integrity_case,  -- at most one appeal per case
  filed_at    timestamptz NOT NULL,
  grounds     text NOT NULL,
  reviewer_id text REFERENCES reviewer,  -- the independent appeal reviewer; NULL until assigned
  outcome     text CHECK (outcome IN ('upheld', 'overturned', 'partially_upheld')),
  closed_at   timestamptz,
  CHECK ((outcome IS NULL) = (closed_at IS NULL)),
  CHECK (closed_at IS NULL OR closed_at >= filed_at)
);

-- ---------- Append-only history ----------
-- State changes are recorded as events and never edited. Status is derived from them (views below).
-- actor_id NULL means the system acted.

CREATE TABLE flag_event (
  flag_event_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  similarity_report_id text NOT NULL REFERENCES similarity_report,
  event_type           text NOT NULL CHECK (event_type IN ('flagged', 'auto_dismissed', 'case_opened')),
  occurred_at          timestamptz NOT NULL,
  actor_id             text REFERENCES reviewer,
  note                 text
);

CREATE TABLE case_event (
  case_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id       text NOT NULL REFERENCES integrity_case,
  event_type    text NOT NULL CHECK (event_type IN
                  ('opened', 'reviewer_assigned', 'evidence_added', 'decision_recorded', 'case_reopened',
                   'appeal_filed', 'appeal_reviewer_assigned', 'appeal_decided', 'closed')),
  occurred_at   timestamptz NOT NULL,
  actor_id      text REFERENCES reviewer,
  ref_id        text,  -- id of the evidence, decision or appeal the event is about
  detail        text
);

CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END
$$;

CREATE TRIGGER flag_event_append_only BEFORE UPDATE OR DELETE ON flag_event
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER flag_event_no_truncate BEFORE TRUNCATE ON flag_event
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
CREATE TRIGGER case_event_append_only BEFORE UPDATE OR DELETE ON case_event
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER case_event_no_truncate BEFORE TRUNCATE ON case_event
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();

-- ---------- Indexes on common joins ----------

CREATE INDEX ON submission (learner_id);
CREATE INDEX ON submission (assessment_id);
CREATE INDEX ON similarity_report (submission_id);
CREATE INDEX ON flag_event (similarity_report_id);
CREATE INDEX ON case_event (case_id, occurred_at);
CREATE INDEX ON evidence_item (case_id);
CREATE INDEX ON decision (case_id);
CREATE INDEX ON case_reviewer (reviewer_id);

-- ---------- Derived views ----------

-- Band of every report, from the thresholds of the rule that judged it.
CREATE VIEW v_report_band AS
SELECT r.similarity_report_id, r.submission_id, r.rule_id, r.adjusted_score,
       CASE WHEN r.adjusted_score >= u.priority_threshold THEN 'priority_review'
            WHEN r.adjusted_score >= u.review_threshold   THEN 'review'
            WHEN r.adjusted_score >= u.log_threshold      THEN 'log_only'
            ELSE 'no_action' END AS band
FROM similarity_report r
JOIN integrity_rule u USING (rule_id);

-- A flag is a report that needs human review.
CREATE VIEW v_flag AS
SELECT * FROM v_report_band WHERE band IN ('review', 'priority_review');

-- Current status of each case, from its latest status-changing event.
CREATE VIEW v_case_status AS
SELECT DISTINCT ON (case_id)
       case_id,
       occurred_at AS status_since,
       CASE event_type
         WHEN 'opened'                   THEN 'open'
         WHEN 'reviewer_assigned'        THEN 'under_review'
         WHEN 'decision_recorded'        THEN 'decided'
         WHEN 'case_reopened'            THEN 'under_review'
         WHEN 'appeal_filed'             THEN 'appealed'
         WHEN 'appeal_reviewer_assigned' THEN 'appeal_review'
         WHEN 'appeal_decided'           THEN 'appeal_decided'
         WHEN 'closed'                   THEN 'closed'
       END AS status
FROM case_event
WHERE event_type <> 'evidence_added'
ORDER BY case_id, occurred_at DESC, case_event_id DESC;
