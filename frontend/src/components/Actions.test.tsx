// Action list, decision form, reviewer picker and error banner behave as the contract requires.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/errors';
import { caseDetails, eligibleFor } from '../api/fixtures/cases';
import { ActionList } from './ActionList';
import { DecisionForm } from './ActionForms';
import { ErrorBanner } from './ErrorBanner';
import { ReviewerPicker } from './ReviewerPicker';

afterEach(cleanup);

describe('ActionList', () => {
  it('renders allowed actions as enabled buttons and disallowed ones disabled with the reason', () => {
    const decided = caseDetails.find((c) => c.status === 'decided')!;
    render(<ActionList checks={decided.action_checks} onAction={() => {}} />);

    expect((screen.getByRole('button', { name: 'Reopen the case' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Close the case' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Appeal window open until 25 Nov 2026/)).toBeTruthy();
  });
});

describe('DecisionForm', () => {
  it('blocks an empty rationale and missing citations', () => {
    const onSubmit = vi.fn();
    const underReview = caseDetails.find((c) => c.status === 'under_review')!;
    render(<DecisionForm detail={underReview} onSubmit={onSubmit} busy={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));
    expect(screen.getByRole('alert').textContent).toMatch(/rationale/);

    fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'Clear copying.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Cite at least one/);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

describe('ReviewerPicker', () => {
  it('disables a conflicted reviewer and shows the reason', () => {
    render(<ReviewerPicker people={eligibleFor('case')} selected="" onSelect={() => {}} />);

    const instructor = screen.getByRole('radio', { name: /Dr\. Priya Raman/ }) as HTMLInputElement;
    expect(instructor.disabled).toBe(true);
    expect(screen.getByText(/Teaches this assessment/)).toBeTruthy();
  });
});

describe('ErrorBanner', () => {
  it('shows the server message from the error envelope', () => {
    render(<ErrorBanner error={new ApiError(409, 'CONFLICT_OF_INTEREST', 'REV-000004 teaches this assessment, so cannot review this case.', { reasons: ['INSTRUCTOR_OF_ASSESSMENT'] })} />);
    expect(screen.getByRole('alert').textContent).toMatch(/REV-000004 teaches this assessment/);
    expect(screen.getByRole('alert').textContent).toMatch(/INSTRUCTOR_OF_ASSESSMENT/);
  });
});
