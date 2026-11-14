// Action list, decision form, appeal reassignment and error banner behave as the contract requires.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/errors';
import { caseDetails, eligibleFor } from '../api/fixtures/cases';
import { ActionList } from './ActionList';
import { AssignAppealReviewerForm, DecisionForm, EvidenceForm } from './ActionForms';
import { ErrorBanner } from './ErrorBanner';
import { ReviewerPicker } from './ReviewerPicker';
import { Toaster, toast } from './Toast';

// The acting reviewer's role for the evidence-kind tests; each test sets it before rendering.
let mockRole = 'academic_reviewer';
vi.mock('../api/hooks', () => ({
  useEligible: () => ({ data: eligibleFor('appeal') }),
  useReviewers: () => ({ data: [{ reviewer_id: 'REV-000021', name: 'Acting user', role: mockRole, department: 'Test' }] }),
}));
vi.mock('../session', () => ({ useSession: () => ({ actorId: 'REV-000021' }) }));

afterEach(() => {
  cleanup();
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

const isDisabled = (name: string) => (screen.getByRole('button', { name }) as HTMLButtonElement).disabled;

describe('ActionList', () => {
  it('puts allowed actions under Do now and explains blocked ones in a collapsed group', () => {
    const decided = caseDetails.find((c) => c.status === 'decided')!;
    render(<ActionList checks={decided.action_checks} onAction={() => {}} status={decided.status} />);

    expect(isDisabled('Reopen the case')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Close the case' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Do now' })).toBeTruthy();

    const summary = screen.getByText(/Not available/);
    expect(summary.closest('details')!.open).toBe(false);
    fireEvent.click(summary);
    expect(summary.closest('details')!.open).toBe(true);
    expect(screen.getByText(/Appeal window open until 25 Nov 2026/)).toBeTruthy();
  });

  it('reads the appeal reviewer action as a reassignment while the appeal is in review', () => {
    const appealCase = caseDetails.find((c) => c.status === 'appeal_review')!;
    render(<ActionList checks={appealCase.action_checks} onAction={() => {}} status={appealCase.status} />);
    expect(screen.getByRole('button', { name: 'Reassign appeal reviewer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Assign appeal reviewer' })).toBeNull();
  });
});

