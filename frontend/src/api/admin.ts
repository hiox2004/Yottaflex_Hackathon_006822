// Administration workload (contract: GET /api/admin/workload, administrators only). Hand-written mirror of the contract.
import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';
import type { Band, Role } from './types';

export interface WorkloadTotals {
  unassigned: number;
  under_review: number;
  decided_waiting_close: number;
  appeals_waiting_reviewer: number;
  appeals_in_review: number;
  closed: number;
  dismissed_flags: number;
}

export interface ReviewerWorkload {
  reviewer_id: string;
  name: string;
  role: Role;
  department: string;
  active_cases: number;
  under_review: number;
  decided: number;
  appeals_to_decide: number;
  total_assigned_ever: number;
}

export interface SuggestedReviewer {
  reviewer_id: string;
  name: string;
  active_cases: number;
}

export interface UnassignedCase {
  case_id: string;
  learner_name: string;
  assessment_title: string;
  band: Band;
  adjusted_score: number;
  suggested: SuggestedReviewer[];
}

export interface AdminWorkload {
  generated_at: string;
  totals: WorkloadTotals;
  reviewers: ReviewerWorkload[];
  suggested_for_unassigned: UnassignedCase[];
}

/** A reviewer with this many active cases is flagged as overloaded. */
export const OVERLOAD_THRESHOLD = 8;

export const useWorkload = (actorId: string) =>
  useQuery({ queryKey: ['admin-workload', actorId], queryFn: () => apiGet<AdminWorkload>('/admin/workload') });
