// One case as a table row: case id link with a "Needs you" dot, learner, assessment, score with mini bar, badges, reviewers, opened date.
import { Link, useLocation } from 'react-router-dom';
import type { QueueRow, Rule } from '../api/types';
import { formatDate, formatScore } from '../labels';
import { BandBadge, StatusBadge } from './Badge';
import { SimilarityStrip } from './SimilarityStrip';
import { TD, TR } from './ui/table';

interface Props {
  row: QueueRow;
  rule: Rule | null;
  names: Map<string, string>;
}

export function CaseRow({ row, rule, names }: Props) {
  const location = useLocation();
  const assignees = row.assignee_ids.map((id) => names.get(id) ?? id).join(', ');
  return (
    <TR>
      <TD>
        <div className="flex items-center gap-2">
          {row.needs_my_action && (
            <span className="size-2 shrink-0 rounded-full bg-primary" role="img" aria-label="Needs you" title="Needs you" />
          )}
          <Link to={`/cases/${row.case_id}`} state={{ from: location.pathname + location.search }} className="font-mono text-xs font-medium whitespace-nowrap text-primary hover:underline">
            {row.case_id}
          </Link>
        </div>
      </TD>
      <TD className="font-medium">{row.learner_name}</TD>
      <TD className="min-w-48 text-muted-foreground">{row.assessment_title}</TD>
      <TD>
        <div className="flex items-center gap-3">
          <span className="w-12 font-mono text-xs tabular-nums">{formatScore(row.adjusted_score)}</span>
          <SimilarityStrip unexplained={row.adjusted_score} rule={rule} compact />
        </div>
      </TD>
      <TD>
        <BandBadge band={row.band} />
      </TD>
      <TD>
        <StatusBadge status={row.status} />
      </TD>
      <TD className="text-muted-foreground">{assignees || 'No reviewer yet'}</TD>
      <TD className="whitespace-nowrap text-muted-foreground">{formatDate(row.opened_at)}</TD>
    </TR>
  );
}
