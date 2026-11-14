// The control for the current stage: the action that advances the case, or who must act next and a way to switch to them.
// The server decides what is allowed (allowed_actions, action_checks); this file only routes the user to the right person.
import { useReviewers } from '../api/hooks';
import type { AllowedAction, CaseDetail, Role } from '../api/types';
import { actionLabel, NO_REVIEWER_TEXT } from '../labels';
import { PERSONAS, firstName } from '../lib/personas';
import { useSession } from '../session';
import { Button } from './ui/button';
import { WaiveCloseButton } from './ActionList';

type StageDetail = Pick<CaseDetail, 'status' | 'effective_outcome'>;

/** The actions that move a case on from each status, primary first. Copy and routing only. */
function stageActions(detail: StageDetail): AllowedAction[] {
  switch (detail.status) {
    case 'open':
      return ['assign_reviewer'];
    case 'under_review':
      return ['decide', 'add_evidence'];
    case 'decided':
      // A violation is appealed first; its close is refused until the appeal window ends (or is waived by an administrator).
      return detail.effective_outcome === 'violation_confirmed' ? ['file_appeal', 'close'] : ['close'];
    case 'appealed':
      return ['assign_appeal_reviewer'];
    case 'appeal_review':
      return ['decide_appeal', 'assign_appeal_reviewer'];
    case 'appeal_decided':
      return ['close'];
    case 'closed':
      return [];
  }
}

interface Need {
  /** Plain words for who must act, used in "Needs <who>". */
  who: string;
  /** Role-based need (administrator, support staff). */
  role?: Role;
  /** Person-based need (the assigned reviewer or appeal reviewer). */
  personId?: string;
}

function needFor(action: AllowedAction, detail: CaseDetail): Need {
  switch (action) {
    case 'decide': {
      const reviewer = detail.reviewers.find((r) => r.role_in_case === 'primary') ?? detail.reviewers[0];
      return { who: 'the assigned reviewer', personId: reviewer?.reviewer_id };
    }
    case 'decide_appeal':
      return { who: 'the appeal reviewer', personId: detail.appeal?.reviewer_id ?? undefined };
    case 'add_evidence':
    case 'file_appeal':
      return { who: 'support staff', role: 'support_staff' };
    default:
      return { who: 'an academic administrator', role: 'academic_administrator' };
  }
}

interface Props {
  detail: CaseDetail;
  onAction: (action: AllowedAction) => void;
}

export function StageControl({ detail, onAction }: Props) {
  const { actorId, changeActor } = useSession();
  const reviewers = useReviewers(actorId);
  // Under review with every reviewer stepped aside: the only stage action is an administrator assigning someone.
  const noReviewer = detail.status === 'under_review' && detail.reviewers.length === 0;
  const actions: AllowedAction[] = noReviewer ? ['assign_reviewer'] : stageActions(detail);
  if (actions.length === 0) return null;

  const primary = actions[0]!; // non-empty: checked above
  const actorRole = reviewers.data?.find((r) => r.reviewer_id === actorId)?.role;
  const allowed = actions.filter((a) => detail.allowed_actions.includes(a));
  const primaryAllowed = allowed.includes(primary);
  const need = needFor(primary, detail);
  const actorIsNeeded = need.role ? actorRole === need.role : need.personId === actorId;
  const reason = detail.action_checks.find((c) => c.action === primary && !c.allowed)?.reasons[0]?.message;
  const closeCheck = detail.action_checks.find((c) => c.action === 'close');

  // The person to switch to: a staff persona for role needs, the person actually assigned to this case otherwise.
  const target = (() => {
    if (need.role) {
      const persona = PERSONAS.find((p) => p.role === need.role);
      return persona ? { id: persona.id, name: firstName(persona.name) } : undefined;
    }
    if (!need.personId) return undefined;
    const name =
      reviewers.data?.find((r) => r.reviewer_id === need.personId)?.name ??
      detail.reviewers.find((r) => r.reviewer_id === need.personId)?.name;
    return name ? { id: need.personId, name: firstName(name) } : undefined;
  })();

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      {noReviewer && <p className="text-sm text-danger">{NO_REVIEWER_TEXT}</p>}
      {allowed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allowed.map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant={action === primary ? 'default' : 'outline'}
              onClick={() => onAction(action)}
            >
              {actionLabel(action, detail.status)}
            </Button>
          ))}
        </div>
      )}
      {detail.allowed_actions.includes('recuse') && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onAction('recuse')}>
            {actionLabel('recuse')}
          </Button>
          <span className="text-xs text-muted-foreground">Step aside if you have a conflict of interest or cannot review this case fairly.</span>
        </div>
      )}
      {closeCheck && !closeCheck.allowed && actions.includes('close') && (
        closeCheck.waivable ? (
          <WaiveCloseButton size="sm" onClick={() => onAction('close')} />
        ) : (
          primary !== 'close' && (
            <div className="flex flex-col gap-1">
              <Button type="button" size="sm" variant="outline" disabled className="self-start">
                Close the case
              </Button>
              <p className="text-xs text-muted-foreground">{closeCheck.reasons[0]?.message}</p>
            </div>
          )
        )
      )}
      {!primaryAllowed && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {actorIsNeeded ? (
            <p className="text-sm text-foreground">{actionLabel(primary, detail.status)} is not available yet.</p>
          ) : (
            <p className="text-sm text-foreground">Needs {need.who}.</p>
          )}
          {reason && <p>Why not: {reason}</p>}
          {!actorIsNeeded && target && target.id !== actorId && (
            <Button type="button" size="sm" variant="outline" className="mt-1 self-start" onClick={() => changeActor(target.id)}>
              Switch to {target.name}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
