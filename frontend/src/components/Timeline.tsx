// Append-only history. Oldest first by default, 'Newest first' toggles it. A null actor is the system.
// Entries recorded after the page was first loaded are highlighted briefly so a reviewer sees their change land.
import { useEffect, useRef, useState } from 'react';
import { useReviewers } from '../api/hooks';
import type { TimelineEvent } from '../api/types';
import { EVENT_LABEL, formatDateTime, ROLE_LABEL, STATUS_LABEL } from '../labels';
import { useSession } from '../session';
import { ErrorBanner } from './ErrorBanner';
import { Badge, type Tone } from './ui/badge';
import { Card } from './ui/card';

const FADE_AFTER_MS = 4000;

/** Outcome chip for decision and appeal entries, read from the server's detail wording. Null for anything else. */
function outcomeChip(e: TimelineEvent): { label: string; tone: Tone } | null {
  const d = e.detail ?? '';
  if (e.event_type === 'decision_recorded') {
    if (d === 'No violation found') return { label: 'Cleared', tone: 'success' };
    if (d === 'Violation confirmed') return { label: 'Failed', tone: 'danger' };
    if (d === 'Inconclusive') return { label: 'Inconclusive', tone: 'warning' };
  }
  if (e.event_type === 'appeal_decided') {
    // Check 'partially' before 'upheld': 'partially upheld' contains 'upheld'.
    if (d.includes('overturned')) return { label: 'Overturned', tone: 'success' };
    if (d.includes('partially')) return { label: 'Partly upheld', tone: 'warning' };
    if (d.includes('upheld')) return { label: 'Upheld', tone: 'danger' };
  }
  return null;
}

/** 'just now', '2 min ago', '3 h ago', '5 d ago'; older than a week falls back to the absolute date. */
export function formatRelative(iso: string, now: number): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDateTime(iso);
}

export function Timeline({ events, error }: { events: TimelineEvent[] | undefined; error?: unknown }) {
  const { actorId } = useSession();
  const reviewers = useReviewers(actorId);
  const roleById = new Map((reviewers.data ?? []).map((r) => [r.reviewer_id, r.role]));

  const [newestFirst, setNewestFirst] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [faded, setFaded] = useState<ReadonlySet<number>>(() => new Set());
  const baseline = useRef<number | null>(null);
  const scheduled = useRef(new Set<number>());
  const fadeTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Tick so relative times stay current while the page is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Pending fade timers are cleared when the timeline unmounts.
  useEffect(() => {
    const pending = fadeTimers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  // The first load sets the baseline; later event ids are new to this page view.
  if (baseline.current === null && events) baseline.current = Math.max(0, ...events.map((e) => e.event_id));

  useEffect(() => {
    if (!events || baseline.current === null) return;
    for (const e of events) {
      if (e.event_id <= baseline.current || scheduled.current.has(e.event_id)) continue;
      scheduled.current.add(e.event_id);
      const timer = setTimeout(() => {
        fadeTimers.current.delete(timer);
        setFaded((prev) => new Set(prev).add(e.event_id));
      }, FADE_AFTER_MS);
      fadeTimers.current.add(timer);
    }
  }, [events]);

  if (!events) {
    return error ? (
      <ErrorBanner error={error} />
    ) : (
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Loading history…
      </p>
    );
  }

  const ordered = newestFirst ? [...events].reverse() : events;
  return (
    <Card role="region" aria-label="Timeline" className="p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Timeline</h2>
        <button
          type="button"
          aria-pressed={newestFirst}
          onClick={() => setNewestFirst((v) => !v)}
          className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {newestFirst ? 'Newest first: on' : 'Newest first'}
        </button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">History is append-only: nothing here can be edited or removed.</p>
      <ol className="flex flex-col gap-4 border-l pl-5">
        {ordered.map((e) => {
          const isNew = baseline.current !== null && e.event_id > baseline.current && !faded.has(e.event_id);
          const role = e.actor_id ? roleById.get(e.actor_id) : undefined;
          const chip = outcomeChip(e);
          return (
            <li
              key={e.event_id}
              className={`relative flex flex-col gap-1 rounded-md text-sm transition-colors duration-1000 before:absolute before:-left-[1.45rem] before:top-1.5 before:size-2 before:rounded-full before:bg-primary ${isNew ? 'bg-primary/10 px-2 py-1' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <strong className="font-semibold">{EVENT_LABEL[e.event_type]}</strong>
                {isNew && <Badge tone="primary">New</Badge>}
                {e.from_status && e.to_status && (
                  <Badge tone="neutral">
                    {STATUS_LABEL[e.from_status]} → {STATUS_LABEL[e.to_status]}
                  </Badge>
                )}
                {!e.from_status && e.to_status && <Badge tone="neutral">{STATUS_LABEL[e.to_status]}</Badge>}
              </div>
              {chip ? (
                <div>
                  <Badge tone={chip.tone} title={e.detail ?? undefined} aria-label={`Outcome: ${e.detail}`}>
                    {chip.label}
                  </Badge>
                </div>
              ) : (
                e.detail && <div className="font-medium text-foreground">{e.detail}</div>
              )}
              <div className="text-xs text-muted-foreground">
                {e.actor_name ?? 'system (triage)'}
                {role && <span> · {ROLE_LABEL[role]}</span>}
                {' · '}
                <time dateTime={e.occurred_at} title={formatDateTime(e.occurred_at)}>
                  {formatDateTime(e.occurred_at)} ({formatRelative(e.occurred_at, now)})
                </time>
                {e.ref_id && <span className="font-mono whitespace-nowrap"> · {e.ref_id}</span>}
              </div>
              {e.reason && <div>{e.reason}</div>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
