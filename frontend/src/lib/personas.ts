// Quick-switch personas (one per role that drives the workflow, plus a learner). Ids are seeded ids from the API.
import type { Reviewer, Role } from '../api/types';
import { ROLE_LABEL } from '../labels';

export interface Persona {
  id: string;
  role: Role;
  name: string;
  does: string;
}

export const PERSONAS: Persona[] = [
  { id: 'REV-000001', role: 'academic_administrator', name: 'Vik Silva', does: 'Assigns reviewers and closes cases' },
  { id: 'REV-000007', role: 'support_staff', name: 'Sam Gupta', does: 'Adds evidence and files appeals' },
  { id: 'REV-000018', role: 'instructor', name: 'Ben Novak', does: 'Reviews the cases assigned to him' },
  { id: 'REV-000048', role: 'academic_reviewer', name: 'Tara Abara', does: 'Decides assigned cases with a rationale' },
  // Seeded learner with a confirmed violation (CAS-2026-000294), so the appeal step is live in the demo.
  { id: 'LRN-001502', role: 'learner', name: 'Ivan Lopez', does: 'Adds a statement and appeals a confirmed violation' },
];

/** What each role can do, one sentence each. Copy only: the server still decides what is allowed. */
export const ROLE_DOES: Record<Role, string> = {
  academic_administrator: 'Assigns reviewers and appeal reviewers, and closes cases. Counts are the same for everyone in this role.',
  support_staff: 'Adds evidence to cases and files appeals on violation findings. Counts are the same for everyone in this role.',
  academic_reviewer: 'Records a decision with a rationale on cases assigned to them.',
  instructor: 'Records a decision with a rationale on cases assigned to them.',
  learner: 'Sees your own cases. Adds a statement, and appeals a confirmed violation inside the window.',
};

/** Scope line for the role banner: who the counts and the queue cover for each role. */
export const ROLE_SCOPE: Record<Role, string> = {
  academic_administrator: 'Counts are the same for everyone in this role, because administrators act on any case.',
  support_staff: 'Counts are the same for everyone in this role, because support staff act on any case.',
  academic_reviewer: 'Reviewers only act on cases assigned to them.',
  instructor: 'Instructors only act on cases assigned to them.',
  learner: 'Learners see only their own cases.',
};

/** Roles whose work is limited to cases assigned to them (sidebar footnote). */
export const ASSIGNED_ONLY: Role[] = ['academic_reviewer', 'instructor'];

/** Display order for roles in the staff list. */
export const ROLE_ORDER: Role[] = ['academic_administrator', 'support_staff', 'academic_reviewer', 'instructor'];

/** Learner ids look like LRN-000123 (contract). Used when a learner is chosen from search, because learners are not in the staff list. */
export const isLearnerId = (id: string): boolean => /^LRN-\d{6}$/.test(id);

/** Who the acting id is, from the staff list, a persona, or the learner id pattern. Name falls back to the id. */
export function resolveActor(actorId: string, staff?: Reviewer[]): { name: string; role?: Role; department?: string } {
  const row = staff?.find((r) => r.reviewer_id === actorId);
  const persona = PERSONAS.find((p) => p.id === actorId);
  return {
    name: row?.name ?? persona?.name ?? actorId,
    role: row?.role ?? persona?.role ?? (isLearnerId(actorId) ? 'learner' : undefined),
    department: row?.department,
  };
}

export const firstName = (name: string): string => name.split(' ')[0] ?? name;

/** Up to two initials from a name, for avatar circles. */
export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || '?';

/** Staff sorted by role (ROLE_ORDER), then name, then id. Returns a new array. */
export const sortStaff = (staff: Reviewer[]): Reviewer[] =>
  [...staff].sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      a.name.localeCompare(b.name) ||
      a.reviewer_id.localeCompare(b.reviewer_id),
  );

/** True when every word of the query appears in the person's name, id, role, role label or department. */
export const matchesStaff = (reviewer: Reviewer, query: string): boolean => {
  const haystack = [reviewer.name, reviewer.reviewer_id, reviewer.role, ROLE_LABEL[reviewer.role], reviewer.department]
    .join(' ')
    .toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
};
