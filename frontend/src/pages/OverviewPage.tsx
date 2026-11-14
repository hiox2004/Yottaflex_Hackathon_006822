// Overview: KPI cards linking to the queue, dataset volume vs brief targets, distribution charts, due-process health and scenario coverage.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuditMetrics, useAuditValidation, useFindings, useQueue } from '../api/hooks';
import type { FindingsResponse, IssueType, QueueCounts } from '../api/types';
import { MyWork } from '../components/MyWork';
import { PersonaGuide } from '../components/PersonaGuide';
import { RoleBanner } from '../components/RoleBanner';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useSession } from '../session';

// Local shapes: the validation summary is being reshaped on the backend, so read it defensively.
interface LocalValidation {
  dataset_hash?: string;
  counts?: Record<string, number>;
  checks?: { name: string; description?: string; violations: number }[];
  distributions?: Record<string, Record<string, number>>;
}

interface LocalMetrics {
  triage?: { scenario: string; cases: number; flagged: number; dismissed: number }[];
}

const SEED = 20261022;
const TARGETS = { submission: 10000, flags: 1000, integrity_case: 300 } as const;
const AUDIT_ISSUES: IssueType[] = [
  'AUTO_GUILT_WITHOUT_REVIEW',
  'REVIEWER_CONFLICT',
  'EVIDENCE_AFTER_DECISION_NO_HISTORY',
  'APPEAL_CLOSED_NO_INDEPENDENT_REVIEW',
];
const CHART_COLOR = 'var(--primary)';

const toRows = (dist?: Record<string, number>) => Object.entries(dist ?? {}).map(([name, count]) => ({ name, count }));

function Note({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return <p className={danger ? 'text-sm text-danger' : 'text-sm text-muted-foreground'}>{children}</p>;
}

/** Each KPI opens the matching Cases tab; keys must exist in CasesPage's TABS. */
type CaseTabKey = 'needs' | 'under_review' | 'awaiting_appeal' | 'decided' | 'closed' | 'dismissed';

function KpiCard({ label, value, tab }: { label: string; value?: number; tab: CaseTabKey }) {
  return (
    <Link to={`/cases?tab=${tab}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardContent className="space-y-1 p-5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tabular-nums">{value ?? '-'}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function BarChartCard({ title, description, data }: { title: string; description: string; data: { name: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <Note>No data.</Note>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" width={40} />
                <Tooltip cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewPage() {
  const { actorId } = useSession();
  const queue = useQueue(actorId, {}, 1);
  const validation = useAuditValidation(actorId);
  const metrics = useAuditMetrics(actorId);
  const findings = useFindings(actorId);

  const counts = queue.data?.counts as Partial<QueueCounts> | undefined;
  const v = validation.data as unknown as LocalValidation | undefined;
  const vCounts = v?.counts ?? {};
  const dist = v?.distributions ?? {};
  const checks = v?.checks ?? [];
  const passed = checks.filter((c) => c.violations === 0).length;
  const triage = (metrics.data as unknown as LocalMetrics | undefined)?.triage ?? [];
  const issueCounts = (findings.data as FindingsResponse | undefined)?.counts ?? {};

  return (
    <>
      <div className="mb-6 space-y-6">
        <RoleBanner page="overview" />
        <MyWork />
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Live state of the integrity queue, the seeded dataset and the audit checks.</p>
      </div>

      {queue.isError && <Note danger>Could not load queue counts.</Note>}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <KpiCard label="Needs you" value={counts?.needs_me} tab="needs" />
        <KpiCard label="Under review" value={counts?.under_review} tab="under_review" />
        <KpiCard label="Awaiting appeal" value={counts?.awaiting_appeal} tab="awaiting_appeal" />
        <KpiCard label="Decided" value={counts?.decided} tab="decided" />
        <KpiCard label="Closed" value={counts?.closed} tab="closed" />
        <KpiCard label="Dismissed flags" value={counts?.dismissed_flags} tab="dismissed" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Dataset volume</CardTitle>
            <CardDescription>Seed {SEED}. Counts compared with the brief's targets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {validation.isError && <Note danger>Could not load dataset counts.</Note>}
            {(Object.keys(TARGETS) as (keyof typeof TARGETS)[]).map((key) => {
              const actual = vCounts[key];
              const match = actual === TARGETS[key];
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{key.replace('_', ' ')}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {actual ?? '-'} / {TARGETS[key]}
                    {match && <Badge tone="success">match</Badge>}
                  </span>
                </div>
              );
            })}
            <p className="pt-2 text-xs text-muted-foreground">
              Hash <span className="font-mono">{(v?.dataset_hash ?? '').slice(0, 12) || '-'}</span>
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <BarChartCard title="Cases by band" description="Open cases by triage band." data={toRows(dist.cases_by_band)} />
          <BarChartCard title="Cases by status" description="Lifecycle status of every case." data={toRows(dist.cases_by_status)} />
          <BarChartCard title="Flags by band" description="All similarity flags by adjusted band." data={toRows(dist.flags_by_band)} />
          <BarChartCard title="Decisions by outcome" description="Recorded decision outcomes." data={toRows(dist.decisions_by_outcome)} />
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Due-process health</CardTitle>
            <CardDescription>Validation checks passed and live auditor findings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validation.isError && <Note danger>Could not load validation checks.</Note>}
            <p className="text-sm">
              <span className="text-2xl font-semibold tabular-nums">{passed}</span>
              <span className="text-muted-foreground"> of {checks.length} validation checks passed</span>
            </p>
            <div className="space-y-2 text-sm">
              {AUDIT_ISSUES.map((issue) => (
                <div key={issue} className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs text-muted-foreground">{issue}</span>
                  <span className="tabular-nums">{issueCounts[issue] ?? 0}</span>
                </div>
              ))}
            </div>
            <Link to="/audit" className="text-sm font-medium text-primary hover:underline">
              Open audit
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenario coverage</CardTitle>
            <CardDescription>How each seeded scenario was triaged.</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.isError && <Note danger>Could not load scenario coverage.</Note>}
            {triage.length === 0 && !metrics.isError ? (
              <Note>No scenarios reported.</Note>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Scenario</th>
                    <th className="pb-2 text-right font-medium">Cases</th>
                    <th className="pb-2 text-right font-medium">Flagged</th>
                    <th className="pb-2 text-right font-medium">Dismissed</th>
                  </tr>
                </thead>
                <tbody>
                  {triage.map((row) => (
                    <tr key={row.scenario} className="border-t">
                      <td className="py-2">{row.scenario.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right tabular-nums">{row.cases}</td>
                      <td className="py-2 text-right tabular-nums">{row.flagged}</td>
                      <td className="py-2 text-right tabular-nums">{row.dismissed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <PersonaGuide />
      </section>
    </>
  );
}
