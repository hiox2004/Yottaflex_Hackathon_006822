// Smoke test: App renders the title and reports backend ok when /api/health succeeds (fetch mocked).
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the title and backend status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Academic Integrity Workflow' })).toBeTruthy();
    expect(await screen.findByText('Backend: ok')).toBeTruthy();
  });
});
