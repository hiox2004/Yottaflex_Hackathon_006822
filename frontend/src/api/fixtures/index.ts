// Fixture router: answers GET paths from hand-written data when VITE_USE_FIXTURES is not "false".
import { ApiError } from '../errors';
import type { Page } from '../types';
import { dismissedFlags, queueRows } from './queue';
import { reviewers } from './reviewers';
import { rules } from './rules';

function paged<T>(items: T[], query: URLSearchParams): Page<T> {
  const offset = Number(query.get('offset') ?? 0);
  const limit = Number(query.get('limit') ?? 50);
  return { items: items.slice(offset, offset + limit), total: items.length };
}

function queue(query: URLSearchParams): Page<unknown> {
  const status = query.get('status');
  const band = query.get('band');
  const assignedTo = query.get('assigned_to');
  const rows = queueRows.filter(
    (r) =>
      (!status || r.status === status) &&
      (!band || r.band === band) &&
      (!assignedTo || r.assignee_ids.includes(assignedTo)),
  );
  return paged(rows, query);
}

export function fixtureGet(path: string): unknown {
  const [route = '', search = ''] = path.split('?');
  const query = new URLSearchParams(search);
  if (route === '/reviewers') return reviewers;
  if (route === '/rules') return rules;
  if (route === '/queue') return queue(query);
  if (route === '/flags') return paged(dismissedFlags, query);
  throw new ApiError(404, 'NOT_FOUND', `No fixture for ${route}`);
}
