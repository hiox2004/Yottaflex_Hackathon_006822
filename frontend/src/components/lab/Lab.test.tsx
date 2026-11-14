// Lab session store, error boundary and example packs. Storage writes are debounced, so tests flush them explicitly.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabResponse } from '../../api/lab';
import { allPacks } from '../../lib/labPacks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { ResultsErrorBoundary } from './ResultsErrorBoundary';

vi.mock('../../api/client', () => ({ apiPost: vi.fn() }));

const KEY = 'yottaflex.lab.session';
const labCase = (id: string) => ({ id, scores: { raw: 0.9, quoted: 0.1, template: 0.1 } });
const created = (lab_id: string) => ({
  lab_id,
  submission_id: `SUB-${lab_id}`,
  similarity_report_id: `SIM-${lab_id}`,
  outcome: 'case_opened' as const,
  case_id: `CASE-${lab_id}`,
  evidence_ids: [],
});

const response: LabResponse = {
  rule: { rule_id: 'R-1', version: 2, log_threshold: 0.3, review_threshold: 0.6, priority_threshold: 0.85, appeal_window_days: 30 },
  passed: 1,
  failed: 1,
  no_expectation: 0,
  results: [
    { id: 'a', title: 'A', is_flag: true, opens_case: true, band: 'review', adjusted_score: 0.7, dismissal_reason: null, explanation: [], checks: [], mismatches: [], verdict: 'pass' },
    { id: 'b', title: 'B', is_flag: false, opens_case: false, band: 'log_only', adjusted_score: 0.1, dismissal_reason: null, explanation: [], checks: [], mismatches: ['band'], verdict: 'fail' },
  ],
};

// A complete stored session in the current shape. Tests override single fields to make it invalid.
const storedSession = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  text: '{"cases":[]}',
  response,
  cases: [],
  ranAt: '2026-11-14T10:00:00.000Z',
  filter: 'fail',
  expanded: ['1:b'],
  imported: [],
  ...overrides,
});

// Writes pending from the previous test must not leak into the next one's storage.
afterEach(async () => {
  const store = await import('../../lib/labSession');
  store.flushLabSession();
});

describe('lab session store', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('restores input, last run, filter and expanded cases after a reload', async () => {
    window.sessionStorage.setItem(KEY, JSON.stringify(storedSession()));

    const store = await import('../../lib/labSession');
    const session = store.getLabSession();

    expect(session.text).toBe('{"cases":[]}');
    expect(session.response?.results.map((r) => r.id)).toEqual(['a', 'b']);
    expect(session.ranAt).toBe('2026-11-14T10:00:00.000Z');
    expect(session.filter).toBe('fail');
    expect(session.expanded).toEqual(['1:b']);
  });

  it('discards a corrupt stored session without throwing, and clears it from storage', async () => {
    // Shape of another page: results without the rule and verdict fields the Test Lab reads.
    window.sessionStorage.setItem(KEY, JSON.stringify(storedSession({ response: { results: [{ id: 'x', checks: 'nope' }] } })));

    const store = await import('../../lib/labSession');

    expect(store.getLabSession().response).toBeNull();
    expect(store.getLabSession().text).toBe('');
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('discards storage that is not JSON', async () => {
    window.sessionStorage.setItem(KEY, '{not json');

    const store = await import('../../lib/labSession');

    expect(store.getLabSession().response).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('discards a stored session of another version', async () => {
    window.sessionStorage.setItem(KEY, JSON.stringify(storedSession({ version: 0 })));

    const store = await import('../../lib/labSession');

    expect(store.getLabSession().response).toBeNull();
    expect(store.getLabSession().filter).toBe('all');
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('recordLabRun stores results and opens only the failed cases', async () => {
    const store = await import('../../lib/labSession');
    store.recordLabRun(response);

    expect(store.getLabSession().expanded).toEqual([store.caseKey(1, 'b')]);
    store.flushLabSession();
    const saved = JSON.parse(window.sessionStorage.getItem(KEY) ?? '{}') as { response: LabResponse; version: number };
    expect(saved.response.results).toHaveLength(2);
    expect(saved.version).toBe(1);
  });

  it('debounces storage writes to the last value, and flushes a pending write on pagehide', async () => {
    const store = await import('../../lib/labSession');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.useFakeTimers();

    store.updateLabSession({ text: 'a' });
    store.updateLabSession({ text: 'ab' });
    store.updateLabSession({ text: 'abc' });
    expect(store.getLabSession().text).toBe('abc'); // memory is immediate
    expect(setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(399);
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.sessionStorage.getItem(KEY) ?? '{}').text).toBe('abc');

    store.updateLabSession({ text: 'abcd' });
    window.dispatchEvent(new Event('pagehide'));
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(window.sessionStorage.getItem(KEY) ?? '{}').text).toBe('abcd');
  });

  it('keeps working in memory when sessionStorage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const store = await import('../../lib/labSession');
    expect(store.getLabSession().text).toBe('');
    expect(() => store.updateLabSession({ text: 'x' })).not.toThrow();
    expect(store.getLabSession().text).toBe('x');
    expect(() => store.flushLabSession()).not.toThrow();
  });
});

describe('workflow import', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => vi.clearAllMocks());

  it('posts the cases, stores the created rows and refreshes the queue and flags', async () => {
    const { apiPost } = await import('../../api/client');
    const { useLabImport } = await import('../../api/lab');
    const store = await import('../../lib/labSession');
    vi.mocked(apiPost).mockResolvedValue({ created: [created('a')] });

    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useLabImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync([labCase('a')]);
    });

    expect(apiPost).toHaveBeenCalledWith('/lab/import', { cases: [labCase('a')] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['queue'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['flags'] });
    expect(store.getLabSession().imported).toEqual([created('a')]);
  });

  it('surfaces a 403 as the administrator explanation and stores nothing', async () => {
    const { apiPost } = await import('../../api/client');
    const { ApiError } = await import('../../api/errors');
    const { useLabImport, labErrorMessage } = await import('../../api/lab');
    const store = await import('../../lib/labSession');
    vi.mocked(apiPost).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Forbidden.'));

    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useLabImport(), { wrapper });

    let caught: unknown;
    await act(async () => {
      await result.current.mutateAsync([labCase('a')]).catch((error: unknown) => (caught = error));
    });

    expect(caught).toBeInstanceOf(ApiError);
    expect(labErrorMessage(caught)).toContain('Only an academic administrator');
    expect(store.getLabSession().imported).toEqual([]);
  });

  it('never imports a lab id twice in one session, including repeats inside one batch', async () => {
    const store = await import('../../lib/labSession');
    store.recordLabImport([created('a')]);

    const { importable, skipped } = store.partitionImportable([labCase('a'), labCase('b'), labCase('b')], store.getLabSession().imported);

    expect(importable.map((c) => c.id)).toEqual(['b']);
    expect(skipped).toEqual(['a', 'b']);
  });

  it('keeps imported rows across Clear, and replaces a row when the same id is imported again', async () => {
    const store = await import('../../lib/labSession');
    store.recordLabImport([created('a')]);
    store.recordLabImport([{ ...created('a'), outcome: 'dismissed', case_id: null }]);
    store.clearLabSession();

    expect(store.getLabSession().imported).toEqual([{ ...created('a'), outcome: 'dismissed', case_id: null }]);
    expect(store.getLabSession().text).toBe('');
  });
});

