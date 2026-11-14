// Fixture: ten queue rows and two dismissed flags (contract: GET /queue, GET /flags).
import type { DismissedFlag, QueueRow } from '../types';

const row = (
  n: number,
  learner_name: string,
  assessment_title: string,
  adjusted_score: number,
  band: QueueRow['band'],
  status: QueueRow['status'],
  assignee_ids: string[],
  opened_at: string,
  needs_my_action: boolean,
): QueueRow => ({
  case_id: `CAS-2026-${String(n).padStart(6, '0')}`,
  learner_id: `LRN-${String(1000 + n)}`,
  learner_name,
  assessment_title,
  adjusted_score,
  band,
  status,
  assignee_ids,
  opened_at,
  needs_my_action,
});

export const queueRows: QueueRow[] = [
  row(17, 'Maya Okonkwo', 'CS201 Essay 2: Sorting', 0.842, 'priority_review', 'open', [], '2026-11-12T09:10:00Z', true),
  row(16, 'Jonas Weber', 'HIS110 Source analysis', 0.713, 'review', 'under_review', ['REV-000011'], '2026-11-11T14:30:00Z', true),
  row(15, 'Sofia Lindqvist', 'BIO150 Lab report 3', 0.655, 'review', 'under_review', ['REV-000013'], '2026-11-10T11:05:00Z', false),
  row(14, 'Ahmed Farouk', 'CS201 Essay 2: Sorting', 0.918, 'priority_review', 'decided', ['REV-000011'], '2026-10-20T08:00:00Z', true),
  row(13, 'Chloe Martin', 'HIS110 Source analysis', 0.624, 'review', 'appealed', ['REV-000012'], '2026-10-14T16:45:00Z', false),
  row(12, 'Ravi Menon', 'BIO150 Lab report 3', 0.771, 'review', 'appeal_review', ['REV-000013'], '2026-10-09T10:20:00Z', false),
  row(11, 'Elena Petrova', 'CS201 Essay 1: Recursion', 0.689, 'review', 'closed', ['REV-000011'], '2026-09-30T13:15:00Z', false),
  row(10, 'Daniel Osei', 'HIS110 Essay 1', 0.805, 'priority_review', 'appeal_decided', ['REV-000012'], '2026-09-22T09:40:00Z', true),
  row(9, 'Hana Sato', 'CS201 Essay 1: Recursion', 0.602, 'review', 'decided', ['REV-000011'], '2026-09-18T15:25:00Z', true),
  row(8, 'Luis Ortega', 'BIO150 Lab report 2', 0.941, 'priority_review', 'closed', ['REV-000013'], '2026-09-01T12:00:00Z', false),
];

export const dismissedFlags: DismissedFlag[] = [
  {
    similarity_report_id: 'SIM-2026-000412',
    submission_id: 'SUB-2026-000412',
    learner_id: 'LRN-1031',
    raw_score: 0.71,
    quoted_score: 0.52,
    template_score: 0.06,
    adjusted_score: 0.13,
    dismissal_reason: 'quote_only',
  },
  {
    similarity_report_id: 'SIM-2026-000377',
    submission_id: 'SUB-2026-000377',
    learner_id: 'LRN-1048',
    raw_score: 0.66,
    quoted_score: 0.04,
    template_score: 0.49,
    adjusted_score: 0.13,
    dismissal_reason: 'template_match',
  },
];
