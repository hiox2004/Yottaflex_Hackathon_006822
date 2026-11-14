// Step 3: last-run line, summary cards (total, passed, failed, no expectation), filter chips, then one accordion row per case.
import { useMemo } from 'react';
import type { LabResponse } from '../../api/lab';
import type { LabImported } from '../../api/lab';
import { caseKey, importedById, type LabFilter } from '../../lib/labSession';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { CaseResult } from './CaseResult';
import type { ImportAccess } from './ImportPanel';

const FILTERS: { value: LabFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fail', label: 'Failed' },
  { value: 'pass', label: 'Passed' },
];

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn('text-2xl font-semibold tabular-nums', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger')}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

interface Props {
  response: LabResponse;
  ranAt: string | null;
  filter: LabFilter;
  expanded: string[];
  onFilterChange: (filter: LabFilter) => void;
  onToggle: (key: string) => void;
  imported: LabImported[];
  access: ImportAccess;
  importing: boolean;
  onImportOne: (index: number) => void;
}

export function ResultsPanel({
  response,
  ranAt,
  filter,
  expanded,
  onFilterChange,
  onToggle,
  imported,
  access,
  importing,
  onImportOne,
}: Props) {
  const total = response.results.length;
  const importedMap = useMemo(() => importedById(imported), [imported]);

  // Keep each case's index in the full run so its expanded state survives filtering.
  const visible = useMemo(
    () => response.results.map((result, index) => ({ result, index })).filter((row) => filter === 'all' || row.result.verdict === filter),
    [filter, response.results],
  );

  const count = (f: LabFilter) => (f === 'all' ? total : response.results.filter((r) => r.verdict === f).length);
  const when = ranAt ? new Date(ranAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'unknown time';

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Results</h2>
        <p className="text-sm font-medium tabular-nums">
          Last run {when} · {total} cases · {response.passed} passed, {response.failed} failed
        </p>
        <p className="text-sm text-muted-foreground">
          Evaluated with rule {response.rule.rule_id} version {response.rule.version}. Nothing was saved.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total cases" value={total} />
        <Stat label="Passed" value={response.passed} tone="success" />
        <Stat label="Failed" value={response.failed} tone="danger" />
        <Stat label="No expectation" value={response.no_expectation} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cases</CardTitle>
          <CardDescription>Open a case to see its exception checks and the steps the engine took.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div role="group" aria-label="Filter cases" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={filter === f.value ? 'default' : 'outline'}
                aria-pressed={filter === f.value}
                onClick={() => onFilterChange(f.value)}
              >
                {f.label}
                <Badge tone="neutral" className="ml-1 bg-transparent">
                  {count(f.value)}
                </Badge>
              </Button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No cases match this filter.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map(({ result, index }) => {
                const key = caseKey(index, result.id);
                return (
                  <CaseResult
                    key={key}
                    result={result}
                    open={expanded.includes(key)}
                    onToggle={() => onToggle(key)}
                    imported={importedMap.get(result.id)}
                    access={access}
                    importing={importing}
                    onImport={() => onImportOne(index)}
                  />
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
