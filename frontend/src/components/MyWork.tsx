// "Your work" on Overview: the cases the acting person must look at now, shaped by their role. Copy only; the server decides what is allowed.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueue, useReviewers, type QueueFilters } from '../api/hooks';
import type { QueueRow, Role, Status } from '../api/types';
import { BAND_LABEL, formatScore, humanise, NEXT_STEP, ROLE_LABEL, STATUS_LABEL } from '../labels';
import { useSession } from '../session';
import { BandBadge, StatusBadge } from './Badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const ADMINISTRATOR_ID = 'REV-000001';
const LEARNER_PREFIX = 'LRN-';

/** Learner copy: what the status means for them, without promising actions the server may refuse. */
const LEARNER_NEXT: Record<Status, string> = {
  open: 'Your case is waiting for a reviewer. No action is needed from you yet.',
  under_review: 'A reviewer is looking at your case.',
  decided: 'A decision has been recorded. Open the case to read it and the appeal options.',
  appealed: 'Your appeal is with an independent reviewer.',
  appeal_review: 'Your appeal is with an independent reviewer.',
  appeal_decided: 'The appeal has been decided. Open the case to read the outcome.',
  closed: 'This case is closed and its record is complete.',
};

const isRow = (row: QueueRow | null | undefined): row is QueueRow => Boolean(row && row.case_id);

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

function CaseItem({ row, detail }: { row: QueueRow; detail?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
      <div className="min-w-0 space-y-0.5">
        <Link
          to={`/cases/${row.case_id}`}
          state={{ from: '/' }}
          className="whitespace-nowrap font-mono text-xs text-primary hover:underline"
        >
          {row.case_id}
        </Link>
        <p className="truncate">
          {row.learner_name ?? 'Unknown learner'}{' '}
          <span className="text-muted-foreground">· {row.assessment_title ?? 'Untitled assessment'}</span>
        </p>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
      <div className="flex items-center gap-2 tabular-nums">
        <span>{typeof row.adjusted_score === 'number' ? formatScore(row.adjusted_score) : '-'}</span>
        {row.band in BAND_LABEL && <BandBadge band={row.band} />}
      </div>
    </li>
  );
}

/** One short list of cases from the queue. The hint is the primary next step for every row. */
function WorkList({ title, filters, limit, hint, empty }: { title: string; filters: QueueFilters; limit: number; hint: string; empty: string }) {
  const { actorId } = useSession();
  const queue = useQueue(actorId, filters, limit);
  const rows = (queue.data?.items ?? []).filter(isRow);

  return (
    <section aria-label={title} className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {queue.isLoading ? (
        <Skeleton rows={2} />
      ) : queue.isError ? (
        <p className="text-sm text-danger">Could not load these cases.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-md border bg-background">
          {rows.map((row) => (
            <CaseItem key={row.case_id} row={row} detail={<span className="font-medium text-primary">{hint}</span>} />
          ))}
        </ul>
      )}
    </section>
  );
}

const ADMIN_LISTS = [
  { title: 'Open cases waiting for a reviewer', filters: { status: 'open' }, hint: 'Assign a reviewer', empty: 'No open cases are waiting.' },
  { title: 'Appeals waiting for an independent reviewer', filters: { status: 'appealed' }, hint: 'Assign an appeal reviewer', empty: 'No appeals are waiting.' },
  { title: 'Decided cases to close', filters: { status: 'decided' }, hint: 'Cleared and inconclusive: close now. Fail: close once the appeal window ends', empty: 'No decided cases to close.' },
];

const SUPPORT_LISTS = [
  { title: 'Open or under-review cases that need evidence', filters: { status: 'open,under_review' }, hint: 'Add evidence', empty: 'No cases need evidence right now.' },
  { title: 'Violations confirmed that can be appealed', filters: { status: 'decided' }, hint: 'File an appeal if the decision is adverse', empty: 'No decided cases to appeal.' },
];

function ListGrid({ lists, columns }: { lists: typeof ADMIN_LISTS; columns: string }) {
  return (
    <div className={`grid gap-4 ${columns}`}>
      {lists.map((list) => (
        <WorkList key={list.title} title={list.title} filters={list.filters} limit={5} hint={list.hint} empty={list.empty} />
      ))}
    </div>
  );
}

