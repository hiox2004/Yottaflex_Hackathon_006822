// Fixture: administrator workload (contract: GET /admin/workload). Reviewer ids match fixtures/reviewers.ts.
import type { AdminWorkload } from '../admin';

export const adminWorkload: AdminWorkload = {
  generated_at: '2026-11-14T09:00:00Z',
  totals: {
    unassigned: 2,
    under_review: 3,
    decided_waiting_close: 4,
    appeals_waiting_reviewer: 1,
    appeals_in_review: 1,
    closed: 12,
    dismissed_flags: 3,
  },
  reviewers: [
    { reviewer_id: 'REV-000011', name: 'Dr. Amara Okafor', role: 'academic_reviewer', department: 'Computer Science', active_cases: 9, under_review: 6, decided: 2, appeals_to_decide: 1, total_assigned_ever: 21 },
    { reviewer_id: 'REV-000012', name: 'Prof. Lars Eriksen', role: 'academic_reviewer', department: 'History', active_cases: 5, under_review: 3, decided: 2, appeals_to_decide: 0, total_assigned_ever: 14 },
    { reviewer_id: 'REV-000013', name: 'Dr. Naledi Dube', role: 'academic_reviewer', department: 'Biology', active_cases: 7, under_review: 4, decided: 3, appeals_to_decide: 0, total_assigned_ever: 17 },
    { reviewer_id: 'REV-000004', name: 'Dr. Priya Raman', role: 'instructor', department: 'Computer Science', active_cases: 0, under_review: 0, decided: 0, appeals_to_decide: 0, total_assigned_ever: 3 },
    { reviewer_id: 'REV-000021', name: 'Helen Marsh', role: 'academic_administrator', department: 'Registry', active_cases: 0, under_review: 0, decided: 0, appeals_to_decide: 0, total_assigned_ever: 0 },
    { reviewer_id: 'REV-000031', name: 'Tomás Vidal', role: 'support_staff', department: 'Student Support', active_cases: 2, under_review: 2, decided: 0, appeals_to_decide: 0, total_assigned_ever: 4 },
  ],
  suggested_for_unassigned: [
    {
      case_id: 'CAS-2026-000201',
      learner_name: 'Ravi Mehta',
      assessment_title: 'Essay 2: Industrial history',
      band: 'priority_review',
      adjusted_score: 0.742,
      suggested: [
        { reviewer_id: 'REV-000012', name: 'Prof. Lars Eriksen', active_cases: 5 },
        { reviewer_id: 'REV-000004', name: 'Dr. Priya Raman', active_cases: 0 },
      ],
    },
    {
      case_id: 'CAS-2026-000202',
      learner_name: 'Inez Laurent',
      assessment_title: 'Lab report: Cell division',
      band: 'review',
      adjusted_score: 0.381,
      suggested: [{ reviewer_id: 'REV-000013', name: 'Dr. Naledi Dube', active_cases: 7 }],
    },
  ],
};
