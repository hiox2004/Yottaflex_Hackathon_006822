// Shortcut to the Decided tab, with the rule for which decided cases can be closed now.
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export function ReadyToClose({ count }: { count: number }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Cases ready to close</CardTitle>
          <CardDescription>
            Cleared and inconclusive cases can be closed now; confirmed violations wait for the appeal window or a recorded waiver.
          </CardDescription>
        </div>
        <span className="shrink-0 font-semibold tabular-nums">{count}</span>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link to="/cases?tab=decided">Open the Decided tab</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
