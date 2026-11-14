// Audit: live findings (each links to its case), auditor accuracy, and the validation summary with distribution charts.
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuditMetrics, useAuditValidation, useFindings } from '../api/hooks';
import type { IssueType, ValidationSummary } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { humanise, SCENARIO_LABEL } from '../labels';
import { useSession } from '../session';

const ISSUE_LABEL: Record<IssueType, string> = {
  AUTO_GUILT_WITHOUT_REVIEW: 'Confirmed without human review',
  REVIEWER_CONFLICT: 'Reviewer with a conflict of interest',
  EVIDENCE_AFTER_DECISION_NO_HISTORY: 'Evidence changed after decision, no reopen',
  APPEAL_CLOSED_NO_INDEPENDENT_REVIEW: 'Appeal closed without independent review',
};
const ISSUE_TYPES = Object.keys(ISSUE_LABEL) as IssueType[];
const AUDIT_TABS = ['findings', 'accuracy', 'validation'] as const;
type AuditTab = (typeof AUDIT_TABS)[number];
/** Unknown or missing ?tab= falls back to "Live findings". */
const findAuditTab = (value: string | null): AuditTab => AUDIT_TABS.find((t) => t === value) ?? 'findings';

const score = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(3) : '-');
const count = (n: number | undefined) => (typeof n === 'number' ? String(n) : '-');
const entries = <T,>(record: Record<string, T> | undefined | null): [string, T][] => Object.entries(record ?? {});
/** Sorts numeric buckets numerically ('0.1' before '0.2'), other labels alphabetically. */
const byKey = ([a]: [string, unknown], [b]: [string, unknown]) => a.localeCompare(b, undefined, { numeric: true });