describe('results error boundary', () => {
  afterEach(() => cleanup());

  it('shows Clear session when a render fails, and calls onClear from it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onClear = vi.fn();
    const Boom = (): never => {
      throw new Error('unexpected shape');
    };

    render(createElement(ResultsErrorBoundary, { onClear }, createElement(Boom)));
    fireEvent.click(screen.getByRole('button', { name: 'Clear session' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders its children when nothing fails', () => {
    render(createElement(ResultsErrorBoundary, { onClear: vi.fn() }, createElement('p', null, 'results ok')));

    expect(screen.getByText('results ok')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear session' })).toBeNull();
  });
});

describe('example packs', () => {
  const sourcePacks = allPacks.filter((pack) => pack.id !== 'everything');
  const everything = allPacks.find((pack) => pack.id === 'everything');

  it('has unique pack ids and at least one case per pack', () => {
    const ids = allPacks.map((pack) => pack.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pack of allPacks) expect(pack.cases.length, pack.id).toBeGreaterThan(0);
  });

  it('gives every case an id, unique across the source packs, and scores between 0 and 1', () => {
    const ids = sourcePacks.flatMap((pack) => pack.cases.map((c) => c.id));
    for (const id of ids) expect(id.trim(), 'case id').not.toBe('');
    expect(new Set(ids).size, 'duplicate case id across packs').toBe(ids.length);

    for (const c of allPacks.flatMap((pack) => pack.cases)) {
      expect(c.id.trim(), 'case id').not.toBe('');
      for (const value of [c.scores.raw, c.scores.quoted, c.scores.template]) {
        expect(value, `${c.id} score`).toBeGreaterThanOrEqual(0);
        expect(value, `${c.id} score`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('makes Everything a deduplicated union of the source packs', () => {
    expect(everything).toBeDefined();
    const distinct = new Set(sourcePacks.flatMap((pack) => pack.cases.map((c) => c.id)));
    const everythingIds = everything?.cases.map((c) => c.id) ?? [];
    expect(new Set(everythingIds).size).toBe(everythingIds.length);
    expect(new Set(everythingIds)).toEqual(distinct);
  });
});
