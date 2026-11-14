-- Integrity Desk schema (PostgreSQL 16). Drop-and-recreate: dbload resets `public` and applies this file.
-- Structure only: keys, types, allowed values, id formats, append-only history. Business rules (conflicts,
-- appeal independence, evidence after a decision) are NOT constraints, so the labelled anomalies can load
-- and be detected (decision 0004). Scores are fractions 0-1; timestamps are UTC (timestamptz).
-- No stored case status or version: views v_case_status, v_flag and v_case_queue derive them.

-- ---------------------------------------------------------------- people and master data
CREATE TABLE reviewer (
    reviewer_id text PRIMARY KEY CHECK (reviewer_id ~ '^REV-[0-9]{6}$'),
    name        text NOT NULL CHECK (btrim(name) <> ''),
    role        text NOT NULL CHECK (role IN
                    ('instructor', 'academic_reviewer', 'academic_administrator', 'support_staff')),
    department  text NOT NULL CHECK (btrim(department) <> '')
);

CREATE TABLE learner (
    learner_id  text PRIMARY KEY CHECK (learner_id ~ '^LRN-[0-9]{6}$'),
    name        text NOT NULL CHECK (btrim(name) <> ''),
    department  text NOT NULL CHECK (btrim(department) <> ''),
    cohort_year integer NOT NULL CHECK (cohort_year BETWEEN 2000 AND 2100)
);

CREATE TABLE assessment (
    assessment_id text PRIMARY KEY CHECK (assessment_id ~ '^ASM-[0-9]{6}$'),
    title         text NOT NULL CHECK (btrim(title) <> ''),
    kind          text NOT NULL CHECK (kind IN ('essay', 'report', 'project', 'lab_report', 'coding_task')),
    department    text NOT NULL CHECK (btrim(department) <> ''),
    instructor_id text NOT NULL REFERENCES reviewer,
    due_at        timestamptz NOT NULL
);

