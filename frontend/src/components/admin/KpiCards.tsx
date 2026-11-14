// KPI tiles from the workload totals. Each tile links to the Cases tab that holds the same cases.
import { Link } from 'react-router-dom';
import type { WorkloadTotals } from '../../api/admin';
import { Card, CardContent } from '../ui/card';

interface Tile {
  label: string;
  value: number;
  hint: string;
  to: string;
}

export function KpiCards({ totals }: { totals: WorkloadTotals }) {
  const tiles: Tile[] = [
    { label: 'Unassigned', value: totals.unassigned, hint: 'Waiting for a reviewer', to: '/cases?tab=unassigned' },
    { label: 'Under review', value: totals.under_review, hint: 'A reviewer is weighing the evidence', to: '/cases?tab=under_review' },
    { label: 'Decided, waiting to close', value: totals.decided_waiting_close, hint: 'Decision recorded', to: '/cases?tab=decided' },
    { label: 'Appeals waiting for a reviewer', value: totals.appeals_waiting_reviewer, hint: 'Appeal filed, no appeal reviewer yet', to: '/cases?tab=awaiting_appeal' },
    { label: 'Appeals in review', value: totals.appeals_in_review, hint: 'An appeal reviewer is deciding', to: '/cases?tab=awaiting_appeal' },
    { label: 'Closed', value: totals.closed, hint: 'Final, history kept', to: '/cases?tab=closed' },
    { label: 'Dismissed flags', value: totals.dismissed_flags, hint: 'Quoted or template text, no case opened', to: '/cases?tab=dismissed' },
  ];
  return (
    <section aria-labelledby="admin-kpis" className="space-y-3">
      <h2 id="admin-kpis" className="text-base font-semibold">
        Where things stand
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link to={tile.to} className="block rounded-lg outline-primary hover:shadow-sm focus-visible:outline-2">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="space-y-1 p-4">
                  <div className="text-xs font-medium text-muted-foreground">{tile.label}</div>
                  <div className="text-2xl font-semibold tabular-nums">{tile.value}</div>
                  <div className="text-xs text-muted-foreground">{tile.hint}</div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