function FindingsTab() {
  const { actorId } = useSession();
  const location = useLocation();
  const findings = useFindings(actorId);
  const list = findings.data?.findings ?? [];
  const groups = ISSUE_TYPES.map((type) => ({
    type,
    rows: list.filter((f) => f.issue_type === type),
  }));
  return (
    <div className="grid gap-4">
      <ErrorBanner error={findings.error} />
      {findings.isPending && <p className="text-sm text-muted-foreground">Loading findings...</p>}
      {findings.data && list.length === 0 && <p className="text-sm text-muted-foreground">The auditor found no failures.</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map(({ type, rows }) => (
          <Card key={type}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{ISSUE_LABEL[type]}</CardTitle>
                <CardDescription className="font-mono text-xs">{type}</CardDescription>
              </div>
              <Badge tone={rows.length > 0 ? 'danger' : 'success'}>{findings.data?.counts?.[type] ?? rows.length}</Badge>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">None found.</p>
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Case</TH>
                      <TH>Record</TH>
                      <TH>Detail</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {rows.map((f) => (
                      <TR key={`${f.issue_type}-${f.entity_id}`}>
                        <TD>
                          <Link
                            className="font-mono whitespace-nowrap text-primary underline-offset-4 hover:underline"
                            to={`/cases/${f.case_id}`}
                            state={{ from: location.pathname + location.search }}
                          >
                            {f.case_id}
                          </Link>
                        </TD>
                        <TD className="font-mono text-xs whitespace-nowrap">{f.entity_id}</TD>
                        <TD className="min-w-56">{f.detail}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AccuracyTab() {
  const { actorId } = useSession();
  const metrics = useAuditMetrics(actorId);
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        <strong>Synthetic data.</strong> These scores show that the rules and the auditor cover the generated scenarios. They do not show how
        well either generalises to real submissions.
      </div>
      <ErrorBanner error={metrics.error} />
      {metrics.isPending && <p className="text-sm text-muted-foreground">Loading accuracy...</p>}
      {metrics.data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Auditor precision, recall and F1</CardTitle>
              <CardDescription>Measured against labelled synthetic cases, one row per issue type.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <tr>
                    <TH>Issue type</TH>
                    <TH className="text-right">Precision</TH>
                    <TH className="text-right">Recall</TH>
                    <TH className="text-right">F1</TH>
                    <TH className="text-right">Labelled</TH>
                  </tr>
                </THead>
                <TBody>
                  {(metrics.data.auditor ?? []).map((m) => (
                    <TR key={m.issue_type}>
                      <TD>{ISSUE_LABEL[m.issue_type] ?? humanise(m.issue_type)}</TD>
                      <TD className="text-right font-mono">{score(m.precision)}</TD>
                      <TD className="text-right font-mono">{score(m.recall)}</TD>
                      <TD className="text-right font-mono">{score(m.f1)}</TD>
                      <TD className="text-right font-mono">{count(m.labelled)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Triage by scenario</CardTitle>
              <CardDescription>How each generated scenario was flagged or dismissed by the rules.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <tr>
                    <TH>Scenario</TH>
                    <TH className="text-right">Cases</TH>
                    <TH className="text-right">Flagged</TH>
                    <TH className="text-right">Dismissed</TH>
                  </tr>
                </THead>
                <TBody>
                  {(metrics.data.triage ?? []).map((t) => (
                    <TR key={t.scenario}>
                      <TD>
                        {SCENARIO_LABEL[t.scenario] ?? humanise(t.scenario)}
                        <span className="ml-2 font-mono text-xs whitespace-nowrap text-muted-foreground">{t.scenario}</span>
                      </TD>
                      <TD className="text-right font-mono">{count(t.cases)}</TD>
                      <TD className="text-right font-mono">{count(t.flagged)}</TD>
                      <TD className="text-right font-mono">{count(t.dismissed)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
          <p className="font-mono text-xs text-muted-foreground">Dataset {metrics.data.dataset_hash}</p>
        </>
      )}
    </div>
  );
}

function DistributionChart({ rows }: { rows: [string, number][] }) {
  const data = rows.map(([label, value]) => ({ label: humanise(label), value: typeof value === 'number' ? value : 0 }));
  return (
    <div className="h-48 text-primary">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 6 }}
          />
          <Bar dataKey="value" name="Count" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ValidationTab({ data }: { data: ValidationSummary }) {
  const checks = data.checks ?? [];
  const failed = checks.filter((c) => c.violations > 0).length;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Integrity checks</CardTitle>
          <CardDescription>
            {checks.length - failed} of {checks.length} passed. A check passes when it finds zero violations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {checks.map((c) => {
              const passed = c.violations === 0;
              return (
                <li key={c.name} className="flex items-start justify-between gap-3 py-2.5">
                  <div>
                    <div className="font-mono text-sm">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{c.description}</div>
                  </div>
                  <Badge tone={passed ? 'success' : 'danger'}>{passed ? 'Pass' : `Fail (${c.violations})`}</Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record counts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TBody>
                {entries(data.counts).map(([name, n]) => (
                  <TR key={name}>
                    <TD>{humanise(name)}</TD>
                    <TD className="text-right font-mono">{count(n)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        {entries(data.distributions)
          .sort(byKey)
          .map(([name, dist]) => {
            const rows = entries(dist).sort(byKey);
            return (
              <Card key={name}>
                <CardHeader>
                  <CardTitle>{humanise(name)}</CardTitle>
                </CardHeader>
                <CardContent>
                  {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : <DistributionChart rows={rows} />}
                </CardContent>
              </Card>
            );
          })}
      </div>

      <p className="font-mono text-xs text-muted-foreground">
        Dataset {data.dataset_hash} · {data.violations ?? 0} total violations
      </p>
    </div>
  );
}

function ValidationPanel() {
  const { actorId } = useSession();
  const validation = useAuditValidation(actorId);
  return (
    <div>
      <ErrorBanner error={validation.error} />
      {validation.isPending && <p className="text-sm text-muted-foreground">Loading validation...</p>}
      {validation.data && <ValidationTab data={validation.data} />}
    </div>
  );
}

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const tab = findAuditTab(params.get('tab'));
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The auditor is a separate program that re-reads the database and looks for due-process failures. Each finding links to its case, where
          the matching fairness gate shows red.
        </p>
      </header>
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value })}>
        <TabsList>
          <TabsTrigger value="findings">Live findings</TabsTrigger>
          <TabsTrigger value="accuracy">Auditor accuracy</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>
        <TabsContent value="findings">
          <FindingsTab />
        </TabsContent>
        <TabsContent value="accuracy">
          <AccuracyTab />
        </TabsContent>
        <TabsContent value="validation">
          <ValidationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
