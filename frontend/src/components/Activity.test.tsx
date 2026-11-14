// Relative time wording, the 'You' chip and the reviewer banner on the assigned-reviewers card.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineEvent } from '../api/types';
import { caseDetails } from '../api/fixtures/cases';
import { AssignedReviewers } from './AssignedReviewers';
import { formatRelative, Timeline } from './Timeline';

let actorId = 'REV-000021';
vi.mock('../session', () => ({ useSession: () => ({ actorId, changeActor: () => {} }) }));
vi.mock('../api/hooks', () => ({
  useReviewers: () => ({
    data: [
      { reviewer_id: 'REV-000021', name: 'Helen Marsh', role: 'academic_reviewer', department: 'Law' },
      { reviewer_id: 'REV-000099', name: 'Sam Admin', role: 'academic_administrator', department: 'Central' },
    ],
  }),
}));

afterEach(() => {
  cleanup();
  actorId = 'REV-000021';
});

const NOW = Date.parse('2026-11-14T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('formatRelative', () => {
  it('uses short, plain wording for recent times', () => {
    expect(formatRelative(ago(10_000), NOW)).toBe('just now');
    expect(formatRelative(ago(2 * 60_000), NOW)).toBe('2 min ago');
    expect(formatRelative(ago(3 * 3_600_000), NOW)).toBe('3 h ago');
    expect(formatRelative(ago(5 * 86_400_000), NOW)).toBe('5 d ago');
  });

  it('falls back to the absolute date after a week', () => {
    expect(formatRelative(ago(10 * 86_400_000), NOW)).toMatch(/2026/);
  });
});

describe('Timeline outcome chips', () => {
  const event = (over: Partial<TimelineEvent>): TimelineEvent => ({
    event_id: 1, event_type: 'decision_recorded', occurred_at: ago(3_600_000), actor_id: null, actor_name: null,
    from_status: null, to_status: null, ref_id: null, reason: null, detail: null, ...over,
  });

  it.each([
    ['decision_recorded', 'No violation found', 'Cleared', 'text-success'],
    ['decision_recorded', 'Violation confirmed', 'Failed', 'text-danger'],
    ['decision_recorded', 'Inconclusive', 'Inconclusive', 'text-warning'],
    ['appeal_decided', 'Original decision overturned', 'Overturned', 'text-success'],
    ['appeal_decided', 'Original decision upheld', 'Upheld', 'text-danger'],
    ['appeal_decided', 'Original decision partially upheld', 'Partly upheld', 'text-warning'],
  ] as const)('shows the %s outcome "%s" as a %s chip', (eventType, detail, label, toneClass) => {
    render(<Timeline events={[event({ event_type: eventType, detail })]} />);
    const chip = screen.getByLabelText(`Outcome: ${detail}`);
    expect(chip.textContent).toBe(label);
    expect(chip.getAttribute('title')).toBe(detail);
    expect(chip.className).toContain(toneClass);
  });
});

describe('AssignedReviewers', () => {
  const underReview = caseDetails.find((c) => c.status === 'under_review')!;

  it('shows a You chip on the entry for the signed-in reviewer', () => {
    const detail = { ...underReview, reviewers: [{ reviewer_id: 'REV-000021', name: 'Helen Marsh', role_in_case: 'primary' as const, assigned_at: underReview.opened_at }] };
    render(<AssignedReviewers detail={detail} />);
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('You').closest('li')!.textContent).toContain('Helen Marsh');
    expect(screen.getByRole('status').textContent).toContain('You are assigned to this case');
  });

  it('has no You chip for someone else on the case', () => {
    actorId = 'REV-000099';
    const detail = { ...underReview, reviewers: [{ reviewer_id: 'REV-000021', name: 'Helen Marsh', role_in_case: 'primary' as const, assigned_at: underReview.opened_at }] };
    render(<AssignedReviewers detail={detail} />);
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.queryByText(/You are assigned to this case/)).toBeNull();
  });
});
