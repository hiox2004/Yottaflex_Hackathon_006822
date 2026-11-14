// "Your work" card: the empty reviewer explanation and the administrator's three lists.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueFilters } from '../api/hooks';
import type { QueueRow } from '../api/types';
import { queueRows } from '../api/fixtures/queue';
import { reviewers } from '../api/fixtures/reviewers';
import { MyWork } from './MyWork';

const session = vi.hoisted(() => ({ actorId: 'REV-000021', changeActor: vi.fn() }));
const store = vi.hoisted(() => ({ rows: [] as QueueRow[] }));

vi.mock('../session', () => ({ useSession: () => session }));
vi.mock('../api/hooks', () => ({
  useReviewers: (actorId: string) => ({
    data: reviewers.filter((r) => r.reviewer_id === actorId),
    isPending: false,
    isError: false,
  }),
  useQueue: (_actorId: string, filters: QueueFilters, limit: number) => {
    const statuses = filters.status?.split(',');
    const rows = store.rows.filter(
      (r) => (!statuses || statuses.includes(r.status)) && (!filters.needs_my_action || r.needs_my_action),
    );
    return { data: { items: rows.slice(0, limit), total: rows.length, counts: {} }, isLoading: false, isError: false };
  },
}));

const renderCard = () =>
  render(
    <MemoryRouter>
      <MyWork />
    </MemoryRouter>,
  );

beforeEach(() => {
  store.rows = queueRows;
  session.changeActor.mockClear();
});

afterEach(cleanup);

describe('MyWork', () => {
  it('explains the empty state to a reviewer and offers the two ways out', () => {
    session.actorId = 'REV-000011';
    store.rows = [];
    renderCard();

    expect(screen.getByText('Nothing is assigned to you yet. Reviewers only see cases an administrator assigns to them.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to an administrator (Vik Silva) to assign you a case' }));
    expect(session.changeActor).toHaveBeenCalledWith('REV-000001');
    expect(screen.getByRole('link', { name: 'Browse all cases' }).getAttribute('href')).toBe('/cases');
  });

  it('shows the three administrator lists with case links and the next step', () => {
    session.actorId = 'REV-000021';
    renderCard();

    const open = screen.getByRole('region', { name: 'Open cases waiting for a reviewer' });
    const openHrefs = within(open).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(openHrefs).toEqual(['/cases/CAS-2026-000017']);
    expect(within(open).getByText('Assign a reviewer')).toBeTruthy();

    const appeals = screen.getByRole('region', { name: 'Appeals waiting for an independent reviewer' });
    expect(within(appeals).getAllByRole('link')).toHaveLength(1);

    const decided = screen.getByRole('region', { name: 'Decided cases to close' });
    expect(within(decided).getAllByRole('link')).toHaveLength(2);
  });

  it('tells a learner plainly when nothing is flagged for them', () => {
    session.actorId = 'LRN-1001';
    store.rows = [];
    renderCard();
    expect(screen.getByText('You have no cases. Nothing has been flagged for you.')).toBeTruthy();
  });
});