-- Rule versions are never edited: a new version closes the old one by insert only (effective_to is set at load).
CREATE TABLE integrity_rule (
    rule_id             text PRIMARY KEY CHECK (rule_id ~ '^INT-2026-[0-9]{6}$'),
    name                text NOT NULL CHECK (btrim(name) <> ''),
    version             integer NOT NULL UNIQUE CHECK (version >= 1),
    log_threshold       numeric(4,3) NOT NULL CHECK (log_threshold BETWEEN 0 AND 1),
    review_threshold    numeric(4,3) NOT NULL,
    priority_threshold  numeric(4,3) NOT NULL CHECK (priority_threshold BETWEEN 0 AND 1),
    appeal_window_days  integer NOT NULL CHECK (appeal_window_days > 0),
    effective_from      timestamptz NOT NULL,
    effective_to        timestamptz,
    CHECK (log_threshold < review_threshold AND review_threshold < priority_threshold),
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- ---------------------------------------------------------------- submissions and reports
CREATE TABLE submission (
    submission_id text PRIMARY KEY CHECK (submission_id ~ '^SUB-2026-[0-9]{6}$'),
    learner_id    text NOT NULL REFERENCES learner,
    assessment_id text NOT NULL REFERENCES assessment,
    attempt_no    integer NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
    submitted_at  timestamptz NOT NULL,
    word_count    integer NOT NULL CHECK (word_count > 0),
    UNIQUE (learner_id, assessment_id, attempt_no)
);
CREATE INDEX submission_learner_idx ON submission (learner_id);

-- One report per submission (no rescans), so the id suffix is always -01.
CREATE TABLE similarity_report (
    similarity_report_id text PRIMARY KEY,
    submission_id        text NOT NULL UNIQUE REFERENCES submission,
    rule_id              text NOT NULL REFERENCES integrity_rule,
    raw_score            numeric(4,3) NOT NULL CHECK (raw_score BETWEEN 0 AND 1),
    quoted_score         numeric(4,3) NOT NULL CHECK (quoted_score BETWEEN 0 AND 1),
    template_score       numeric(4,3) NOT NULL CHECK (template_score BETWEEN 0 AND 1),
    adjusted_score       numeric(4,3) GENERATED ALWAYS AS (raw_score - quoted_score - template_score) STORED,
    generated_at         timestamptz NOT NULL,
    CHECK (similarity_report_id = 'SIM-' || submission_id || '-01'),
    CHECK (quoted_score + template_score <= raw_score)
);

-- ---------------------------------------------------------------- cases
-- No status, version or closed_at here: they are derived from case_event (v_case_status).
CREATE TABLE integrity_case (
    case_id              text PRIMARY KEY CHECK (case_id ~ '^CAS-2026-[0-9]{6}$'),
    similarity_report_id text NOT NULL UNIQUE REFERENCES similarity_report,
    opened_at            timestamptz NOT NULL
);
CREATE INDEX integrity_case_opened_idx ON integrity_case (opened_at DESC, case_id);

CREATE TABLE case_reviewer (
    case_id      text NOT NULL REFERENCES integrity_case,
    reviewer_id  text NOT NULL REFERENCES reviewer,
    role_in_case text NOT NULL CHECK (role_in_case IN ('primary', 'secondary')),
    assigned_at  timestamptz NOT NULL,
    assigned_by  text NOT NULL REFERENCES reviewer,
    PRIMARY KEY (case_id, reviewer_id)
);
CREATE INDEX case_reviewer_reviewer_idx ON case_reviewer (reviewer_id);

CREATE TABLE evidence_item (
    evidence_id text PRIMARY KEY CHECK (evidence_id ~ '^EVD-CAS-2026-[0-9]{6}-[0-9]{3}$'),
    case_id     text NOT NULL REFERENCES integrity_case,
    kind        text NOT NULL CHECK (kind IN
                    ('matched_passage', 'source_reference', 'template_match', 'quote_citation', 'learner_statement')),
    description text NOT NULL CHECK (btrim(description) <> ''),
    added_at    timestamptz NOT NULL,
    added_by    text REFERENCES reviewer,
    CHECK (starts_with(evidence_id, 'EVD-' || case_id || '-'))
);
CREATE INDEX evidence_item_case_idx ON evidence_item (case_id, added_at);

-- reviewer_id is NULL only in the injected G1 rows (decided with no human); the API never writes NULL.
CREATE TABLE decision (
    decision_id text PRIMARY KEY CHECK (decision_id ~ '^DEC-CAS-2026-[0-9]{6}-[0-9]{2}$'),
    case_id     text NOT NULL REFERENCES integrity_case,
    reviewer_id text REFERENCES reviewer,
    outcome     text NOT NULL CHECK (outcome IN ('no_violation', 'violation_confirmed', 'inconclusive')),
    rationale   text NOT NULL CHECK (btrim(rationale) <> ''),
    decided_at  timestamptz NOT NULL,
    CHECK (starts_with(decision_id, 'DEC-' || case_id || '-'))
);
CREATE INDEX decision_case_idx ON decision (case_id, decided_at);

CREATE TABLE decision_evidence (
    decision_id text NOT NULL REFERENCES decision,
    evidence_id text NOT NULL REFERENCES evidence_item,
    PRIMARY KEY (decision_id, evidence_id)
);
CREATE INDEX decision_evidence_evidence_idx ON decision_evidence (evidence_id);

-- Mutable on purpose: the appeal reviewer and outcome are filled in later. Each change also writes a case_event.
CREATE TABLE appeal (
    appeal_id         text PRIMARY KEY CHECK (appeal_id ~ '^APL-CAS-2026-[0-9]{6}-[0-9]{2}$'),
    case_id           text NOT NULL UNIQUE REFERENCES integrity_case,
    decision_id       text NOT NULL REFERENCES decision,
    grounds           text NOT NULL CHECK (btrim(grounds) <> ''),
    filed_at          timestamptz NOT NULL,
    filed_by          text NOT NULL REFERENCES reviewer,
    reviewer_id       text REFERENCES reviewer,
    outcome           text CHECK (outcome IN ('upheld', 'overturned', 'partially_upheld')),
    outcome_rationale text CHECK (btrim(outcome_rationale) <> ''),
    decided_at        timestamptz,
    CHECK (starts_with(appeal_id, 'APL-' || case_id || '-')),
    CHECK ((outcome IS NULL) = (outcome_rationale IS NULL) AND (outcome IS NULL) = (decided_at IS NULL))
);
CREATE INDEX appeal_reviewer_idx ON appeal (reviewer_id);

-- Status-changing events carry from_status and to_status (case_opened: from NULL); others leave both NULL.
-- actor_id NULL = the system (only injected G1 rows and case_opened by triage).
CREATE TABLE case_event (
    case_event_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    case_id       text NOT NULL REFERENCES integrity_case,
    event_type    text NOT NULL CHECK (event_type IN
                      ('case_opened', 'reviewer_assigned', 'evidence_added', 'decision_recorded', 'case_reopened',
                       'appeal_filed', 'appeal_reviewer_assigned', 'appeal_decided', 'case_closed')),
    from_status   text CHECK (from_status IN
                      ('open', 'under_review', 'decided', 'appealed', 'appeal_review', 'appeal_decided', 'closed')),
    to_status     text CHECK (to_status IN
                      ('open', 'under_review', 'decided', 'appealed', 'appeal_review', 'appeal_decided', 'closed')),
    occurred_at   timestamptz NOT NULL,
    actor_id      text REFERENCES reviewer,
    ref_id        text,
    reason        text,
    CHECK (from_status IS NULL OR to_status IS NOT NULL)
);
CREATE INDEX case_event_case_idx ON case_event (case_id, occurred_at, case_event_id);

-- ---------------------------------------------------------------- append-only enforcement
CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END $$;

DO $$
DECLARE history_table text;
BEGIN
    FOREACH history_table IN ARRAY ARRAY['case_event', 'evidence_item', 'decision', 'decision_evidence',
                                          'case_reviewer', 'similarity_report', 'integrity_rule']
    LOOP
        EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_change()',
                       history_table || '_no_change', history_table);
        EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_change()',
                       history_table || '_no_truncate', history_table);
    END LOOP;
