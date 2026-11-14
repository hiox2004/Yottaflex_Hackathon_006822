// react-query hooks over the client. The actor id is part of every key so a switch refetches (needs_my_action changes).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from './client';
import type {
  CaseDetail,
  DismissedFlag,
  EligibleReviewer,
  FindingsResponse,
  Page,
  QueuePageData,
  Reviewer,
  Rule,
  TimelineEvent,
} from './types';

function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const useReviewers = (actorId: string) =>
  useQuery({ queryKey: ['reviewers', actorId], queryFn: () => apiGet<Reviewer[]>('/reviewers') });

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
    placeholderData: keepPreviousData,
  });

export const useDismissedFlags = (actorId: string, limit: number) =>
  useQuery({
    queryKey: ['flags', actorId, limit],
    queryFn: () => apiGet<Page<DismissedFlag>>(`/flags${qs({ outcome: 'dismissed', limit })}`),
    placeholderData: keepPreviousData,
  });

export const useCase = (actorId: string, caseId: string) =>
  useQuery({ queryKey: ['case', actorId, caseId], queryFn: () => apiGet<CaseDetail>(`/cases/${caseId}`) });

export const useTimeline = (actorId: string, caseId: string) =>
  useQuery({ queryKey: ['timeline', actorId, caseId], queryFn: () => apiGet<TimelineEvent[]>(`/cases/${caseId}/timeline`) });

export const useEligible = (actorId: string, caseId: string, purpose: 'case' | 'appeal', enabled: boolean) =>
  useQuery({
    queryKey: ['eligible', actorId, caseId, purpose],
    queryFn: () => apiGet<EligibleReviewer[]>(`/cases/${caseId}/eligible-reviewers?purpose=${purpose}`),
    enabled,
  });

export const useFindings = (actorId: string, caseId?: string) =>
  useQuery({
    queryKey: ['findings', actorId, caseId ?? 'all'],
    queryFn: () => apiGet<FindingsResponse>(`/audit/findings${qs({ case_id: caseId })}`),
  });
