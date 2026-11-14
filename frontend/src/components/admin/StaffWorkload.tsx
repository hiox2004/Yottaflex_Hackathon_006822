// Staff workload: role filter and search, a table of active load, and a bar chart of the top 15 by active cases.
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OVERLOAD_THRESHOLD, type ReviewerWorkload } from '../../api/admin';
import type { Role } from '../../api/types';
import { ROLE_LABEL } from '../../labels';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/field';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';

const STAFF_ROLES: Role[] = ['academic_administrator', 'academic_reviewer', 'instructor', 'support_staff'];
const CHART_LIMIT = 15;
const CHART_COLOR = 'var(--primary)';

const byLoad = (a: ReviewerWorkload, b: ReviewerWorkload) => b.active_cases - a.active_cases || a.name.localeCompare(b.name);

export function StaffWorkload({ reviewers }: { reviewers: ReviewerWorkload[] }) {
  const [role, setRole] = useState<Role | 'all'>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviewers
      .filter((r) => STAFF_ROLES.includes(r.role))
      .filter((r) => role === 'all' || r.role === role)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.department.toLowerCase().includes(q))
      .sort(byLoad);
  }, [reviewers, role, query]);

  const chartRows = rows.slice(0, CHART_LIMIT).map((r) => ({ name: r.name, active: r.active_cases }));
  const chartHeight = Math.max(160, chartRows.length * 32 + 24);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff workload</CardTitle>
        <CardDescription>
          Active cases per person. {OVERLOAD_THRESHOLD}+ active cases is flagged as overloaded; zero active cases means available for new work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by role">
            {(['all', ...STAFF_ROLES] as const).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={role === key ? 'default' : 'outline'}
                aria-pressed={role === key}
                onClick={() => setRole(key)}
                className="h-7 rounded-full px-3 text-xs"
              >
                {key === 'all' ? 'All roles' : ROLE_LABEL[key]}
              </Button>
            ))}
          </div>
          <Input
            type="search"
            aria-label="Search staff by name or department"
            placeholder="Search name or department"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:w-64"
          />
        </div>

        {chartRows.length > 0 && (
          <div role="img" aria-label={`Bar chart of active cases for the top ${chartRows.length} staff`}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="active" name="Active cases" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff match these filters.</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH className="text-right">Active</TH>
                <TH className="text-right">Under review</TH>
                <TH className="text-right">Decided</TH>
                <TH className="text-right">Appeals</TH>
                <TH className="text-right">Ever assigned</TH>
                <TH>Load</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const overloaded = r.active_cases >= OVERLOAD_THRESHOLD;
                return (
                  <TR key={r.reviewer_id}>
                    <TD>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.department}</div>
                    </TD>
                    <TD className="text-muted-foreground">{ROLE_LABEL[r.role]}</TD>
                    <TD className={cn('text-right font-medium tabular-nums', overloaded && 'text-warning')}>{r.active_cases}</TD>
                    <TD className="text-right tabular-nums">{r.under_review}</TD>
                    <TD className="text-right tabular-nums">{r.decided}</TD>
                    <TD className="text-right tabular-nums">{r.appeals_to_decide}</TD>
                    <TD className="text-right tabular-nums">{r.total_assigned_ever}</TD>
                    <TD>
                      {overloaded ? (
                        <Badge tone="warning">Overloaded</Badge>
                      ) : r.active_cases === 0 ? (
                        <Badge tone="success">Available</Badge>
                      ) : null}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
