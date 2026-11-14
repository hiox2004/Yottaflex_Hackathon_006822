// "What happens next" for the acting reviewer: their own buttons when they can act, otherwise who must act next.
// The server decides what is allowed (allowed_actions); the per-status table below is copy only.
import { ArrowRight, CircleCheck } from 'lucide-react';
import { useReviewers } from '../api/hooks';
import type { AllowedAction, CaseDetail, Role, Status } from '../api/types';
import { actionLabel, NO_REVIEWER_TEXT, ROLE_LABEL } from '../labels';
import { useSession } from '../session';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { waivableClose, WaiveCloseButton } from './ActionList';

interface Props {
  detail: CaseDetail;
  actorName: string;
  actorRole: Role | undefined;
  onAction: (action: AllowedAction) => void;
}

interface Waiting {
  step: string;
  by: string;
}

/** The action that moves the case on from each status; its first blocking reason explains why the actor cannot act. */
const KEY_ACTION: Record<Status, (detail: CaseDetail) => AllowedAction | null> = {
  open: () => 'assign_reviewer',
  under_review: () => 'decide',
  decided: (detail) => (detail.effective_outcome === 'violation_confirmed' ? 'file_appeal' : 'close'),
  appealed: () => 'assign_appeal_reviewer',
  appeal_review: () => 'decide_appeal',
  appeal_decided: () => 'close',
  closed: () => null,
};

function waitingFor(detail: CaseDetail, appealReviewer: string): Waiting | null {
  switch (detail.status) {
    case 'open':
      return { step: 'assign a reviewer', by: ROLE_LABEL.academic_administrator };
    case 'under_review':
      return { step: 'record a decision', by: 'the assigned academic reviewer or instructor' };
    case 'decided':
      return detail.effective_outcome === 'violation_confirmed'
        ? { step: 'file an appeal if the learner wants one', by: 'support staff or an administrator' }
        : { step: 'close the case', by: ROLE_LABEL.academic_administrator };
    case 'appealed':
      return { step: 'assign an independent appeal reviewer', by: ROLE_LABEL.academic_administrator };
    case 'appeal_review':
      return { step: 'decide the appeal', by: appealReviewer };
    case 'appeal_decided':
      return { step: 'close the case', by: ROLE_LABEL.academic_administrator };
    case 'closed':
      return null;
  }
}

export function NextStep({ detail, actorName, actorRole, onAction }: Props) {
  const { actorId } = useSession();
  const reviewers = useReviewers(actorId);
  const appealReviewerId = detail.appeal?.reviewer_id ?? null;
  const appealReviewer = appealReviewerId
    ? (reviewers.data?.find((r) => r.reviewer_id === appealReviewerId)?.name ?? 'the appointed appeal reviewer')
    : 'the appointed appeal reviewer';

  // Under review with every reviewer stepped aside: nobody can decide until an administrator assigns one.
  const noReviewer = detail.status === 'under_review' && detail.reviewers.length === 0;

  const heading = (
    <p className="text-xs text-muted-foreground">
      You are acting as{' '}
      <strong className="font-medium text-foreground">{actorRole ? ROLE_LABEL[actorRole] : actorName}</strong>
      {actorRole && <> ({actorName})</>}.
    </p>
  );

  if (detail.status === 'closed' && detail.allowed_actions.length === 0) {
    return (
      <Card role="region" aria-label="What happens next" className="flex flex-col gap-2 p-5">
        <h2 className="text-base font-semibold tracking-tight">What happens next</h2>
        <p className="flex items-center gap-2 text-sm">
          <CircleCheck size={16} aria-hidden className="text-success" /> This case is closed and final. Nothing further is needed.
        </p>
        {heading}
      </Card>
    );
  }

  if (detail.allowed_actions.length > 0) {
    return (
      <Card role="region" aria-label="What happens next" className="flex flex-col gap-3 p-5">
        <h2 className="text-base font-semibold tracking-tight">What happens next</h2>
        {noReviewer && <p className="text-sm text-danger">{NO_REVIEWER_TEXT}</p>}
        <div className="flex flex-col gap-2">
          <p className="text-sm">You can now:</p>
          <div className="flex flex-wrap gap-2">
            {detail.allowed_actions.map((action) => (
              <Button key={action} type="button" size="sm" variant={action === 'recuse' ? 'outline' : 'default'} onClick={() => onAction(action)}>
                {actionLabel(action, detail.status)}
              </Button>
            ))}
            {waivableClose(detail.action_checks) && <WaiveCloseButton size="sm" onClick={() => onAction('close')} />}
          </div>
          {detail.allowed_actions.includes('recuse') && (
            <p className="text-xs text-muted-foreground">Step aside if you have a conflict of interest or cannot review this case fairly.</p>
          )}
        </div>
        {heading}
      </Card>
    );
  }

  const waiting = noReviewer ? { step: 'assign a reviewer', by: ROLE_LABEL.academic_administrator } : waitingFor(detail, appealReviewer);
  const keyAction = KEY_ACTION[detail.status](detail);
  const keyCheck = keyAction ? detail.action_checks.find((c) => c.action === keyAction) : undefined;
  const blockedBy = keyCheck && !keyCheck.allowed ? keyCheck.reasons[0]?.message : undefined;

  return (
    <Card role="region" aria-label="What happens next" className="flex flex-col gap-3 p-5">
      <h2 className="text-base font-semibold tracking-tight">What happens next</h2>
      {noReviewer && <p className="text-sm text-danger">{NO_REVIEWER_TEXT}</p>}
      <div className="flex flex-col gap-1 text-sm">
        <p>You can't act on this case yet.</p>
        {waiting && (
          <p className="flex items-center gap-2">
            <ArrowRight size={16} aria-hidden className="shrink-0 text-primary" />
            <span>
              <span className="font-medium">Next step:</span> {waiting.step} by {waiting.by}.
            </span>
          </p>
        )}
        {waiting && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Who can act:</span> {waiting.by}.
          </p>
        )}
        {detail.status === 'appeal_review' && (
          <p className="text-xs text-muted-foreground">
            If the appeal reviewer is unavailable, an administrator can reassign the appeal to someone else.
          </p>
        )}
        {blockedBy && <p className="text-xs text-muted-foreground">Why not: {blockedBy}</p>}
      </div>
      {heading}
    </Card>
  );
}
