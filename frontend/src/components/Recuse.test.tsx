// Stepping aside: the form needs a reason, every action and event has a label, and the fixtures cover both recusal states.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { caseDetails } from '../api/fixtures/cases';
import type { AllowedAction, EventType } from '../api/types';
import { ACTION_LABEL, EVENT_LABEL, NO_REVIEWER_TEXT, REASON_LABEL } from '../labels';
import { RecuseForm } from './ActionForms';

vi.mock('../api/hooks', () => ({ useEligible: () => ({ data: [] }), useReviewers: () => ({ data: [] }) }));
vi.mock('../session', () => ({ useSession: () => ({ actorId: 'REV-000021', changeActor: vi.fn() }) }));

afterEach(() => cleanup());

// Typed as Record so the compiler flags any new action or event type that is not listed here.
const ALL_ACTIONS: Record<AllowedAction, true> = {
  assign_reviewer: true,
  add_evidence: true,
  reopen: true,
  decide: true,
  recuse: true,
  file_appeal: true,
  assign_appeal_reviewer: true,
  decide_appeal: true,
  close: true,
};

const ALL_EVENTS: Record<EventType, true> = {
  case_opened: true,
  reviewer_assigned: true,
  evidence_added: true,
  decision_recorded: true,
  case_reopened: true,
  appeal_filed: true,
  appeal_reviewer_assigned: true,
  appeal_decided: true,
  case_closed: true,
  reviewer_recused: true,
};

describe('RecuseForm', () => {
  it('requires a reason before it submits', () => {
    const onSubmit = vi.fn();
    render(<RecuseForm onSubmit={onSubmit} busy={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Step aside' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Give a reason for stepping aside/);

    fireEvent.change(screen.getByLabelText('Reason for stepping aside'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Step aside' }));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Reason for stepping aside'), { target: { value: ' I supervised this learner last term. ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Step aside' }));
    expect(onSubmit).toHaveBeenCalledWith('/recuse', { reason: 'I supervised this learner last term.' });
  });

  it('explains what stepping aside does', () => {
    render(<RecuseForm onSubmit={vi.fn()} busy={false} />);
    expect(
      screen.getByText(
        'Step aside if you have a conflict of interest or cannot review this case fairly. Your reason is recorded in the case history and an administrator will assign someone else.',
      ),
    ).toBeTruthy();
  });
});

describe('labels', () => {
  it('give every action a label', () => {
    for (const action of Object.keys(ALL_ACTIONS) as AllowedAction[]) {
      expect(ACTION_LABEL[action], action).toBeTruthy();
    }
    expect(ACTION_LABEL.recuse).toBe('Step aside (recuse)');
  });

  it('give every event type a label', () => {
    for (const event of Object.keys(ALL_EVENTS) as EventType[]) {
      expect(EVENT_LABEL[event], event).toBeTruthy();
    }
    expect(EVENT_LABEL.reviewer_recused).toBe('Reviewer stepped aside');
  });

  it('explain the recusal and conflict refusal codes', () => {
    expect(REASON_LABEL.RECUSAL_REASON_REQUIRED).toBeTruthy();
    expect(REASON_LABEL.NOT_ASSIGNED).toBeTruthy();
    expect(REASON_LABEL.CONFLICT_OF_INTEREST).toMatch(/step aside/i);
  });
});

describe('fixtures', () => {
  it('include an under-review case where stepping aside is allowed and one with no active reviewer', () => {
    const withRecuse = caseDetails.find((c) => c.status === 'under_review' && c.allowed_actions.includes('recuse'));
    expect(withRecuse).toBeTruthy();
    expect(withRecuse!.reviewers.length).toBeGreaterThan(0);

    const noReviewer = caseDetails.find((c) => c.status === 'under_review' && c.reviewers.length === 0);
    expect(noReviewer).toBeTruthy();
    expect(noReviewer!.allowed_actions).not.toContain('recuse');
    expect(NO_REVIEWER_TEXT).toMatch(/no active reviewer/);
  });
});
