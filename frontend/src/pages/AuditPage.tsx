// Audit: live findings (each links to its case), auditor precision/recall/F1, triage per scenario, validation summary.
import { Link } from 'react-router-dom';
import { useAuditMetrics, useAuditValidation, useFindings } from '../api/hooks';
import type { IssueType } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';
import { useSession } from '../session';

const ISSUE_LABEL: Record<IssueType, string> = {
  AUTO_GUILT_WITHOUT_REVIEW: 'Confirmed without human review',
  REVIEWER_CONFLICT: 'Reviewer with a conflict of interest',
  EVIDENCE_AFTER_DECISION_NO_HISTORY: 'Evidence changed after decision, no reopen',
  APPEAL_CLOSED_NO_INDEPENDENT_REVIEW: 'Appeal closed without independent review',
};

const pct = (n: number) => n.toFixed(3);

export function AuditPage() {
  const { actorId } = useSession();
  const findings = useFindings(actorId);
  const metrics = useAuditMetrics(actorId);
  const validation = useAuditValidation(actorId);
  return (
    <>
      <div className="page-head">
        <h1>Audit</h1>
        <p className="lede">
          The auditor is a separate program that re-reads the database and looks for due-process failures. Each finding links to its case, where the
          matching fairness gate shows red.
        </p>
      </div>
      <p className="notice">
        <strong>Synthetic data.</strong> Scores below show that the rules and the auditor cover the generated scenarios. They do not show how
        well either generalises to real submissions.
      </p>

      <section aria-label="Findings">
        <h2>Live findings</h2>
        <ErrorBanner error={findings.error} />
        {findings.data?.findings.length === 0 && <p className="empty">The auditor found no failures.</p>}
        <ul className="records">
          {findings.data?.findings.map((f) => (
            <li key={`${f.issue_type}-${f.entity_id}`}>
              <strong>{ISSUE_LABEL[f.issue_type]}</strong>
              <span>{f.detail}</span>
              <span className="small mono">
                <Link to={`/cases/${f.case_id}`}>{f.case_id}</Link> · {f.entity_id}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Auditor accuracy" className="audit-block">
        <h2>Auditor accuracy</h2>
        <ErrorBanner error={metrics.error} />
        {metrics.data && (
          <>
            <table className="table">
              <thead>
                <tr><th>Issue type</th><th>Precision</th><th>Recall</th><th>F1</th><th>Labelled</th></tr>
              </thead>
              <tbody>
                {metrics.data.auditor.map((m) => (
                  <tr key={m.issue_type}>
                    <td>{ISSUE_LABEL[m.issue_type]}</td>
                    <td className="mono">{pct(m.precision)}</td>
                    <td className="mono">{pct(m.recall)}</td>
                    <td className="mono">{pct(m.f1)}</td>
                    <td className="mono">{m.labelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2>Triage by scenario</h2>
            <table className="table">
              <thead>
                <tr><th>Scenario</th><th>Cases</th><th>Flagged</th><th>Dismissed</th></tr>
              </thead>
              <tbody>
                {metrics.data.triage.map((t) => (
                  <tr key={t.scenario}>
                    <td className="mono">{t.scenario}</td>
                    <td className="mono">{t.cases}</td>
                    <td className="mono">{t.flagged}</td>
                    <td className="mono">{t.dismissed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted mono">Dataset {metrics.data.dataset_hash}</p>
          </>
        )}
      </section>

      <section aria-label="Validation" className="audit-block">
        <h2>Validation summary</h2>
        <ErrorBanner error={validation.error} />
        {validation.data && (
          <>
            <dl className="facts">
              {Object.entries(validation.data.counts).map(([name, n]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd className="mono">{n}</dd>
                </div>
              ))}
            </dl>
            <ul className="records">
              {validation.data.checks.map((c) => (
                <li key={c.name}>
                  <span className={c.passed ? 'badge tone-ok' : 'badge tone-fail'}>{c.passed ? 'Passed' : `Failed (${c.violations})`}</span>
                  <span>{c.name}</span>
                </li>
              ))}
            </ul>
            {validation.data.distributions.map((d) => (
              <div key={d.title}>
                <h3>{d.title}</h3>
                <p className="small mono">{d.rows.map((r) => `${r.label} ${r.count}`).join(' · ')}</p>
              </div>
            ))}
          </>
        )}
      </section>
    </>
  );
}
