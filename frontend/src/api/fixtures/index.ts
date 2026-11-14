// Fixture router: answers GET paths from hand-written data when VITE_USE_FIXTURES is not "false".
import { ApiError } from '../errors';
import type { Page } from '../types';
import { adminWorkload } from './admin';
import { auditMetrics, validationSummary } from './audit';
import { caseDetails, eligibleFor, findings, timelineFor } from './cases';
import { dismissedFlags, queueRows } from './queue';
import { reviewers } from './reviewers';
import { rules } from './rules';

function paged<T>(items: T[], query: URLSearchParams): Page<T> {
  const offset = Number(query.get('offset') ?? 0);
  const limit = Number(query.get('limit') ?? 50);
  return { items: items.slice(offset, offset + limit), total: items.length };
}

const count = (statuses: string[]) => queueRows.filter((r) => statuses.includes(r.status)).length;

/** Counts cover all cases and ignore the filters, like the server's. */
const queueCounts = () => ({
  needs_me: queueRows.filter((r) => r.needs_my_action).length,
  under_review: count(['open', 'under_review']),
  awaiting_appeal: count(['appealed', 'appeal_review']),
  decided: count(['decided', 'appeal_decided']),
  closed: count(['closed']),
  dismissed_flags: dismissedFlags.length,
});

function queue(query: URLSearchParams): Page<unknown> & { counts: unknown } {
  const statuses = query.get('status')?.split(',');
  const band = query.get('band');
  const assignedTo = query.get('assigned_to');
  const needsMe = query.get('needs_my_action') === 'true';
  const rows = queueRows.filter(
    (r) =>
      (!statuses || statuses.includes(r.status)) &&
      (!band || r.band === band) &&
      (!assignedTo || r.assignee_ids.includes(assignedTo)) &&
      (!needsMe || r.needs_my_action),
  );
  return { ...paged(rows, query), counts: queueCounts() };
}

export function fixtureGet(path: string): unknown {
  const [route = '', search = ''] = path.split('?');
  const query = new URLSearchParams(search);
  if (route === '/reviewers') return reviewers;
  if (route === '/rules') return rules;
  if (route === '/admin/workload') return adminWorkload;
  if (route === '/queue') return queue(query);
  if (route === '/flags') return paged(dismissedFlags, query);
  const found = route.match(/^\/cases\/([^/]+)(\/timeline|\/eligible-reviewers)?$/);
  if (found) {
    const detail = caseDetails.find((c) => c.case_id === found[1]);
    if (!detail) throw new ApiError(404, 'NOT_FOUND', `Case ${found[1]} was not found.`);
    if (found[2] === '/timeline') return timelineFor(detail);
    if (found[2]) return eligibleFor(query.get('purpose') ?? 'case');
    return detail;
  }
  if (route === '/audit/metrics') return auditMetrics;
  if (route === '/audit/validation') return validationSummary;
  if (route === '/audit/findings') {
    const caseId = query.get('case_id');
    const items = caseId ? findings.filter((f) => f.case_id === caseId) : findings;
    const counts: Record<string, number> = {};
    for (const f of items) counts[f.issue_type] = (counts[f.issue_type] ?? 0) + 1;
    return { counts, findings: items };
  }
  throw new ApiError(404, 'NOT_FOUND', `No fixture for ${route}`);
}
