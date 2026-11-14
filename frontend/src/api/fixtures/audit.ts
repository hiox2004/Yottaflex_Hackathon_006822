// Fixtures for the provisional /audit/metrics and /audit/validation shapes (synthetic data).
import type { AuditMetrics, ValidationSummary } from '../types';

export const auditMetrics: AuditMetrics = {
  dataset_hash: 'sha256:9f2c41b7e0a3d5c8',
  auditor: [
    { issue_type: 'AUTO_GUILT_WITHOUT_REVIEW', precision: 1, recall: 1, f1: 1, labelled: 6 },
    { issue_type: 'REVIEWER_CONFLICT', precision: 1, recall: 0.944, f1: 0.971, labelled: 18 },
    { issue_type: 'EVIDENCE_AFTER_DECISION_NO_HISTORY', precision: 1, recall: 1, f1: 1, labelled: 9 },
    { issue_type: 'APPEAL_CLOSED_NO_INDEPENDENT_REVIEW', precision: 1, recall: 1, f1: 1, labelled: 5 },
  ],
  triage: [
    { scenario: 'clean', cases: 0, flagged: 0, dismissed: 0 },
    { scenario: 'legitimate_quote', cases: 0, flagged: 0, dismissed: 41 },
    { scenario: 'shared_template', cases: 0, flagged: 0, dismissed: 33 },
    { scenario: 'false_positive', cases: 12, flagged: 12, dismissed: 0 },
    { scenario: 'genuine_copy', cases: 58, flagged: 58, dismissed: 0 },
  ],
};

export const validationSummary: ValidationSummary = {
  dataset_hash: 'sha256:9f2c41b7e0a3d5c8',
  counts: { learners: 500, staff: 60, assessments: 80, submissions: 2000, cases: 70 },
  checks: [
    { name: 'Every FK resolves', passed: true, violations: 0 },
    { name: 'Scores within 0-1', passed: true, violations: 0 },
    { name: 'Case status follows event order', passed: true, violations: 0 },
    { name: 'History is append-only', passed: true, violations: 0 },
  ],
  distributions: [
    { title: 'Cases by band', rows: [{ label: 'review', count: 49 }, { label: 'priority_review', count: 21 }] },
    { title: 'Cases by status', rows: [{ label: 'under_review', count: 22 }, { label: 'decided', count: 25 }, { label: 'closed', count: 23 }] },
  ],
};
