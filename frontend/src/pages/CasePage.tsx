// Case file: strip, fairness gates, engine panel (switch), record, timeline; sidebar with next step, actions and reviewers.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCase, useEligible, useFindings, useTimeline } from '../api/hooks';
import type { AllowedAction } from '../api/types';
import { ActionList } from '../components/ActionList';
import { BandBadge, StatusBadge } from '../components/Badge';
import { AppealPanel, DecisionList, EvidenceList } from '../components/CaseRecord';
import { EnginePanel } from '../components/EnginePanel';
import { ErrorBanner } from '../components/ErrorBanner';
import { FairnessGates } from '../components/FairnessGates';
import { JourneyRail } from '../components/JourneyRail';
import { ReviewerPicker } from '../components/ReviewerPicker';
import { SimilarityStrip } from '../components/SimilarityStrip';
import { Timeline } from '../components/Timeline';
import { formatDate, formatScore, NEXT_STEP, OUTCOME_LABEL } from '../labels';
import { useSession } from '../session';

export function CasePage() {
  const { id = '' } = useParams();
  const { actorId, engine } = useSession();
  const [, setOpenAction] = useState<AllowedAction | null>(null); // wired to forms in M3
  const detailQuery = useCase(actorId, id);
  const timeline = useTimeline(actorId, id);
  const findings = useFindings(actorId, id);
  const eligible = useEligible(actorId, id, 'case', true);
  const detail = detailQuery.data;

  if (detailQuery.error) {
    return (
      <>
        <ErrorBanner error={detailQuery.error} />
        <Link to="/">Back to the queue</Link>
      </>
    );
  }
  if (!detail) return <p className="muted">Loading case…</p>;
  const { flag } = detail;

  return (
    <>
      <p className="crumbs">
        <Link to="/">Queue</Link> / <span className="mono">{detail.case_id}</span>
      </p>
      <div className="case-head">
        <div>
          <h1>{detail.learner.name}</h1>
          <p className="muted">
            {detail.assessment.title} · {detail.learner.department} · opened {formatDate(detail.opened_at)}
          </p>
        </div>
        <div className="case-head-badges">
          <BandBadge band={flag.band} />
          <StatusBadge status={detail.status} />
          {detail.effective_outcome && <span className="badge tone-neutral">{OUTCOME_LABEL[detail.effective_outcome]}</span>}
        </div>
      </div>
      <p className="notice">
        <strong>A flag is not a finding.</strong> This case was flagged for review because of text similarity. Nothing is recorded against the learner
        until a reviewer decides.
      </p>
      <JourneyRail detail={detail} />
      <div className="case-layout">
        <div className="case-col">
          <section className="card" aria-label="Similarity">
            <h2>Similarity</h2>
            <p className="muted small mono">
              raw {formatScore(flag.raw_score)} − quoted {formatScore(flag.quoted_score)} − template {formatScore(flag.template_score)} = adjusted{' '}
              {formatScore(flag.adjusted_score)}
            </p>
            <SimilarityStrip unexplained={flag.adjusted_score} quoted={flag.quoted_score} template={flag.template_score} rule={flag.rule} />
            <ul className="legend small">
              <li><span className="key key-unexplained" /> Unexplained</li>
              <li><span className="key key-quoted" /> Quoted</li>
              <li><span className="key key-template" /> Assignment template</li>
            </ul>
          </section>
          {engine && <EnginePanel detail={detail} />}
          <FairnessGates detail={detail} findings={findings.data?.findings} />
          <EvidenceList detail={detail} />
          <DecisionList detail={detail} />
          <AppealPanel detail={detail} />
          <Timeline events={timeline.data} />
        </div>
        <aside className="case-col">
          <section className="card next">
            <h2>Next</h2>
            <p>{NEXT_STEP[detail.status]}</p>
          </section>
          <ActionList checks={detail.action_checks} onAction={setOpenAction} />
          <section aria-label="Reviewers">
            <h2>Reviewers</h2>
            {detail.reviewers.length === 0 && <p className="muted small">No reviewer assigned yet.</p>}
            <ul className="records">
              {detail.reviewers.map((r) => (
                <li key={r.reviewer_id}>
                  <strong>{r.name}</strong>
                  <span className="small muted">{r.role_in_case} reviewer · since {formatDate(r.assigned_at)}</span>
                </li>
              ))}
            </ul>
            <details className="eligible">
              <summary>Who can be assigned?</summary>
              <ReviewerPicker people={eligible.data} />
            </details>
          </section>
        </aside>
      </div>
    </>
  );
}
