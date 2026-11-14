// What each role can do on the case lifecycle, in plain words. Copy only: the server still decides what is allowed.
import type { Role } from '../api/types';

export const ROLE_HELP: Record<Role, string[]> = {
  academic_administrator: [
    'Assign a reviewer to an open case, or an independent appeal reviewer once an appeal is filed.',
    'Reopen a decided case, file an appeal, and close a case when its record is complete.',
  ],
  support_staff: [
    'Add learner statements as evidence on a case.',
    'File an appeal on an adverse decision.',
  ],
  academic_reviewer: [
    'On cases assigned to you: add evidence and record a decision (no violation, violation confirmed or inconclusive).',
    'Reopen your own decided case, or decide an appeal when you are named its reviewer.',
  ],
  instructor: [
    'On cases assigned to you: add evidence and record a decision (no violation, violation confirmed or inconclusive).',
    'Reopen your own decided case, or decide an appeal when you are named its reviewer.',
  ],
  learner: [
    'You see your own cases only. You can add a statement while a case is open or under review and appeal a confirmed violation within the window.',
  ],
};

/** Reviewers and instructors only see the cases assigned to them. */
export const ASSIGNED_ONLY_ROLES: ReadonlySet<Role> = new Set<Role>(['academic_reviewer', 'instructor']);
