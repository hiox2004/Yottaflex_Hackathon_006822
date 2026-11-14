// Case file: header with status, two columns. Left: similarity, decision trail, evidence, decisions, appeal. Right: progress, fairness gates, actions, reviewers, timeline.
// Learner view (actor id starts with LRN-): one plain column with the record and their own actions; staff internals are hidden.
import { ArrowLeft, CircleAlert, CircleCheck, CircleDashed, CircleX, SearchX, ShieldOff, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useCase, useEligible, useFindings, useReviewers, useTimeline } from '../api/hooks';
import { ApiError } from '../api/errors';
import type { AllowedAction, CaseDetail, DecisionOutcome } from '../api/types';
import { ActionDialog } from '../components/ActionDialog';
import { ActionList } from '../components/ActionList';
import { AssignedReviewers } from '../components/AssignedReviewers';
import { BandBadge, StatusBadge } from '../components/Badge';
import { AppealPanel, DecisionList, EvidenceList } from '../components/CaseRecord';
import { EnginePanel } from '../components/EnginePanel';
import { ErrorBanner } from '../components/ErrorBanner';
import { FairnessGates } from '../components/FairnessGates';
import { Hint } from '../components/Hint';
import { JourneyRail } from '../components/JourneyRail';
import { NextStep } from '../components/NextStep';
import { ReviewerPicker } from '../components/ReviewerPicker';
import { SimilarityStrip } from '../components/SimilarityStrip';
import { Timeline } from '../components/Timeline';
import { Badge, type Tone } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { formatDate, formatScore } from '../labels';
import { useSession } from '../session';

const DAY_MS = 86_400_000;

/** The result that applies to the learner now, as a badge. */
const EFFECTIVE_VIEW: Record<DecisionOutcome | 'undecided', { label: string; tone: Tone; icon: LucideIcon }> = {
  no_violation: { label: 'Cleared', tone: 'success', icon: CircleCheck },
  violation_confirmed: { label: 'Failed (violation confirmed)', tone: 'danger', icon: CircleX },
  inconclusive: { label: 'Inconclusive', tone: 'warning', icon: CircleAlert },
  undecided: { label: 'Undecided', tone: 'neutral', icon: CircleDashed },
};

/** The only actions a learner can take on their own case: add a statement, file an appeal. */
const LEARNER_ACTIONS: AllowedAction[] = ['add_evidence', 'file_appeal'];

/** The server refuses a case the signed-in person may not open (NOT_YOUR_CASE) or a role that may not use the endpoint (ROLE_NOT_ALLOWED). */
function isAccessDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && (error.code === 'NOT_YOUR_CASE' || error.code === 'ROLE_NOT_ALLOWED');
}

function AccessDenied() {
  return (
    <Card role="region" aria-label="This is not your case" className="flex flex-col items-start gap-3 p-6">
      <ShieldOff size={24} aria-hidden className="text-muted-foreground" />
      <h1 className="text-xl font-semibold tracking-tight">This is not your case</h1>
      <p className="text-sm text-muted-foreground">You can only open cases that belong to you, or cases your role is allowed to work on.</p>
      <Link to="/cases" className="text-sm text-primary underline underline-offset-2">
        Go to cases
      </Link>
    </Card>
  );
}

function reviewerCount(names: string[]): string {
  if (names.length === 0) return 'No reviewer is assigned yet.';
  const others = names.length - 1;
  const tail = others === 0 ? '' : others === 1 ? ' and 1 other' : ` and ${others} others`;
  return `Under review by ${names[0]}${tail}.`;
}

