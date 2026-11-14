// Cases page: pill tabs (each a server filter with its count), a band and "assigned to me" toolbar, and a table of results.
// Tab, band and "assigned to me" all live in the URL (?tab=, ?band=, ?mine=1) so reload, back and shared links keep the same view.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueue, useReviewers, useRules, type QueueFilters } from '../api/hooks';
import type { Band, QueueCounts } from '../api/types';
import { CaseRow } from '../components/CaseRow';
import { RoleBanner } from '../components/RoleBanner';
import { DismissedList } from '../components/DismissedList';
import { ErrorBanner } from '../components/ErrorBanner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Select } from '../components/ui/field';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BAND_LABEL } from '../labels';
import { cn } from '../lib/utils';
import { useSession } from '../session';

const PAGE = 50;
const COLUMNS = 8;
const BANDS: Band[] = ['priority_review', 'review'];

interface TabDef {
  key: 'needs' | 'all' | 'unassigned' | 'under_review' | 'awaiting_appeal' | 'decided' | 'closed' | 'dismissed';
  label: string;
  /** One line under the tab list: what this view means. */
  help: string;
  /** Shown when the tab's list is empty and no band filter explains it. */
  empty?: string;
  filter: QueueFilters;
  /** Count from the server's aggregate counts. Tabs without one get their own lightweight query instead. */
  count?: (c: QueueCounts) => number;
}

const NEEDS_TAB: TabDef = {
  key: 'needs',
  label: 'Needs you',
  help: 'Cases where you have an action available right now.',
  filter: { needs_my_action: true },
  count: (c) => c.needs_me,
};

const TABS: TabDef[] = [
  NEEDS_TAB,
  { key: 'all', help: 'Every case, whatever its stage.', label: 'All cases', filter: {}, count: (c) => c.under_review + c.awaiting_appeal + c.decided + c.closed },
  {
    key: 'unassigned',
    help: 'Flagged cases waiting for an administrator to assign a reviewer.',
    label: 'Unassigned',
    empty: 'No cases are waiting for a reviewer to be assigned.',
    filter: { status: 'open' },
  },
  {
    key: 'under_review',
    help: 'A reviewer is assigned and weighing the evidence.',
    label: 'Under review',
    empty: 'No case has an assigned reviewer right now.',
    filter: { status: 'under_review' },
  },
  { key: 'awaiting_appeal', help: 'A learner has appealed; an independent appeal reviewer decides it.', label: 'Awaiting appeal', filter: { status: 'appealed,appeal_review' }, count: (c) => c.awaiting_appeal },
  { key: 'decided', help: 'A decision was recorded; the appeal window may still be open.', label: 'Decided', filter: { status: 'decided,appeal_decided' }, count: (c) => c.decided },
  { key: 'closed', help: 'Final. History is kept.', label: 'Closed', filter: { status: 'closed' }, count: (c) => c.closed },
  { key: 'dismissed', help: 'Automatically dismissed because quoted or template text explains the overlap. No case is opened and nothing is recorded against the learner.', label: 'Dismissed flags', filter: {}, count: (c) => c.dismissed_flags },
];

/** Unknown or missing ?tab= falls back to "Needs you". */
const findTab = (value: string | null): TabDef => TABS.find((t) => t.key === value) ?? NEEDS_TAB;
/** Unknown ?band= values are ignored, so the select always shows a real option. */
const findBand = (value: string | null): Band | '' => BANDS.find((b) => b === value) ?? '';

