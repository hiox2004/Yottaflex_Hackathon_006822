// One queue row: score strip, learner and assessment, badges, who is waiting. Stacks on narrow screens.
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { QueueRow, Rule } from '../api/types';
import { formatDate, formatScore, NEXT_STEP } from '../labels';
import { BandBadge, StatusBadge } from './Badge';
import { SimilarityStrip } from './SimilarityStrip';

interface Props {
  row: QueueRow;
  rule: Rule | null;
  names: Map<string, string>;
}

export function CaseRow({ row, rule, names }: Props) {
  const assignees = row.assignee_ids.map((id) => names.get(id) ?? id).join(', ');
  return (
    <li>
      <Link to={`/cases/${row.case_id}`} className={`case-row band-${row.band}`}>
        <div className="case-score">
          <span className="mono score">{formatScore(row.adjusted_score)}</span>
          <SimilarityStrip unexplained={row.adjusted_score} rule={rule} compact />
        </div>
        <div className="case-main">
          <span className="case-title">{row.learner_name}</span>
          <span className="muted">{row.assessment_title}</span>
          <span className="mono muted small">{row.case_id}</span>
        </div>
        <div className="case-badges">
          <BandBadge band={row.band} />
          <StatusBadge status={row.status} />
        </div>
        <div className="case-next">
          {row.needs_my_action && <span className="you-chip">Waiting on you</span>}
          <span className="small">{NEXT_STEP[row.status]}</span>
          <span className="muted small">
            {assignees ? `Reviewer: ${assignees}` : 'No reviewer yet'} · opened {formatDate(row.opened_at)}
          </span>
        </div>
        <ArrowRight size={18} className="case-go" aria-hidden />
      </Link>
    </li>
  );
}
