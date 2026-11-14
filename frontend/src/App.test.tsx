// Smoke tests: every top-level route renders its heading in fixture mode, and role gates hold for each actor type.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setActorId } from './api/actor';
import { App, makeQueryClient } from './App';

const routes = [
  ['/', 'Overview'],
  ['/cases', 'Cases'],
  ['/guide', 'How review works'],
  ['/lab', 'Test Lab'],
  ['/audit', 'Audit'],
  ['/rules', 'Rules'],
] as const;

const DEFAULT_ACTOR = 'REV-000011';

describe('routes', () => {
  afterEach(() => {
    cleanup();
    setActorId(DEFAULT_ACTOR);
  });

  it.each(routes)('renders %s with the %s heading', async (path, heading) => {
    window.history.pushState(null, '', path);
    render(<App client={makeQueryClient()} />);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });
});

describe('role gate', () => {
  afterEach(() => {
    cleanup();
    setActorId(DEFAULT_ACTOR);
  });

  it.each(['/audit', '/lab'])('blocks a learner from %s with the explanation card', async (path) => {
    setActorId('LRN-1031');
    window.history.pushState(null, '', path);
    render(<App client={makeQueryClient()} />);
    expect(await screen.findByText('Not available for your role')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Cases' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: path === '/audit' ? 'Audit' : 'Test Lab' })).toBeNull();
  });

  it('lets a learner open cases', async () => {
    setActorId('LRN-1031');
    window.history.pushState(null, '', '/cases');
    render(<App client={makeQueryClient()} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Cases' })).toBeTruthy();
  });

  it('lets a staff member through to audit', async () => {
    setActorId('REV-000031'); // support staff in the reviewer fixtures
    window.history.pushState(null, '', '/audit');
    render(<App client={makeQueryClient()} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Audit' })).toBeTruthy();
    expect(screen.queryByText('Not available for your role')).toBeNull();
  });
});
