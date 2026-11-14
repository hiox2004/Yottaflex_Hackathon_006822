// react-query hooks over the client. The actor id is part of every key so a switch refetches (needs_my_action changes).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from './client';
import type { DismissedFlag, Page, QueueRow, Reviewer, Rule } from './types';

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

// The queue loads the newest `limit` rows; tiles and filters then work on them (needs_my_action is not a server filter).
export const useQueue = (actorId: string, limit: number) =>
  useQuery({
    queryKey: ['queue', actorId, limit],
    queryFn: () => apiGet<Page<QueueRow>>(`/queue${qs({ limit })}`),
    placeholderData: keepPreviousData,
  });

export const useDismissedFlags = (actorId: string, limit: number) =>
  useQuery({
    queryKey: ['flags', actorId, limit],
    queryFn: () => apiGet<Page<DismissedFlag>>(`/flags${qs({ outcome: 'dismissed', limit })}`),
    placeholderData: keepPreviousData,
  });
