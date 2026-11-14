// Closing a case: the plain close, the administrator's appeal-window waiver, and the journey once the case is closed.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { caseDetails } from '../api/fixtures/cases';
import type { CaseDetail } from '../api/types';
import { ActionList } from './ActionList';
import { CloseForm } from './ActionForms';
import { JourneyRail, journeySteps } from './JourneyRail';

vi.mock('../session', () => ({ useSession: () => ({ actorId: 'REV-000001', changeActor: vi.fn() }) }));
vi.mock('../api/hooks', () => ({
  useReviewers: () => ({ data: [] }),
  useEligible: () => ({ data: [] }),
}));

afterEach(() => cleanup());

const byId = (id: string): CaseDetail => caseDetails.find((c) => c.case_id === id)!;
/** A decided, cleared case: the close is allowed at once. */
const cleared = () => byId('CAS-2026-000009');
/** A decided violation inside its appeal window: the close is refused but waivable. */
const waivable = () => byId('CAS-2026-000014');

describe('CloseForm (normal close)', () => {
  it('states the close plainly and posts an empty body', () => {
    const onSubmit = vi.fn();
    render(<CloseForm detail={cleared()} onSubmit={onSubmit} busy={false} />);

    expect(screen.getByText(/The learner cannot appeal this outcome/)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close the case' }));
    expect(onSubmit).toHaveBeenCalledWith('/close', {});
  });
});

describe('CloseForm (appeal-window waiver)', () => {
  it('keeps submit disabled until the waiver box is ticked and a reason of 5+ characters is written', () => {
    const onSubmit = vi.fn();
    render(<CloseForm detail={waivable()} onSubmit={onSubmit} busy={false} />);

    expect(screen.getByText(/The learner can still appeal until 25 Nov 2026/)).toBeTruthy();
    const submit = screen.getByRole('button', { name: 'Close and waive appeal window' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText(/Still needed: tick the waiver box and a reason of at least 5 characters/)).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByRole('textbox', { name: /Reason \(kept in the case history\)/ }), { target: { value: 'Ok' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: /Reason \(kept in the case history\)/ }), { target: { value: 'Learner withdrew the appeal' } });
    expect(submit.disabled).toBe(false);
    expect(screen.queryByText(/Still needed/)).toBeNull();

    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith('/close', { waive_appeal_window: true, reason: 'Learner withdrew the appeal' });
  });
});

describe('ActionList close choices', () => {
  it('offers the outlined waiver button for a waivable close and reports the click as a close action', () => {
    const onAction = vi.fn();
    const detail = waivable();
    render(<ActionList checks={detail.action_checks} onAction={onAction} status={detail.status} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close early (waive appeal)' }));
    expect(onAction).toHaveBeenCalledWith('close');
    expect(screen.queryByRole('button', { name: 'Close the case' })).toBeNull();
  });

  it('shows the normal close button when the close is allowed', () => {
    const detail = cleared();
    render(<ActionList checks={detail.action_checks} onAction={() => {}} status={detail.status} />);
    expect(screen.getByRole('button', { name: 'Close the case' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close early (waive appeal)' })).toBeNull();
  });
});

describe('journey after the case is closed', () => {
  it('marks every step done, so none stays Decided as current', () => {
    const steps = journeySteps({ status: 'closed', appeal: null });
    expect(steps.map((s) => [s.label, s.state])).toEqual([
      ['Open', 'done'],
      ['Under review', 'done'],
      ['Decided', 'done'],
      ['Closed', 'done'],
    ]);
  });

  it('shows a Closed chip with the day the case closed', () => {
    const closed = byId('CAS-2026-000011');
    render(<JourneyRail detail={closed} onAction={() => {}} />);
    expect(screen.getByText('Closed 2 Nov 2026')).toBeTruthy();
    expect(screen.queryByText('Next step:')).toBeNull();
  });
});
