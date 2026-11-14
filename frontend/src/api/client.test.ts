// Live-mode client: sends X-Actor-Id and turns the error envelope into an ApiError. Fixture mode is switched off per test.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setActorId } from './actor';
import type { ApiError } from './errors';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function liveClient() {
  vi.stubEnv('VITE_USE_FIXTURES', 'false');
  vi.resetModules();
  return import('./client');
}

describe('api client', () => {
  it('sends the actor header on every request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }));
    const { apiGet } = await liveClient();
    setActorId('REV-000021');

    await apiGet('/reviewers');

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Actor-Id']).toBe('REV-000021');
  });

  it('throws an ApiError carrying the server message and details', async () => {
    const body = { error: { code: 'APPEAL_WINDOW_OPEN', message: 'Appeal window open until 25 Nov 2026', details: {} } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status: 409 }));
    const { apiPost } = await liveClient();

    const error = await apiPost('/cases/CAS-2026-000009/close', {}).catch((e: unknown) => e);

    expect((error as ApiError).message).toBe('Appeal window open until 25 Nov 2026');
    expect((error as ApiError).code).toBe('APPEAL_WINDOW_OPEN');
  });
});
