// Cases page renders from fixtures, opens on "Needs you", and tabs filter the list (tabs are server filters).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, makeQueryClient } from '../App';
import { setActorId } from '../api/actor';
import { SessionProvider, useSession } from '../session';
import { CasesPage } from './CasesPage';

const DEFAULT_ACTOR = 'REV-000011';
const NOBODY = 'REV-999999'; // no fixture case is assigned to this id, so "Assigned to me" empties the list
const OTHER_ACTOR = 'REV-000021';

// When `hold` is set, every /queue request waits on it, so a test can observe the state while a switched actor's list loads.
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));
vi.mock('../api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/client')>();
  const apiGet = (path: string) => (gate.hold && path.startsWith('/queue') ? gate.hold.then(() => real.apiGet(path)) : real.apiGet(path));
  return { ...real, apiGet: apiGet as typeof real.apiGet };
});

function SwitchActor() {
  const { changeActor } = useSession();
  return <button onClick={() => changeActor(OTHER_ACTOR)}>Switch actor</button>;
}

describe('CasesPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/cases'); // '/' is the Overview page
  });
  afterEach(() => {
    cleanup();
    setActorId(DEFAULT_ACTOR);
    window.history.replaceState(null, '', '/');
  });

  it('opens on Needs you and the Closed tab filters the list', async () => {
    render(<App client={makeQueryClient()} />);

    expect(await screen.findByText('Maya Okonkwo')).toBeTruthy();
    expect(screen.queryByText('Elena Petrova')).toBeNull(); // closed, not waiting on the actor

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Closed/ })); // Radix tabs switch on mousedown
    expect(await screen.findByText('Elena Petrova')).toBeTruthy(); // tabs are server filters, so wait for the refetch
    expect(screen.queryByText('Maya Okonkwo')).toBeNull();
    expect(window.location.search).toBe('?tab=closed');
  });

  it('splits under review into Unassigned (open) and Under review (under_review only)', async () => {
    render(<App client={makeQueryClient()} />);

    fireEvent.mouseDown(await screen.findByRole('tab', { name: /Unassigned/ }));
    expect(await screen.findByText('Maya Okonkwo')).toBeTruthy(); // the only open case in fixtures
    expect(screen.queryByText('Jonas Weber')).toBeNull(); // under review, so not unassigned
    expect(screen.getByText('Flagged cases waiting for an administrator to assign a reviewer.')).toBeTruthy();
    expect(window.location.search).toBe('?tab=unassigned');

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Under review/ }));
    expect(await screen.findByText('Jonas Weber')).toBeTruthy();
    expect(screen.getByText('Sofia Lindqvist')).toBeTruthy();
    expect(screen.queryByText('Maya Okonkwo')).toBeNull();
    expect(screen.getByText('A reviewer is assigned and weighing the evidence.')).toBeTruthy();
    expect(window.location.search).toBe('?tab=under_review');
  });

  it('shows the Unassigned and Under review counts from their own queries', async () => {
    render(<App client={makeQueryClient()} />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Unassigned/ }).textContent).toBe('Unassigned1'));
    expect(screen.getByRole('tab', { name: /Under review/ }).textContent).toBe('Under review2');
  });

  it('lists dismissed flags with their reason', async () => {
    render(<App client={makeQueryClient()} />);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /Dismissed flags/ }));
    expect(await screen.findByText('Mostly properly quoted text')).toBeTruthy();
  });

  it('keeps assigned-to-me in the URL and does not switch tabs when the default tab is empty', async () => {
    window.history.replaceState(null, '', '/cases?mine=1');
    setActorId(NOBODY);
    render(<App client={makeQueryClient()} />);

    expect(await screen.findByText(`Nothing is assigned to ${NOBODY}. Switch the actor (sidebar) to someone with work, or open All cases.`)).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Needs you/ }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Show all cases' }));
    expect(await screen.findByRole('tab', { name: /All cases/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /All cases/ }).getAttribute('aria-selected')).toBe('true');
    expect(window.location.search).toContain('tab=all');
    expect(window.location.search).toContain('mine=1'); // the toolbar state survives the tab change
  });

  it('shows the role note for a reviewer, a tab description, and remembers Hide', async () => {
    render(<App client={makeQueryClient()} />);
    expect((await screen.findAllByText(/Reviewers only act on cases assigned to them/)).length).toBeGreaterThan(0); // the copy also appears in another panel
    expect(screen.getByText('Cases where you have an action available right now.')).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Decided/ }));
    expect(await screen.findByText('A decision was recorded; the appeal window may still be open.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Hide/ }));
    expect(screen.queryAllByText(/Reviewers only act on cases assigned to them/)).toHaveLength(0);
    expect(window.localStorage.getItem('roleBanner:hidden')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Show role help' }));
    expect(window.localStorage.getItem('roleBanner:hidden')).toBe('0');
  });

  it('after an actor switch shows loading, not the previous actor rows', async () => {
    setActorId(DEFAULT_ACTOR);
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <SessionProvider>
          <MemoryRouter initialEntries={['/cases']}>
            <SwitchActor />
            <CasesPage />
          </MemoryRouter>
        </SessionProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Maya Okonkwo')).toBeTruthy(); // the first actor's Needs you list

    let release = () => {};
    gate.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    fireEvent.click(screen.getByRole('button', { name: 'Switch actor' }));

    expect(await screen.findByText('Loading cases…')).toBeTruthy();
    expect(screen.queryByText('Maya Okonkwo')).toBeNull(); // no stale rows from the previous actor
    expect(screen.getByRole('tab', { name: /Needs you/ }).textContent).toBe('Needs you–'); // badge waits for the new counts

    gate.hold = null;
    release();
    expect(await screen.findByText('Maya Okonkwo')).toBeTruthy();
    expect(screen.queryByText('Loading cases…')).toBeNull();
  });

  it('OverviewPage KPI cards link to the matching Cases tab', async () => {
    window.history.replaceState(null, '', '/');
    render(<App client={makeQueryClient()} />);
    const href = (name: RegExp) => screen.getByRole('link', { name }).getAttribute('href');
    expect(href(/^Under review/)).toBe('/cases?tab=under_review');
    expect(href(/^Awaiting appeal/)).toBe('/cases?tab=awaiting_appeal');
    expect(href(/^Decided/)).toBe('/cases?tab=decided');
    expect(href(/^Closed/)).toBe('/cases?tab=closed');
    expect(href(/^Dismissed flags/)).toBe('/cases?tab=dismissed');
  });
});