/** One plain-English sentence on where the case stands. */
function statusSentence(detail: CaseDetail, reviewers: { reviewer_id: string; name: string }[] | undefined): string {
  const appealReviewerId = detail.appeal?.reviewer_id ?? null;
  const appealReviewer = reviewers?.find((r) => r.reviewer_id === appealReviewerId)?.name ?? 'the appointed appeal reviewer';
  const lastDecision = detail.decisions.reduce<CaseDetail['decisions'][number] | null>(
    (latest, d) => (!latest || Date.parse(d.decided_at) > Date.parse(latest.decided_at) ? d : latest),
    null,
  );
  switch (detail.status) {
    case 'open':
      return 'Waiting for an administrator to assign a reviewer.';
    case 'under_review':
      return reviewerCount(detail.reviewers.map((r) => r.name));
    case 'decided': {
      if (detail.effective_outcome === 'no_violation') return 'Decided: learner cleared (no violation). Closed after the appeal window.';
      if (detail.effective_outcome === 'inconclusive') return 'Decided: inconclusive, so no violation is recorded against the learner.';
      if (detail.effective_outcome === 'violation_confirmed') {
        if (!lastDecision) return 'Decided: violation confirmed. The learner can appeal within the appeal window.';
        const end = formatDate(new Date(Date.parse(lastDecision.decided_at) + detail.flag.rule.appeal_window_days * DAY_MS).toISOString());
        return `Decided: violation confirmed. The learner can appeal until ${end}.`;
      }
      return 'Decided.';
    }
    case 'appealed':
      return 'Appeal filed. Waiting for an administrator to assign an independent reviewer.';
    case 'appeal_review':
      return `Appeal under review by ${appealReviewer}.`;
    case 'appeal_decided':
      return 'Appeal decided. Waiting for an administrator to close the case.';
    case 'closed':
      if (detail.appeal?.outcome === 'overturned') return 'Closed. The appeal overturned the original decision.';
      if (detail.appeal?.outcome === 'partially_upheld') return 'Closed. The appeal partly changed the original decision.';
      return 'Closed. Original decision stands.';
  }
}

