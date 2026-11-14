// Typed HTTP client for /api. Throws ApiError from the error envelope; answers from fixtures in fixture mode.
import { getActorId } from './actor';
import { ApiError } from './errors';
import { fixtureGet } from './fixtures';
import type { ApiErrorBody } from './types';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';
export const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES !== 'false';

async function toError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiError(response.status, 'HTTP_ERROR', `The server answered ${response.status}.`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  if (USE_FIXTURES) return fixtureGet(path) as T;
  const response = await fetch(BASE + path, { headers: { 'X-Actor-Id': getActorId() } });
  if (!response.ok) throw await toError(response);
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (USE_FIXTURES) throw new ApiError(501, 'FIXTURE_MODE', 'Writes need the live API (VITE_USE_FIXTURES=false).');
  const response = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'X-Actor-Id': getActorId(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await toError(response);
  return (await response.json()) as T;
}
