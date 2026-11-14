// Who is on the case, what the signed-in person can do with it, and a banner when that is them.
import { useReviewers } from '../api/hooks';
import type { CaseDetail } from '../api/types';
import { formatDateTime, ROLE_LABEL } from '../labels';
import { useSession } from '../session';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

export function AssignedReviewers({ detail }: { detail: CaseDetail }) {
  const { actorId } = useSession();
  const reviewers = useReviewers(actorId);
  const me = reviewers.data?.find((r) => r.reviewer_id === actorId);
  const assigned = detail.reviewers.some((r) => r.reviewer_id === actorId);
  const canReview = me?.role === 'academic_reviewer' || me?.role === 'instructor';

  return (
    <Card role="region" aria-label="Assigned reviewers" className="flex flex-col gap-3 p-5">
      <h2 className="text-base font-semibold tracking-tight">Assigned reviewers</h2>

      {detail.reviewers.length === 0 ? (
        detail.status === 'under_review' ? (
          <p role="status" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            No active reviewer: waiting for an administrator
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No reviewer assigned yet.</p>
        )
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {detail.reviewers.map((r) => (
            <li key={r.reviewer_id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.name}</span>
              <Badge tone={r.role_in_case === 'primary' ? 'primary' : 'neutral'}>{r.role_in_case}</Badge>
              {r.reviewer_id === actorId && <Badge tone="success">You</Badge>}
              <span className="text-xs text-muted-foreground">assigned {formatDateTime(r.assigned_at)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Who can change this case now: assigned reviewers can add evidence and record the decision; administrators assign and reassign
        reviewers; support staff add evidence.
      </p>

      {assigned && detail.status === 'under_review' ? (
        <p role="status" className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          You are assigned to this case. You can add evidence and record the decision.
        </p>
      ) : (
        !assigned &&
        canReview && (
          <p className="text-sm text-muted-foreground">
            You are not assigned to this case, so you can only view it.
            {me && <span> ({ROLE_LABEL[me.role]})</span>}
          </p>
        )
      )}
    </Card>
  );
}