export function CasePage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/cases';
  const { actorId } = useSession();
  const isLearner = actorId.startsWith('LRN-');
  const [openAction, setOpenAction] = useState<AllowedAction | null>(null);
  const detailQuery = useCase(actorId, id);
  const detail = detailQuery.data;
  // Assigning the appeal reviewer uses the appeal eligibility rules; every other status uses case rules.
  const purpose = detail?.status === 'appealed' || detail?.status === 'appeal_review' ? 'appeal' : 'case';
  const timeline = useTimeline(actorId, id);
  const findings = useFindings(actorId, id);
  const eligible = useEligible(actorId, id, purpose);
  const reviewers = useReviewers(actorId);
  const actor = reviewers.data?.find((r) => r.reviewer_id === actorId);

  // Staff-only queries are not shown to learners, so their refusals must not block the learner page.
  const watched = isLearner
    ? [detailQuery.error, timeline.error]
    : [detailQuery.error, timeline.error, findings.error, eligible.error, reviewers.error];
  if (watched.some(isAccessDenied)) {
    return (
      <div className="flex flex-col gap-4">
        <AccessDenied />
      </div>
    );
  }

  if (detailQuery.error) {
    if (detailQuery.error instanceof ApiError && detailQuery.error.status === 404) {
      return (
        <Card role="region" aria-label="Case not found" className="flex flex-col items-start gap-3 p-6">
          <SearchX size={24} aria-hidden className="text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight">Case not found</h1>
          <p className="text-sm text-muted-foreground">This case does not exist, or the link is out of date.</p>
          <Link to="/cases" className="text-sm text-primary underline underline-offset-2">
            Go to cases
          </Link>
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner error={detailQuery.error} />
        <Link to={from} className="text-sm text-primary underline underline-offset-2">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return <p className="text-sm text-muted-foreground">Loading case…</p>;
  const { flag } = detail;
  const effective = EFFECTIVE_VIEW[detail.effective_outcome ?? 'undecided'];
  const EffectiveIcon = effective.icon;

  const similarity = (
    <Card role="region" aria-label="Similarity" className="p-5">
      <h2 className="text-base font-semibold tracking-tight">Similarity</h2>
      <p className="mt-1 flex flex-wrap items-center gap-x-1 font-mono text-xs text-muted-foreground">
        raw {formatScore(flag.raw_score)} − quoted {formatScore(flag.quoted_score)} − template {formatScore(flag.template_score)} = adjusted{' '}
        {formatScore(flag.adjusted_score)}
        <Hint text="Adjusted score: the similarity left after removing properly quoted text and the shared assignment template. Only this part is treated as unexplained." />
      </p>
      <div className="mt-4">
        <SimilarityStrip unexplained={flag.adjusted_score} quoted={flag.quoted_score} template={flag.template_score} rule={flag.rule} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden /> Unexplained
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-warning" aria-hidden /> Quoted
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-muted-foreground/40" aria-hidden /> Assignment template
        </li>
      </ul>
    </Card>
  );

  const record = (
    <>
      <EnginePanel detail={detail} />
      <div id="evidence" className="scroll-mt-6">
        <EvidenceList detail={detail} />
      </div>
      <div id="decisions" className="scroll-mt-6">
        <DecisionList detail={detail} />
      </div>
      <div id="appeal" className="scroll-mt-6">
        <AppealPanel detail={detail} />
      </div>
    </>
  );

  const timelineBlock = (
    <div id="timeline" className="scroll-mt-6">
      <Timeline events={timeline.data} error={timeline.error} />
    </div>
  );

  const header = (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs text-muted-foreground">{detail.case_id}</span>
        <h1 className="text-2xl font-semibold tracking-tight">{isLearner ? `Your case: ${detail.assessment.title}` : detail.learner.name}</h1>
        <p className="text-sm text-muted-foreground">
          {isLearner ? `Opened ${formatDate(detail.opened_at)}` : `${detail.assessment.title} · ${detail.learner.department} · opened ${formatDate(detail.opened_at)}`}
        </p>
        <p className="mt-1 text-sm font-medium">{statusSentence(detail, reviewers.data)}</p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Badge tone={effective.tone} className="gap-1.5 px-3 py-1 text-sm font-semibold">
          <EffectiveIcon size={16} aria-hidden /> {effective.label}
          <Hint text="The result that applies to the learner now. It stays Undecided until a reviewer records a decision, and an appeal can change it." />
        </Badge>
        <div className="flex flex-wrap items-center gap-2">
          {!isLearner && <BandBadge band={flag.band} />}
          {!isLearner && <Hint text="Band: how strongly the adjusted score crossed the rule thresholds, from No action up to Priority review." />}
          {!isLearner && <StatusBadge status={detail.status} />}
        </div>
      </div>
    </Card>
  );

  const flagNote = (
    <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
      <strong className="font-semibold">A flag is not a finding.</strong> This case was flagged for review because of text similarity. Nothing is recorded against
      the learner until a reviewer decides.{' '}
      <Hint text="A flag means the text is similar enough to look at. It is not a finding of misconduct." />
    </p>
  );

  if (isLearner) {
    const learnerChecks = detail.action_checks.filter((c) => LEARNER_ACTIONS.includes(c.action));
    return (
      <div className="flex flex-col gap-6">
        <Link to={from} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} aria-hidden /> Back
        </Link>

        {header}
        {flagNote}

        <ActionDialog action={openAction} detail={detail} status={detail.status} onClose={() => setOpenAction(null)} />

        <div className="flex min-w-0 flex-col gap-6">
          {similarity}
          {record}
          <ActionList checks={learnerChecks} onAction={setOpenAction} status={detail.status} />
          {timelineBlock}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to={from} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden /> Back
      </Link>

      <NextStep
        detail={detail}
        actorName={actor?.name ?? actorId}
        actorRole={actor?.role}
        onAction={setOpenAction}
      />

      {header}
      {flagNote}

      <ActionDialog action={openAction} detail={detail} status={detail.status} onClose={() => setOpenAction(null)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {similarity}
          {record}
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <AssignedReviewers detail={detail} />
          <JourneyRail detail={detail} onAction={setOpenAction} />
          <FairnessGates detail={detail} findings={findings.data?.findings} error={findings.error} />
          <ActionList checks={detail.action_checks} onAction={setOpenAction} status={detail.status} />
          <Card role="region" aria-label="Reviewers" className="p-5">
            <h2 className="mb-3 text-base font-semibold tracking-tight">Reviewers</h2>
            {detail.reviewers.length === 0 && <p className="mb-3 text-sm text-muted-foreground">No reviewer assigned yet.</p>}
            <ul className="mb-3 flex flex-col gap-2">
              {detail.reviewers.map((r) => (
                <li key={r.reviewer_id} className="flex flex-col text-sm">
                  <strong className="font-semibold">{r.name}</strong>
                  <span className="text-xs text-muted-foreground">
                    {r.role_in_case} reviewer · since {formatDate(r.assigned_at)}
                  </span>
                </li>
              ))}
            </ul>
            <details className="group">
              <summary className="cursor-pointer text-sm text-primary underline underline-offset-2">Who can be assigned?</summary>
              <div className="mt-3">
                <ReviewerPicker people={eligible.data} error={eligible.error} />
              </div>
            </details>
          </Card>
          {timelineBlock}
        </aside>
      </div>
    </div>
  );
}
