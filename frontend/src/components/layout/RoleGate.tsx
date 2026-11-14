// Route guard: renders the page only when the current person's role may open it, else a plain explanation.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useReviewers } from '../../api/hooks';
import type { Role } from '../../api/types';
import { ROLE_LABEL } from '../../labels';
import { canOpen, isLearnerId, pagesFor, PAGE_LABEL, rolesFor, type PageKey } from '../../lib/access';
import { useSession } from '../../session';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

interface Props {
  page: PageKey;
  children: ReactNode;
}

export function RoleGate({ page, children }: Props) {
  const { actorId } = useSession();
  // Learners have no staff record, so their role is known without a lookup.
  if (isLearnerId(actorId)) return <Decide page={page} role="learner">{children}</Decide>;
  return <StaffGate page={page} actorId={actorId}>{children}</StaffGate>;
}

function StaffGate({ page, actorId, children }: Props & { actorId: string }) {
  const reviewers = useReviewers(actorId);
  if (reviewers.isPending) return <Skeleton />;
  // Unknown or unreachable person: no role, so nothing is opened.
  const role = reviewers.data?.find((r) => r.reviewer_id === actorId)?.role;
  return <Decide page={page} role={role}>{children}</Decide>;
}

function Decide({ page, role, children }: Props & { role: Role | undefined }) {
  if (role && canOpen(role, page)) return <>{children}</>;
  return <NotAvailable page={page} role={role} />;
}

function Skeleton() {
  return (
    <div role="status" aria-label="Checking access" className="space-y-3">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function NotAvailable({ page, role }: { page: PageKey; role: Role | undefined }) {
  const allowed = rolesFor(page).map((r) => ROLE_LABEL[r]).join(', ');
  const current = role ? ROLE_LABEL[role] : 'your account';
  const instead = role ? pagesFor(role).map((p) => PAGE_LABEL[p]).join(', ') : '';
  return (
    <Card className="mx-auto mt-8 max-w-xl">
      <CardHeader>
        <CardTitle>Not available for your role</CardTitle>
        <CardDescription>
          {PAGE_LABEL[page]} is open to: {allowed}. You are signed in as {current}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {instead && <p>As {current}, you can open: {instead}.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link to="/cases">Go to Cases</Link>
          </Button>
          <p className="text-muted-foreground">To try another role, use Switch person in the sidebar.</p>
        </div>
      </CardContent>
    </Card>
  );
}
