// Administration page: totals, reviewer suggestions and the overload flag render from fixtures; other roles are turned away.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App, makeQueryClient } from '../../App';
import { setActorId } from '../../api/actor';

const ADMIN = 'REV-000021'; // Helen Marsh, academic administrator in fixtures
const REVIEWER = 'REV-000011'; // Dr. Amara Okafor, academic reviewer

describe('AdminPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/admin');
  });
  afterEach(() => {
    cleanup();
    setActorId(REVIEWER);
    window.history.replaceState(null, '', '/');
  });

  it('renders totals as links to the matching Cases tab, and the suggested reviewers with their load', async () => {
    setActorId(ADMIN);
    render(<App client={makeQueryClient()} />);

    const unassigned = await screen.findByRole('link', { name: /Unassigned/ });
    expect(unassigned.getAttribute('href')).toBe('/cases?tab=unassigned');
    expect(unassigned.textContent).toContain('2');

    const decided = screen.getByRole('link', { name: /Decided, waiting to close/ });
    expect(decided.getAttribute('href')).toBe('/cases?tab=decided');
    expect(decided.textContent).toContain('4');

    const suggestions = screen.getByLabelText('Suggested reviewers for CAS-2026-000201');
    expect(within(suggestions).getByText(/Prof. Lars Eriksen/).textContent).toContain('5 active');
    expect(within(suggestions).getByText(/Dr. Priya Raman/).textContent).toContain('0 active');

    const hrefs = screen.getAllByRole('link', { name: 'Open to assign' }).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/cases/CAS-2026-000201');
  });

  it('flags overloaded reviewers and leaves the others unflagged', async () => {
    setActorId(ADMIN);
    render(<App client={makeQueryClient()} />);

    const overloaded = await screen.findByRole('row', { name: /Dr. Amara Okafor/ });
    expect(within(overloaded).getByText('Overloaded')).toBeTruthy();

    const busy = screen.getByRole('row', { name: /Dr. Naledi Dube/ });
    expect(within(busy).queryByText('Overloaded')).toBeNull();
    expect(within(screen.getByRole('row', { name: /Helen Marsh/ })).getByText('Available')).toBeTruthy();
  });

  it('turns away a reviewer who opens the page', async () => {
    setActorId(REVIEWER);
    render(<App client={makeQueryClient()} />);
    await waitFor(() => expect(screen.getByText('Not available for your role')).toBeTruthy());
    expect(screen.queryByText('Where things stand')).toBeNull();
  });
});
