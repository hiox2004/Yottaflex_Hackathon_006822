// Which pages each role may open, in the UI. Copy-level guard only: the backend stays the authority.
import type { Role } from '../api/types';

export type PageKey = 'overview' | 'guide' | 'cases' | 'lab' | 'audit' | 'rules' | 'admin';

export const PAGE_LABEL: Record<PageKey, string> = {
  overview: 'Overview',
  guide: 'Guide',
  cases: 'Cases',
  lab: 'Test Lab',
  audit: 'Audit',
  rules: 'Rules',
  admin: 'Administration',
};

const LEARNER_PAGES: ReadonlySet<PageKey> = new Set<PageKey>(['overview', 'guide', 'cases', 'rules']);

/** Every role the UI knows, in the order the card lists them. */
export const ALL_ROLES: Role[] = ['learner', 'instructor', 'academic_reviewer', 'academic_administrator', 'support_staff'];

export const canOpen = (role: Role, page: PageKey): boolean => {
  if (page === 'admin') return role === 'academic_administrator';
  return role === 'learner' ? LEARNER_PAGES.has(page) : true;
};

/** Lab import (uploading cases into the workflow) is for administrators only. */
export const canImportLab = (role: Role): boolean => role === 'academic_administrator';

export const rolesFor = (page: PageKey): Role[] => ALL_ROLES.filter((role) => canOpen(role, page));

export const pagesFor = (role: Role): PageKey[] => (Object.keys(PAGE_LABEL) as PageKey[]).filter((page) => canOpen(role, page));

/** Learner ids are issued with the LRN- prefix and carry no staff record. */
export const isLearnerId = (actorId: string): boolean => actorId.startsWith('LRN-');