describe('AssignAppealReviewerForm', () => {
  it('explains reassignment and does not offer the current appeal reviewer again', () => {
    const appealCase = caseDetails.find((c) => c.status === 'appeal_review')!;
    const current = eligibleFor('appeal').find((r) => r.reviewer_id === appealCase.appeal?.reviewer_id)!;
    render(<AssignAppealReviewerForm detail={appealCase} onSubmit={vi.fn()} busy={false} />);

    expect(screen.getByText(/Use this if the current appeal reviewer is unavailable/)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: new RegExp(current.name) })).toBeNull();
    expect(screen.getByRole('radio', { name: /Dr\. Naledi Dube/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reassign' })).toBeTruthy();
  });
});

describe('EvidenceForm kind options', () => {
  const underReview = caseDetails.find((c) => c.status === 'under_review')!;
  const kindValues = () => Array.from((screen.getByLabelText('Kind') as HTMLSelectElement).options, (o) => o.value);

  it('offers support staff only the learner statement, matching the backend rule', () => {
    mockRole = 'support_staff';
    render(<EvidenceForm detail={underReview} onSubmit={vi.fn()} busy={false} />);
    expect(kindValues()).toEqual(['learner_statement']);
    cleanup();
  });

  it('offers reviewers every evidence kind', () => {
    mockRole = 'academic_reviewer';
    render(<EvidenceForm detail={underReview} onSubmit={vi.fn()} busy={false} />);
    expect(kindValues()).toEqual(['matched_passage', 'source_reference', 'template_match', 'quote_citation', 'learner_statement']);
    cleanup();
  });
});

describe('DecisionForm', () => {
  const underReview = caseDetails.find((c) => c.status === 'under_review')!;
  const submitButton = (label: string) => screen.getByRole('button', { name: label }) as HTMLButtonElement;
  // Checkbox order in the DOM: evidence items first, then (for Fail) the confirmation inside the checklist at the bottom.
  const evidenceBox = (i: number) => screen.getAllByRole('checkbox')[i]!;
  const confirmBox = () => screen.getByRole('checkbox', { name: /You confirm you reviewed the cited evidence yourself/ });
  const checklist = () => screen.getByRole('region', { name: 'Before you can confirm' });

  it('keeps submit disabled until evidence is cited and a rationale is written', () => {
    const onSubmit = vi.fn();
    render(<DecisionForm detail={underReview} onSubmit={onSubmit} busy={false} />);

    expect(submitButton('Clear learner').disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'Clear copying.' } });
    expect(submitButton('Clear learner').disabled).toBe(true);
    expect(screen.getByText(/Tick at least one piece of evidence/)).toBeTruthy();

    fireEvent.click(evidenceBox(0));
    expect(submitButton('Clear learner').disabled).toBe(false);
    fireEvent.click(submitButton('Clear learner'));
    expect(onSubmit).toHaveBeenCalledWith('/decision', {
      outcome: 'no_violation',
      rationale: 'Clear copying.',
      cited_evidence_ids: [underReview.evidence[0]!.evidence_id],
    });
  });

  it('shows a plain character count for Clear, with no confirmed-violation minimum', () => {
    render(<DecisionForm detail={underReview} onSubmit={vi.fn()} busy={false} />);
    fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'Short.' } });
    expect(screen.getByText('6 characters')).toBeTruthy();
    expect(screen.queryByText(/minimum 20 to confirm a violation/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Before you can confirm' })).toBeNull();
  });

  it('explains why submit is disabled when no evidence is on record', () => {
    render(<DecisionForm detail={{ ...underReview, evidence: [] }} onSubmit={vi.fn()} busy={false} />);
    expect(submitButton('Clear learner').disabled).toBe(true);
    expect(screen.getByText(/No evidence on record. Add evidence before deciding./)).toBeTruthy();
  });

  it('shows the three-item checklist when Fail is selected, and enables submit only when all three are met', () => {
    const onSubmit = vi.fn();
    render(<DecisionForm detail={underReview} onSubmit={onSubmit} busy={false} />);

    fireEvent.click(screen.getByRole('radio', { name: /Fail: violation confirmed/ }));
    const list = checklist();
    expect(list.querySelectorAll('li').length).toBe(3);
    expect(within(list).getByText(/Written rationale of at least 20 characters \(0\/20\)/)).toBeTruthy();
    expect(within(list).getByText(/At least one matched passage or source reference cited/)).toBeTruthy();
    // The confirmation now lives in the checklist, not under the radio card.
    expect(within(list).getByRole('checkbox', { name: /You confirm you reviewed the cited evidence yourself/ })).toBeTruthy();

    const submit = submitButton('Confirm violation');
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('aria-describedby')).toBe(list.id);

    fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'Copied passage without citation.' } });
    expect(submit.disabled).toBe(true);
    fireEvent.click(evidenceBox(0));
    expect(submit.disabled).toBe(true);
    fireEvent.click(confirmBox());
    expect(submit.disabled).toBe(false);
    expect(within(list).getAllByText('Done:').length).toBe(3);

    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith('/decision', {
      outcome: 'violation_confirmed',
      rationale: 'Copied passage without citation.',
      cited_evidence_ids: [underReview.evidence[0]!.evidence_id],
    });
  });

  it('blocks a confirmed violation with a rationale shorter than 20 characters and shows the count in red', () => {
    render(<DecisionForm detail={underReview} onSubmit={vi.fn()} busy={false} />);
    fireEvent.click(screen.getByRole('radio', { name: /Fail: violation confirmed/ }));
    fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'Too short.' } });
    fireEvent.click(evidenceBox(0));
    fireEvent.click(confirmBox());

    expect(screen.getByText('10 characters (minimum 20 to confirm a violation)').className).toMatch(/text-danger/);
    expect(within(checklist()).getByText(/\(10\/20\)/)).toBeTruthy();
    expect(submitButton('Confirm violation').disabled).toBe(true);
  });

  it('asks for a matched passage or source reference when the case has none on record', () => {
    const noIncriminating = { ...underReview, evidence: [{ ...underReview.evidence[0]!, kind: 'quote_citation' as const }] };
    render(<DecisionForm detail={noIncriminating} onSubmit={vi.fn()} busy={false} />);
    fireEvent.click(screen.getByRole('radio', { name: /Fail: violation confirmed/ }));

    expect(screen.getByText(/None on record. Use Add evidence on this page first./)).toBeTruthy();
    expect(submitButton('Confirm violation').disabled).toBe(true);
  });

  it('needs a cited matched passage or source reference, not only a quote, to confirm a violation', () => {
    const quoteOnly = { ...underReview, evidence: [underReview.evidence[0]!, { ...underReview.evidence[1]!, kind: 'quote_citation' as const }] };
    render(<DecisionForm detail={quoteOnly} onSubmit={vi.fn()} busy={false} />);
    fireEvent.click(screen.getByRole('radio', { name: /Fail: violation confirmed/ }));
    fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'Copied passage without citation, see the quote.' } });
    fireEvent.click(confirmBox());
    // Cite only the quote (the second evidence item).
    fireEvent.click(evidenceBox(1));

    const citation = within(checklist()).getByText('At least one matched passage or source reference cited').closest('li')!;
    expect(citation.textContent).toMatch(/To do:/);
    expect(submitButton('Confirm violation').disabled).toBe(true);
  });

  it('scrolls the checklist into view when Fail is chosen and when the disabled button is clicked', () => {
    const scroll = vi.fn();
    (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = scroll;
    render(<DecisionForm detail={underReview} onSubmit={vi.fn()} busy={false} />);

    fireEvent.click(screen.getByRole('radio', { name: /Fail: violation confirmed/ }));
    expect(scroll).toHaveBeenCalledTimes(1);

    fireEvent.click(submitButton('Confirm violation'));
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it('does not fail when scrollIntoView is missing (jsdom)', () => {
    render(<DecisionForm detail={underReview} onSubmit={vi.fn()} busy={false} />);
    expect(() => fireEvent.click(screen.getByRole('radio', { name: /Fail: violation confirmed/ }))).not.toThrow();
  });
});

describe('ReviewerPicker', () => {
  it('disables a conflicted reviewer and shows the reason', () => {
    render(<ReviewerPicker people={eligibleFor('case')} selected="" onSelect={() => {}} />);

    const instructor = screen.getByRole('radio', { name: /Dr\. Priya Raman/ }) as HTMLInputElement;
    expect(instructor.disabled).toBe(true);
    expect(screen.getByText(/teaches the assessment/)).toBeTruthy();
  });
});

describe('ErrorBanner', () => {
  it('shows the server message from the error envelope', () => {
    render(<ErrorBanner error={new ApiError(409, 'CONFLICT_OF_INTEREST', 'REV-000004 teaches this assessment, so cannot review this case.', { reasons: ['INSTRUCTOR_OF_ASSESSMENT'] })} />);
    expect(screen.getByRole('alert').textContent).toMatch(/REV-000004 teaches this assessment/);
    expect(screen.getByRole('alert').textContent).toMatch(/INSTRUCTOR_OF_ASSESSMENT/);
  });
});

describe('ErrorBanner reason mapping', () => {
  it('turns a reason code into a plain sentence and keeps the code visible', () => {
    render(<ErrorBanner error={new ApiError(409, 'ROLE_NOT_ALLOWED', 'Refused.', { reasons: ['NOT_ASSIGNED'] })} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Only the assigned reviewer can do this/);
    expect(screen.getByRole('alert').textContent).toMatch(/NOT_ASSIGNED/);
  });

  it('maps the appeal window, same-reviewer and confirmed-violation codes to plain sentences', () => {
    render(
      <ErrorBanner
        error={new ApiError(409, 'APPEAL_WINDOW_CLOSED', 'Refused.', {
          reasons: ['APPEAL_WINDOW_CLOSED', 'SAME_APPEAL_REVIEWER', 'RATIONALE_TOO_SHORT', 'NO_INCRIMINATING_EVIDENCE'],
        })}
      />,
    );
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).toMatch(/appeal window has closed/);
    expect(text).toMatch(/already holds this appeal/);
    expect(text).toMatch(/at least 20 characters/);
    expect(text).toMatch(/matched passage or source reference/);
  });
});

describe('Toaster', () => {
  it('shows a confirmation in a status region and can be dismissed', () => {
    render(<Toaster />);
    act(() => toast('Record a decision done. Next: file an appeal (if violation confirmed) or close'));
    expect(screen.getByRole('status').textContent).toMatch(/Next: file an appeal/);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText(/Next: file an appeal/)).toBeNull();
  });
});
