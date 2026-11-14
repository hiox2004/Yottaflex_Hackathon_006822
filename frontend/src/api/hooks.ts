// react-query hooks over the client. The actor id is part of every key so a switch refetches (needs_my_action changes).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from './client';
import type {
  AuditMetrics,
  CaseDetail,
  DismissedFlag,
  EligibleReviewer,
  FindingsResponse,
  Page,
  QueuePageData,
  Reviewer,
  Role,
  Rule,
  TimelineEvent,
  ValidationSummary,
} from './types';

function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const useReviewers = (actorId: string) =>
  useQuery({ queryKey: ['reviewers', actorId], queryFn: () => apiGet<Reviewer[]>('/reviewers') });

/** A person who can act in the app: a staff member or a learner (contract: GET /api/actors, no actor header needed). */
export interface Actor {
  actor_id: string;
  name: string;
  role: Role;
  department: string;
}

/** Search for switching the acting person. Runs only once the query has text; the server returns at most `limit` rows. */
export const useActors = (role: 'learner' | 'staff', q: string, limit = 20) =>
  useQuery({
    queryKey: ['actors', role, q, limit],
    queryFn: () => apiGet<Actor[]>(`/actors${qs({ role, q: q.trim(), limit })}`),
    enabled: q.trim() !== '',
    placeholderData: keepPreviousData,
  });

export const useRules = (actorId: string) =>
  useQuery({ queryKey: ['rules', actorId], queryFn: () => apiGet<Rule[]>('/rules') });

export interface QueueFilters {
  status?: string; // comma-separated list for tiles that span two statuses (see contract change request)
  needs_my_action?: boolean;
  band?: string;
  assigned_to?: string;
}

export const useQueue = (actorId: string, filters: QueueFilters, limit: number) =>
  useQuery({
    queryKey: ['queue', actorId, filters, limit],
    queryFn: () => apiGet<QueuePageData>(`/queue${qs({ ...filters, limit })}`),
    // Keep the old rows only for the same person: after a switch, show loading instead of the previous actor's rows.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === actorId ? prev : undefined),
  });

export const useDismissedFlags = (actorId: string, limit: number) =>
  useQuery({
    queryKey: ['flags', actorId, limit],
    queryFn: () => apiGet<Page<DismissedFlag>>(`/flags${qs({ outcome: 'dismissed', limit })}`),
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === actorId ? prev : undefined),
  });

export const useCase = (actorId: string, caseId: string) =>
  useQuery({ queryKey: ['case', actorId, caseId], queryFn: () => apiGet<CaseDetail>(`/cases/${caseId}`) });

export const useTimeline = (actorId: string, caseId: string) =>
  useQuery({ queryKey: ['timeline', actorId, caseId], queryFn: () => apiGet<TimelineEvent[]>(`/cases/${caseId}/timeline`) });

export const useEligible = (actorId: string, caseId: string, purpose: 'case' | 'appeal') =>
  useQuery({
    queryKey: ['eligible', actorId, caseId, purpose],
    queryFn: () => apiGet<EligibleReviewer[]>(`/cases/${caseId}/eligible-reviewers?purpose=${purpose}`),
  });

export const useAuditMetrics = (actorId: string) =>
  useQuery({ queryKey: ['audit-metrics', actorId], queryFn: () => apiGet<AuditMetrics>('/audit/metrics') });

export const useAuditValidation = (actorId: string) =>
  useQuery({ queryKey: ['audit-validation', actorId], queryFn: () => apiGet<ValidationSummary>('/audit/validation') });

export const useFindings = (actorId: string, caseId?: string) =>
  useQuery({
    queryKey: ['findings', actorId, caseId ?? 'all'],
    queryFn: () => apiGet<FindingsResponse>(`/audit/findings${qs({ case_id: caseId })}`),
  });

/** One write: the response is the updated CaseDetail, which replaces the cached case; dependent views refetch. */
export function useCaseWrite(actorId: string, caseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => apiPost<CaseDetail>(`/cases/${caseId}${path}`, body),
    onSuccess: (detail) => {
      client.setQueryData(['case', actorId, caseId], detail);
      // Audit and admin pages read the same case data, so they refresh now rather than after their 15 s stale time.
      for (const key of [
        ['timeline', actorId, caseId],
        ['findings'],
        ['eligible', actorId, caseId],
        ['queue'],
        ['audit-metrics'],
        ['audit-validation'],
        ['admin-workload'], // the key admin.ts actually uses (useWorkload); there is no ['workload'] key
      ]) {
        void client.invalidateQueries({ queryKey: key });
      }
    },
    // A refused write (409 etc.) leaves the server state unchanged: re-read the case so buttons match reality.
    onError: () => {
      void client.invalidateQueries({ queryKey: ['case', actorId, caseId] });
      void client.invalidateQueries({ queryKey: ['timeline', actorId, caseId] });
    },
  });
}
