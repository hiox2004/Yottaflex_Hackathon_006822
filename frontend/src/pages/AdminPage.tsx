// Administration: where the workload stands, which flagged cases need a reviewer, and who has capacity.
import { useWorkload } from '../api/admin';
import { ApiError } from '../api/errors';
import { KpiCards } from '../components/admin/KpiCards';
import { NeedsReviewer } from '../components/admin/NeedsReviewer';
import { ReadyToClose } from '../components/admin/ReadyToClose';
import { StaffWorkload } from '../components/admin/StaffWorkload';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useSession } from '../session';

export function AdminPage() {
  const { actorId } = useSession();
  const workload = useWorkload(actorId);

  if (workload.isPending) {
    return (
      <div role="status" aria-label="Loading administration" className="space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (workload.isError) {
    const forbidden = workload.error instanceof ApiError && workload.error.status === 403;
    return (
      <Card className="mx-auto mt-8 max-w-xl">
        <CardHeader>
          <CardTitle>{forbidden ? 'Administrators only' : 'Administration could not load'}</CardTitle>
          <CardDescription>
            {forbidden
              ? 'The workload view is for academic administrators. Switch person in the sidebar to an administrator.'
              : 'The server did not return the workload. Check the connection and try again.'}
          </CardDescription>
        </CardHeader>
        {!forbidden && (
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => void workload.refetch()}>
              Try again
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  const data = workload.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workload across cases and staff, as of {new Date(data.generated_at).toLocaleString()}.
        </p>
      </div>
      <KpiCards totals={data.totals} />
      <NeedsReviewer cases={data.suggested_for_unassigned} />
      <StaffWorkload reviewers={data.reviewers} />
      <ReadyToClose count={data.totals.decided_waiting_close} />
    </div>
  );
}
