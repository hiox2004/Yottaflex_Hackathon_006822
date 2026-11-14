// Dismissed flags tab: read-only table. Auto-dismissal only favours the learner, so no human confirmation is needed.
import { useState } from 'react';
import { useDismissedFlags } from '../api/hooks';
import { DISMISSAL_LABEL, formatScore } from '../labels';
import { useSession } from '../session';
import { ErrorBanner } from './ErrorBanner';
import { SimilarityStrip } from './SimilarityStrip';
import { Button } from './ui/button';
import { Table, TBody, TD, TH, THead, TR } from './ui/table';

const PAGE = 50;
const COLUMNS = 7;

export function DismissedList() {
  const { actorId } = useSession();
  const [limit, setLimit] = useState(PAGE);
  const flags = useDismissedFlags(actorId, limit);
  if (flags.error) {
    return (
      <div className="p-4">
        <ErrorBanner error={flags.error} />
      </div>
    );
  }
  const items = flags.data?.items ?? [];
  const total = flags.data?.total ?? 0;
  const refreshing = flags.isFetching && !flags.isPending; // Load more in progress: keep rows, dim them

  return (
    <section aria-label="Dismissed flags">
      <p className="border-b p-4 text-sm text-muted-foreground">
        These flags are auto-dismissed because exclusions explain the overlap (properly quoted text or the shared assignment template), and
        dismissal only ever favours the learner. Nobody is flagged; they are listed here so the decision stays visible.
      </p>
      {flags.isPending && (
        <p role="status" className="sr-only">
          Loading dismissed flags…
        </p>
      )}
      <Table>
        <THead>
          <TR>
            <TH>Report</TH>
            <TH>Learner</TH>
            <TH>Raw</TH>
            <TH>Quoted</TH>
            <TH>Template</TH>
            <TH>Adjusted</TH>
            <TH>Reason</TH>
          </TR>
        </THead>
        <TBody className={refreshing ? 'opacity-50 transition-opacity' : undefined}>
          {flags.isPending &&
            Array.from({ length: 4 }, (_, i) => (
              <TR key={i} aria-hidden="true">
                {Array.from({ length: COLUMNS }, (_, j) => (
                  <TD key={j}>
                    <span className="block h-4 animate-pulse rounded bg-muted" />
                  </TD>
                ))}
              </TR>
            ))}
          {flags.data && items.length === 0 && (
            <TR>
              <TD colSpan={COLUMNS} className="py-10 text-center text-muted-foreground">
                No dismissed flags. Nothing to do here.
              </TD>
            </TR>
          )}
          {items.map((f) => (
            <TR key={f.similarity_report_id}>
              <TD className="font-mono text-xs whitespace-nowrap">{f.similarity_report_id}</TD>
              <TD className="font-mono text-xs whitespace-nowrap text-muted-foreground">{f.learner_id}</TD>
              <TD className="font-mono text-xs tabular-nums">{formatScore(f.raw_score)}</TD>
              <TD className="font-mono text-xs tabular-nums">{formatScore(f.quoted_score)}</TD>
              <TD className="font-mono text-xs tabular-nums">{formatScore(f.template_score)}</TD>
              <TD>
                <div className="flex items-center gap-3">
                  <span className="w-12 font-mono text-xs tabular-nums">{formatScore(f.adjusted_score)}</span>
                  <SimilarityStrip unexplained={f.adjusted_score} quoted={f.quoted_score} template={f.template_score} compact />
                </div>
              </TD>
              <TD className="min-w-56">{DISMISSAL_LABEL[f.dismissal_reason]}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {items.length < total && (
        <div className="flex items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
          <span>
            Showing {items.length} of {total}
          </span>
          <Button variant="outline" size="sm" disabled={flags.isFetching} onClick={() => setLimit(limit + PAGE)}>
            {flags.isFetching ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </section>
  );
}
