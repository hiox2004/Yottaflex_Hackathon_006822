// Step 4: write the test cases into the workflow as real submissions, flags and cases, so Cases can open, assign, decide
// and appeal them. Administrators only (the server enforces it too). Imported rows are kept in the lab session.
import { CircleCheck, Loader2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  labErrorMessage,
  type LabCase,
  type LabImported,
  type LabImportCase,
  type LabImportOutcome,
  type LabImportResponse,
  type LabResult,
} from '../../api/lab';
import { PERSONAS } from '../../lib/personas';
import { partitionImportable } from '../../lib/labSession';
import { useSession } from '../../session';
import { Badge, type Tone } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';

export interface ImportAccess {
  allowed: boolean;
  reason: string | null; // plain sentence shown when not allowed
}

const OUTCOME: Record<LabImportOutcome, { label: string; tone: Tone }> = {
  case_opened: { label: 'Case opened', tone: 'warning' },
  dismissed: { label: 'Dismissed flag', tone: 'neutral' },
  not_flagged: { label: 'Not flagged', tone: 'success' },
};

// The place to look in Cases: the opened case, or the dismissed list for a dismissed flag.
export function ImportedLink({ imported }: { imported: LabImported }) {
  const link = 'text-sm font-medium text-primary underline-offset-4 hover:underline';
  if (imported.outcome === 'case_opened' && imported.case_id) {
    return (
      <Link to={`/cases/${imported.case_id}`} state={{ from: '/lab' }} className={link}>
        Open case {imported.case_id}
      </Link>
    );
  }
  if (imported.outcome === 'dismissed') {
    return (
      <Link to="/cases?tab=dismissed" className={link}>
        View dismissed flags
      </Link>
    );
  }
  return <span className="text-sm text-muted-foreground">Nothing to open: no flag was raised.</span>;
}

// Explains why importing is blocked and offers the switch to the administrator.
export function ImportAccessNotice({ access }: { access: ImportAccess }) {
  const { changeActor } = useSession();
  const admin = PERSONAS.find((p) => p.role === 'academic_administrator');
  if (access.allowed || !access.reason) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/50 p-3 text-sm">
      <p>{access.reason}</p>
      {admin && (
        <Button size="sm" variant="outline" onClick={() => changeActor(admin.id)}>
          Switch to {admin.name} (Administrator)
        </Button>
      )}
    </div>
  );
}

type Scope = 'all' | 'passing';

interface Props {
  cases: LabCase[]; // the last run's cases (empty when they cannot be matched to the results)
  verdicts: LabResult['verdict'][];
  imported: LabImported[];
  access: ImportAccess;
  pending: boolean;
  error: unknown;
  result: LabImportResponse | undefined;
  onImport: (cases: LabImportCase[]) => void;
}

export function ImportPanel({ cases, verdicts, imported, access, pending, error, result, onImport }: Props) {
  const [scope, setScope] = useState<Scope>('all');
  const passing = cases.filter((_, i) => verdicts[i] === 'pass');
  const scoped = scope === 'all' ? cases : passing;
  const { importable, skipped } = partitionImportable(scoped, imported);
  const count = importable.length;

  const scopes: { value: Scope; label: string; n: number }[] = [
    { value: 'all', label: 'All cases', n: cases.length },
    { value: 'passing', label: 'Passing only', n: passing.length },
  ];
  const created = result?.created ?? [];
  const opened = created.filter((c) => c.outcome === 'case_opened').length;
  const dismissed = created.filter((c) => c.outcome === 'dismissed').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import into the workflow</CardTitle>
        <CardDescription>
          This writes real submissions, flags and cases to the database, so they can be opened, assigned, decided and appealed in Cases.
          <br />
          The demo data can be reloaded at any time with the seed command.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ImportAccessNotice access={access} />

        <div role="group" aria-label="Cases to import" className="flex flex-wrap gap-2">
          {scopes.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={scope === s.value ? 'default' : 'outline'}
              aria-pressed={scope === s.value}
              onClick={() => setScope(s.value)}
            >
              {s.label}
              <Badge tone="neutral" className="ml-1 bg-transparent">
                {s.n}
              </Badge>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!access.allowed || pending || count === 0} onClick={() => onImport(importable)} aria-busy={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {pending ? 'Importing...' : `Import ${count} ${count === 1 ? 'case' : 'cases'}`}
          </Button>
          {cases.length === 0 && <span className="text-sm text-muted-foreground">Run the cases first, then import them.</span>}
          {cases.length > 0 && count === 0 && <span className="text-sm text-muted-foreground">Every case in this scope is already imported.</span>}
        </div>

        {skipped.length > 0 && (
          <p role="status" className="flex items-start gap-2 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {skipped.length} already imported in this session will be skipped: <span className="font-mono text-xs">{skipped.join(', ')}</span>
            </span>
          </p>
        )}

        {error !== null && error !== undefined && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>{labErrorMessage(error)}</p>
          </div>
        )}

        {result && !error && created.length > 0 && (
          <p role="status" className="flex items-center gap-2 text-sm text-success">
            <CircleCheck className="size-4 shrink-0" />
            Imported {created.length} {created.length === 1 ? 'case' : 'cases'}: {opened} opened, {dismissed} dismissed,{' '}
            {created.length - opened - dismissed} not flagged. Cases is up to date.
          </p>
        )}

        {imported.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Imported</h3>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Lab id</TH>
                    <TH>Outcome</TH>
                    <TH>In Cases</TH>
                    <TH>Submission</TH>
                    <TH>Report</TH>
                  </TR>
                </THead>
                <TBody>
                  {imported.map((row) => (
                    <TR key={row.lab_id}>
                      <TD className="font-mono text-xs whitespace-nowrap">{row.lab_id}</TD>
                      <TD>
                        <Badge tone={OUTCOME[row.outcome].tone}>{OUTCOME[row.outcome].label}</Badge>
                      </TD>
                      <TD>
                        <ImportedLink imported={row} />
                      </TD>
                      <TD className="font-mono text-xs whitespace-nowrap">{row.submission_id}</TD>
                      <TD className="font-mono text-xs whitespace-nowrap">{row.similarity_report_id}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
