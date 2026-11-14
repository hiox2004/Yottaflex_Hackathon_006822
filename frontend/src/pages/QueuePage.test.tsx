// Queue renders from fixtures, opens on "Needs you" and tiles filter the list.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App, makeQueryClient } from '../App';

describe('QueuePage', () => {
  afterEach(cleanup);

  it('opens on Needs you and the Closed tile filters the list', async () => {
    render(<App client={makeQueryClient()} />);

    expect(await screen.findByText('Maya Okonkwo')).toBeTruthy();
    expect(screen.queryByText('Elena Petrova')).toBeNull(); // closed, not waiting on the actor

    fireEvent.click(screen.getByRole('button', { name: /Closed/ }));
    expect(await screen.findByText('Elena Petrova')).toBeTruthy(); // tiles are server filters, so wait for the refetch
    expect(screen.queryByText('Maya Okonkwo')).toBeNull();
  });

  it('lists dismissed flags with their reason', async () => {
    render(<App client={makeQueryClient()} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Dismissed flags' }));
    expect(await screen.findByText('Mostly properly quoted text')).toBeTruthy();
  });
});
