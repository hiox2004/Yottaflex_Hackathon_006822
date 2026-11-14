// Rules: each rule version with its thresholds, a plain-language threshold ladder, and a worked example drawn with SimilarityStrip.
import type { Rule } from '../api/types';
import { useRules } from '../api/hooks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SimilarityStrip } from '../components/SimilarityStrip';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { BAND_LABEL, formatDate } from '../labels';
import { useSession } from '../session';

const fixed = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '-');

/** The three gates and the band each score range falls into. Scores are 0-1 after exclusions. */
function ThresholdLadder({ rule }: { rule: Rule }) {
  const rungs = [
    { band: 'no_action', from: 0, text: `Below ${fixed(rule.log_threshold)}: no action` },
    { band: 'log_only', from: rule.log_threshold, text: `${fixed(rule.log_threshold)} to ${fixed(rule.review_threshold)}: logged, no case` },
    { band: 'review', from: rule.review_threshold, text: `${fixed(rule.review_threshold)} to ${fixed(rule.priority_threshold)}: a case for review` },
    { band: 'priority_review', from: rule.priority_threshold, text: `${fixed(rule.priority_threshold)} and above: priority review` },
  ] as const;
  const tone = { no_action: 'neutral', log_only: 'primary', review: 'warning', priority_review: 'danger' } as const;
  return (
    <ol className="grid gap-2">
      {rungs.map((r) => (
        <li key={r.band} className="flex items-center gap-3 text-sm">
          <Badge tone={tone[r.band]} className="w-36 justify-center">
            {BAND_LABEL[r.band]}
          </Badge>
          <span>{r.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function RulesPage() {
  const { actorId } = useSession();
  const rules = useRules(actorId);
  const list = rules.data ?? [];
  const current = list.find((r) => r.effective_to === null);
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Rules</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Thresholds are versioned. A case keeps the rule version that was in force when it was flagged, so a later change never rewrites an
          earlier case.
        </p>
      </header>

      <ErrorBanner error={rules.error} />
      {rules.isPending && <p className="text-sm text-muted-foreground">Loading rules...</p>}

      {current && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>How a score becomes a band</CardTitle>
              <CardDescription>
                The adjusted score is on a 0 to 1 scale. Each gate it crosses moves the flag to a higher band, and only the top two bands open a case.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThresholdLadder rule={current} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Worked example</CardTitle>
              <CardDescription>
                A report with raw similarity 0.71, of which 0.12 is quoted and 0.05 is the assignment template, leaves 0.54 unexplained. That is
                below the review gate ({fixed(current.review_threshold)}), so it is not opened as a case. Quoted and template text are never counted
                against the learner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimilarityStrip unexplained={0.54} quoted={0.12} template={0.05} rule={current} />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4">
        {list.map((r) => {
          const inForce = r.effective_to === null;
          return (
            <Card key={`${r.rule_id}-${r.version}`}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  {r.rule_id} <span className="font-mono text-sm text-muted-foreground">v{r.version}</span>
                </CardTitle>
                <Badge tone={inForce ? 'success' : 'neutral'}>{inForce ? 'In force' : 'Superseded'}</Badge>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-5">
                  <div>
                    <dt className="text-muted-foreground">Logged from</dt>
                    <dd className="font-mono">{fixed(r.log_threshold)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Review from</dt>
                    <dd className="font-mono">{fixed(r.review_threshold)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Priority from</dt>
                    <dd className="font-mono">{fixed(r.priority_threshold)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Appeal window</dt>
                    <dd className="font-mono">{r.appeal_window_days} days</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Effective</dt>
                    <dd>
                      {formatDate(r.effective_from)} to {r.effective_to ? formatDate(r.effective_to) : 'now'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
