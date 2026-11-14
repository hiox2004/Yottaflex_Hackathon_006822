import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { caseDetails } from '../api/fixtures/cases';
import type { CaseDetail } from '../api/types';
import { JourneyRail, journeySteps } from './JourneyRail';

const session = vi.hoisted(() => ({ actorId: 'REV-000001', changeActor: vi.fn() }));

vi.mock('../session', () => ({ useSession: () => session }));
vi.mock('../api/hooks', () => ({
  useReviewers: () => ({
    data: [
      { reviewer_id: 'REV-000001', name: 'Vik Silva', role: 'academic_administrator', department: 'Admin' },
      { reviewer_id: 'REV-000007', name: 'Sam Gupta', role: 'support_staff', department: 'Support' },
    ],
  }),
}));

afterEach(() => {
  cleanup();
  session.actorId = 'REV-000001';
  session.changeActor.mockReset();
});

const base = (status: CaseDetail['status']): CaseDetail => caseDetails.find((c) => c.status === status)!;
const withOverrides = (detail: CaseDetail, over: Partial<CaseDetail>): CaseDetail => ({ ...detail, ...over });

describe('journeySteps', () => {
  it('moves the rail back to Under review after a reopen', () => {
    const steps = journeySteps({ status: 'under_review', appeal: null });
    expect(steps.map((s) => [s.label, s.state])).toEqual([
      ['Open', 'done'],
      ['Under review', 'current'],
      ['Decided', 'todo'],
      ['Closed', 'todo'],
    ]);
  });

  it('shows the Appeal step and marks Closed current once the appeal is decided', () => {
    const appeal = { appeal_id: 'APL-1', grounds: 'g', filed_at: '2026-11-01T00:00:00Z', reviewer_id: 'REV-1', outcome: 'upheld' as const, outcome_rationale: 'r', decided_at: '2026-11-02T00:00:00Z' };
    const steps = journeySteps({ status: 'appeal_decided', appeal });
    expect(steps.map((s) => [s.label, s.state])).toEqual([
      ['Open', 'done'],
      ['Under review', 'done'],
      ['Decided', 'done'],
      ['Appeal', 'done'],
      ['Closed', 'current'],
    ]);
  });
});

describe('JourneyRail stage control', () => {
  it('opens the action dialog from the primary button when the actor is allowed', () => {
    const onAction = vi.fn();
    const detail = withOverrides(base('under_review'), { allowed_actions: ['decide', 'add_evidence'] });
    render(<JourneyRail detail={detail} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Record a decision' }));
    expect(onAction).toHaveBeenCalledWith('decide');
    fireEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
    expect(onAction).toHaveBeenLastCalledWith('add_evidence');
  });

  it('marks the current step and replaces the button with a needs note and a switch when the actor is not allowed', () => {
    const detail = withOverrides(base('under_review'), {
      allowed_actions: [],
      action_checks: base('under_review').action_checks.map((c) =>
        c.action === 'decide' ? { ...c, allowed: false, reasons: [{ code: 'NOT_ASSIGNED', message: 'Only the assigned reviewer can decide.' }] } : c,
      ),
    });
    render(<JourneyRail detail={detail} onAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Under review/ }).getAttribute('aria-current')).toBe('step');
    expect(screen.queryByRole('button', { name: 'Record a decision' })).toBeNull();
    expect(screen.getByText('Needs the assigned reviewer.')).toBeTruthy();
    expect(screen.getByText('Why not: Only the assigned reviewer can decide.')).toBeTruthy();

    const reviewer = detail.reviewers[0]!;
    fireEvent.click(screen.getByRole('button', { name: `Switch to ${reviewer.name.split(' ')[0]}` }));
    expect(session.changeActor).toHaveBeenCalledWith(reviewer.reviewer_id);
  });

  it('switches to the support persona when a violation needs an appeal filed', () => {
    const detail = withOverrides(base('decided'), {
      effective_outcome: 'violation_confirmed',
      allowed_actions: [],
    });
    render(<JourneyRail detail={detail} onAction={vi.fn()} />);

    expect(screen.getByText('Needs support staff.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Sam' }));
    expect(session.changeActor).toHaveBeenCalledWith('REV-000007');
  });

  it('shows the decision result on the Decided step and explains a future step on click', () => {
    const detail = withOverrides(base('decided'), { effective_outcome: 'no_violation', allowed_actions: ['close'] });
    render(<JourneyRail detail={detail} onAction={vi.fn()} />);

    const decided = screen.getByRole('button', { name: /Decided/ });
    expect(decided.parentElement!.textContent).toContain('Cleared');

    fireEvent.click(screen.getByRole('button', { name: /Closed/ }));
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Happens after Decided, done by Administrator');
  });
});