/** Reviewers see only what an administrator assigned to them, grouped by status with the next step. */
function AssignedToYou() {
  const { actorId, changeActor } = useSession();
  const queue = useQueue(actorId, { needs_my_action: true }, 8);

  if (queue.isLoading) return <Skeleton />;
  if (queue.isError) return <p className="text-sm text-danger">Could not load your assigned cases.</p>;

  const rows = (queue.data?.items ?? []).filter(isRow);
  if (rows.length === 0) {
    return (
      <div className="space-y-3 rounded-md border border-dashed bg-background/60 p-4">
        <p className="text-sm">Nothing is assigned to you yet. Reviewers only see cases an administrator assigns to them.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => changeActor(ADMINISTRATOR_ID)}>
            Switch to an administrator (Vik Silva) to assign you a case
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/cases">Browse all cases</Link>
          </Button>
        </div>
      </div>
    );
  }

  const groups = new Map<string, QueueRow[]>();
  for (const row of rows) groups.set(row.status, [...(groups.get(row.status) ?? []), row]);

  return (
    <div className="space-y-4">
      {[...groups].map(([status, items]) => (
        <section key={status} aria-label={STATUS_LABEL[status as Status] ?? humanise(status)} className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {STATUS_LABEL[status as Status] ?? humanise(status)}
            <span className="text-muted-foreground tabular-nums">({items.length})</span>
          </h3>
          <ul className="divide-y rounded-md border bg-background">
            {items.map((row) => (
              <CaseItem
                key={row.case_id}
                row={row}
                detail={
                  <>
                    <span className="font-medium">Next:</span> {NEXT_STEP[row.status as Status] ?? 'Open the case to see the next step.'}
                  </>
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Learners see only their own cases (the server filters); the copy says what each status means for them. */
function LearnerCases() {
  const { actorId } = useSession();
  const queue = useQueue(actorId, {}, 8);

  if (queue.isLoading) return <Skeleton />;
  if (queue.isError) return <p className="text-sm text-danger">Could not load your cases.</p>;

  const rows = (queue.data?.items ?? []).filter(isRow);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">You have no cases. Nothing has been flagged for you.</p>;
  }

  return (
    <ul className="divide-y rounded-md border bg-background">
      {rows.map((row) => (
        <CaseItem
          key={row.case_id}
          row={row}
          detail={
            <span className="flex flex-wrap items-center gap-2">
              {row.status in STATUS_LABEL && <StatusBadge status={row.status} />}
              <span>{LEARNER_NEXT[row.status as Status] ?? 'Open the case for details.'}</span>
            </span>
          }
        />
      ))}
    </ul>
  );
}

function WorkCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your work</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function MyWork() {
  const { actorId } = useSession();
  const reviewers = useReviewers(actorId);

  if (actorId.startsWith(LEARNER_PREFIX)) {
    return (
      <WorkCard subtitle="Learner">
        <LearnerCases />
      </WorkCard>
    );
  }

  if (reviewers.isError) {
    return (
      <WorkCard subtitle="Your role">
        <p className="text-sm text-danger">Could not load your role, so your work cannot be shown.</p>
      </WorkCard>
    );
  }
  if (reviewers.isPending) {
    return (
      <WorkCard subtitle="Loading your role">
        <Skeleton rows={2} />
      </WorkCard>
    );
  }

  const role: Role | undefined = reviewers.data?.find((r) => r.reviewer_id === actorId)?.role;
  if (!role) {
    return (
      <WorkCard subtitle="Unknown role">
        <p className="text-sm text-muted-foreground">Your account has no role here, so there is no case work to show.</p>
      </WorkCard>
    );
  }

  switch (role) {
    case 'academic_administrator':
      return (
        <WorkCard subtitle={ROLE_LABEL[role]}>
          <ListGrid lists={ADMIN_LISTS} columns="lg:grid-cols-3" />
        </WorkCard>
      );
    case 'support_staff':
      return (
        <WorkCard subtitle={ROLE_LABEL[role]}>
          <ListGrid lists={SUPPORT_LISTS} columns="lg:grid-cols-2" />
        </WorkCard>
      );
    case 'academic_reviewer':
    case 'instructor':
      return (
        <WorkCard subtitle={ROLE_LABEL[role]}>
          <AssignedToYou />
        </WorkCard>
      );
    default:
      return (
        <WorkCard subtitle={ROLE_LABEL[role] ?? 'Your role'}>
          <p className="text-sm text-muted-foreground">No case work is listed for this role here.</p>
        </WorkCard>
      );
  }
}
