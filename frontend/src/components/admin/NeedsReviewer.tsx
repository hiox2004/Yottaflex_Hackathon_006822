// Open cases with no reviewer, each with suggested reviewers and their current load. Assigning happens on the case page.
import { Link } from 'react-router-dom';
import type { UnassignedCase } from '../../api/admin';
import { BAND_LABEL, formatScore } from '../../labels';
import { BandBadge } from '../Badge';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export function NeedsReviewer({ cases }: { cases: UnassignedCase[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs a reviewer</CardTitle>
        <CardDescription>Flagged cases with no reviewer yet. Suggestions are the least-loaded eligible staff; open the case to assign.</CardDescription>
      </CardHeader>
      <CardContent>
        {cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No case is waiting for a reviewer.</p>
        ) : (
          <ul className="divide-y">
            {cases.map((item) => (
              <li key={item.case_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/cases/${item.case_id}`} state={{ from: '/admin' }} className="font-mono text-xs text-primary hover:underline">
                      {item.case_id}
                    </Link>
                    <BandBadge band={item.band} />
                    <span className="font-mono text-xs tabular-nums text-muted-foreground" title={`${BAND_LABEL[item.band]} score`}>
                      score {formatScore(item.adjusted_score)}
                    </span>
                  </div>
                  <div className="truncate text-sm font-medium">{item.learner_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{item.assessment_title}</div>
                  <div className="flex flex-wrap gap-1.5 pt-1" aria-label={`Suggested reviewers for ${item.case_id}`}>
                    {item.suggested.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No eligible reviewer found.</span>
                    ) : (
                      item.suggested.map((s) => (
                        <Badge key={s.reviewer_id} tone={s.active_cases === 0 ? 'success' : 'neutral'}>
                          {s.name}
                          <span className="ml-1.5 tabular-nums opacity-80">{s.active_cases} active</span>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={`/cases/${item.case_id}`} state={{ from: '/admin' }}>
                    Open to assign
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