export function CasesPage() {
  const { actorId } = useSession();
  const [params, setParams] = useSearchParams();
  const explicitTab = params.get('tab');
  const tab = findTab(explicitTab);
  const band = findBand(params.get('band'));
  const mineOnly = params.get('mine') === '1';
  const [limit, setLimit] = useState(PAGE);

  /** Sets or clears URL params (null clears) and keeps every other param, so the view survives navigation. */
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
    setLimit(PAGE);
  };

  const filters: QueueFilters = {
    ...tab.filter,
    ...(band && { band }),
    ...(mineOnly && { assigned_to: actorId }),
  };
  const queue = useQueue(actorId, filters, limit);
  // The two tabs split the server's under_review count (which mixes open and under_review), so each gets its own total.
  const unassignedTotal = useQueue(actorId, { status: 'open' }, 1).data?.total;
  const reviewingTotal = useQueue(actorId, { status: 'under_review' }, 1).data?.total;
  const tabCount = (t: TabDef): number | undefined => {
    if (t.key === 'unassigned') return unassignedTotal;
    if (t.key === 'under_review') return reviewingTotal;
    return counts && t.count?.(counts);
  };
  const reviewers = useReviewers(actorId);
  const rules = useRules(actorId);
  const names = useMemo(() => new Map((reviewers.data ?? []).map((r) => [r.reviewer_id, r.name])), [reviewers.data]);
  const activeRule = rules.data?.find((r) => r.effective_to === null) ?? null;
  const actorName = names.get(actorId) ?? actorId;

  const counts = queue.data?.counts;
  // A filter change or Load more refetches with the previous rows still on screen: dim them until the new page lands.
  const refreshing = queue.isFetching && !queue.isPending;
  const rows = queue.data?.items ?? [];
  const total = queue.data?.total ?? 0;
  // The default tab is only "implicit" when the URL names no tab; we never switch tabs silently for the user.
  const implicitNeeds = tab.key === 'needs' && explicitTab === null;

  return (
    <div className="space-y-6">
      <RoleBanner page="cases" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A flag is not a finding. Every case here needs a human decision before anything is recorded against a learner.
        </p>
      </div>

      <Tabs value={tab.key} onValueChange={(key) => update({ tab: key })}>
        <TabsList aria-label="Case views" className="h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-2">
              {t.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums transition-opacity',
                  t.key === 'needs' ? 'bg-primary/15 text-primary' : 'bg-background',
                  queue.isFetching && 'opacity-50',
                )}
              >
                {tabCount(t) ?? '–'}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="-mt-3 text-sm text-muted-foreground">{tab.help}</p>

      {tab.key === 'dismissed' ? (
        <Card>
          <DismissedList />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 border-b p-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Band</span>
              <Select className="w-44" value={band} onChange={(e) => update({ band: e.target.value || null })}>
                <option value="">All bands</option>
                {BANDS.map((b) => (
                  <option key={b} value={b}>
                    {BAND_LABEL[b]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={mineOnly}
                onChange={(e) => update({ mine: e.target.checked ? '1' : null })}
              />
              Assigned to me
            </label>
          </div>

          {queue.error && (
            <div className="p-4">
              <ErrorBanner error={queue.error} />
            </div>
          )}

          {queue.isPending && (
            <p role="status" className="sr-only">
              Loading cases…
            </p>
          )}
          <Table>
            <THead>
              <TR>
                <TH>Case</TH>
                <TH>Learner</TH>
                <TH>Assessment</TH>
                <TH>Adjusted score</TH>
                <TH>Band</TH>
                <TH>Status</TH>
                <TH>Reviewers</TH>
                <TH>Opened</TH>
              </TR>
            </THead>
            <TBody className={refreshing ? 'opacity-50 transition-opacity' : undefined}>
              {queue.isPending &&
                Array.from({ length: 5 }, (_, i) => (
                  <TR key={i} aria-hidden="true">
                    {Array.from({ length: COLUMNS }, (_, j) => (
                      <TD key={j}>
                        <span className="block h-4 animate-pulse rounded bg-muted" />
                      </TD>
                    ))}
                  </TR>
                ))}
              {queue.data && rows.length === 0 && (
                <TR>
                  <TD colSpan={COLUMNS} className="py-10 text-center text-muted-foreground">
                    {implicitNeeds ? (
                      <div className="flex flex-col items-center gap-3">
                        <p>{`Nothing is assigned to ${actorName}. Switch the actor (sidebar) to someone with work, or open All cases.`}</p>
                        <Button variant="outline" size="sm" onClick={() => update({ tab: 'all' })}>
                          Show all cases
                        </Button>
                      </div>
                    ) : tab.key === 'needs' ? (
                      'Nothing is waiting on you right now. Pick “All cases” to browse, or switch actor to see another role’s work.'
                    ) : tab.empty && !band && !mineOnly ? (
                      tab.empty
                    ) : (
                      'No cases match these filters. Clear the band filter or try another tab.'
                    )}
                  </TD>
                </TR>
              )}
              {rows.map((row) => (
                <CaseRow key={row.case_id} row={row} rule={activeRule} names={names} />
              ))}
            </TBody>
          </Table>

          {queue.data && (
            <div className="flex items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
              <span>
                Showing {rows.length} of {total}
              </span>
              {rows.length < total && (
                <Button variant="outline" size="sm" disabled={queue.isFetching} onClick={() => setLimit(limit + PAGE)}>
                  {queue.isFetching ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
