// Fixture: staff for the actor picker (contract: GET /reviewers).
import type { Reviewer } from '../types';

export const reviewers: Reviewer[] = [
  { reviewer_id: 'REV-000011', name: 'Dr. Amara Okafor', role: 'academic_reviewer', department: 'Computer Science' },
  { reviewer_id: 'REV-000012', name: 'Prof. Lars Eriksen', role: 'academic_reviewer', department: 'History' },
  { reviewer_id: 'REV-000004', name: 'Dr. Priya Raman', role: 'instructor', department: 'Computer Science' },
  { reviewer_id: 'REV-000021', name: 'Helen Marsh', role: 'academic_administrator', department: 'Registry' },
  { reviewer_id: 'REV-000031', name: 'Tomás Vidal', role: 'support_staff', department: 'Student Support' },
  { reviewer_id: 'REV-000013', name: 'Dr. Naledi Dube', role: 'academic_reviewer', department: 'Biology' },
];
