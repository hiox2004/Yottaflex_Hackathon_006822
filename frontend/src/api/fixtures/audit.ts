// Fixtures for /audit/metrics and /audit/validation, abridged from a live backend run (synthetic data).
import type { AuditMetrics, ValidationSummary } from '../types';

export const auditMetrics: AuditMetrics = {
  dataset_hash: '750df00c4691e96b865d70a52c944ec2ff395ebe15c6bf9e55281da16d349720',
  auditor: [
    { issue_type: 'AUTO_GUILT_WITHOUT_REVIEW', precision: 1, recall: 1, f1: 1, labelled: 8 },
    { issue_type: 'REVIEWER_CONFLICT', precision: 1, recall: 1, f1: 1, labelled: 10 },
    { issue_type: 'EVIDENCE_AFTER_DECISION_NO_HISTORY', precision: 1, recall: 1, f1: 1, labelled: 8 },
    { issue_type: 'APPEAL_CLOSED_NO_INDEPENDENT_REVIEW', precision: 1, recall: 1, f1: 1, labelled: 6 },
  ],
  triage: [
    { scenario: 'clean', cases: 0, flagged: 0, dismissed: 0 },
    { scenario: 'legitimate_quote', cases: 0, flagged: 360, dismissed: 360 },
    { scenario: 'shared_template', cases: 0, flagged: 310, dismissed: 310 },
    { scenario: 'false_positive', cases: 90, flagged: 90, dismissed: 0 },
    { scenario: 'genuine_copy', cases: 210, flagged: 240, dismissed: 30 },
  ],
};

export const validationSummary: ValidationSummary = {
  dataset_hash: '750df00c4691e96b865d70a52c944ec2ff395ebe15c6bf9e55281da16d349720',
  counts: { learner: 2000, reviewer: 64, assessment: 151, submission: 10000, similarity_report: 10000, flags: 1000, integrity_case: 300, decision: 147 },
  checks: [
    { name: 'report_per_submission', description: 'every submission has exactly one similarity report (1:1)', violations: 0 },
    { name: 'rule_in_force', description: "the report's rule was in force when the submission was made", violations: 0 },
    { name: 'triage_reconciliation', description: 'a case exists exactly for flags whose adjusted band is review or priority_review', violations: 0 },
  ],
  violations: 0,
  distributions: {
    cases_by_band: { priority_review: 66, review: 234 },
    cases_by_status: { appeal_decided: 9, appeal_review: 9, appealed: 9, closed: 69, decided: 43, open: 69, under_review: 92 },
    effective_outcomes: { inconclusive: 16, no_violation: 30, undecided: 153, violation_confirmed: 101 },
    'flag_outcomes': { case_opened: 300, 'dismissed (quote_only)': 375, 'dismissed (template_match)': 325 },
    adjusted_score_by_tenth: { '0.0': 4981, '0.1': 3001, '0.2': 1058, '0.3': 290, '0.4': 185, '0.5': 185, '0.6': 126, '0.7': 95, '0.8': 55, '0.9': 24 },
  },
};