END $$;

-- ---------------------------------------------------------------- views
-- Band of a score under one rule: <log no_action, <review log_only, <priority review, else priority_review.
CREATE FUNCTION score_band(score numeric, log_limit numeric, review_limit numeric, priority_limit numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN score >= priority_limit THEN 'priority_review'
                WHEN score >= review_limit   THEN 'review'
                WHEN score >= log_limit      THEN 'log_only'
                ELSE 'no_action' END
$$;

-- Current status and close time of each case: the latest status-changing event wins (ties by event id).
CREATE VIEW v_case_status AS
SELECT c.case_id,
       latest.to_status AS status,
       closed.occurred_at AS closed_at
FROM integrity_case c
LEFT JOIN LATERAL (
    SELECT e.to_status FROM case_event e
    WHERE e.case_id = c.case_id AND e.to_status IS NOT NULL
    ORDER BY e.occurred_at DESC, e.case_event_id DESC LIMIT 1
) latest ON true
LEFT JOIN LATERAL (
    SELECT e.occurred_at FROM case_event e
    WHERE e.case_id = c.case_id AND e.to_status = 'closed'
    ORDER BY e.occurred_at DESC, e.case_event_id DESC LIMIT 1
) closed ON latest.to_status = 'closed';

-- A flag is a report whose raw score reaches the review threshold of its rule. Exclusions larger of the two
-- decide the dismissal reason (a tie counts as quote_only).
CREATE VIEW v_flag AS
SELECT r.similarity_report_id, r.submission_id, s.learner_id, r.rule_id,
       r.raw_score, r.quoted_score, r.template_score, r.adjusted_score,
       score_band(r.adjusted_score, ru.log_threshold, ru.review_threshold, ru.priority_threshold) AS band,
       CASE WHEN r.adjusted_score >= ru.review_threshold THEN 'case_opened' ELSE 'dismissed' END AS outcome,
       CASE WHEN r.adjusted_score >= ru.review_threshold THEN NULL
            WHEN r.quoted_score >= r.template_score THEN 'quote_only'
            ELSE 'template_match' END AS dismissal_reason
FROM similarity_report r
JOIN integrity_rule ru ON ru.rule_id = r.rule_id
JOIN submission s ON s.submission_id = r.submission_id
WHERE r.raw_score >= ru.review_threshold;

-- Effective outcome: latest decision, overturned by an appeal -> no_violation, partially upheld -> inconclusive.
CREATE VIEW v_case_queue AS
SELECT c.case_id, l.learner_id, l.name AS learner_name, a.title AS assessment_title,
       r.adjusted_score,
       score_band(r.adjusted_score, ru.log_threshold, ru.review_threshold, ru.priority_threshold) AS band,
       st.status, st.closed_at, c.opened_at,
       COALESCE((SELECT array_agg(cr.reviewer_id ORDER BY cr.assigned_at, cr.reviewer_id)
                 FROM case_reviewer cr WHERE cr.case_id = c.case_id), '{}') AS assignee_ids,
       CASE WHEN ap.outcome = 'overturned' THEN 'no_violation'
            WHEN ap.outcome = 'partially_upheld' THEN 'inconclusive'
            ELSE d.outcome END AS effective_outcome
FROM integrity_case c
JOIN similarity_report r ON r.similarity_report_id = c.similarity_report_id
JOIN integrity_rule ru ON ru.rule_id = r.rule_id
JOIN submission s ON s.submission_id = r.submission_id
JOIN learner l ON l.learner_id = s.learner_id
JOIN assessment a ON a.assessment_id = s.assessment_id
JOIN v_case_status st ON st.case_id = c.case_id
LEFT JOIN appeal ap ON ap.case_id = c.case_id
LEFT JOIN LATERAL (
    SELECT x.outcome FROM decision x WHERE x.case_id = c.case_id
    ORDER BY x.decided_at DESC, x.decision_id DESC LIMIT 1
) d ON true;
