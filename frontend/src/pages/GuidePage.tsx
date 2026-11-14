// How review works: a plain-language guide to flags, cases, who acts when, the fairness rules and a glossary.
import { BookText, Check, Lightbulb, Minus, MousePointerClick, Route, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/table';
import {
  BIG_IDEA,
  FAIRNESS_RULES,
  GLOSSARY,
  GUIDE_INTRO,
  STEPS,
  TRY_IT,
  WHO_COLUMNS,
  WHO_NOTE,
  WHO_ROWS,
} from '../lib/guide';

function Mark({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check size={16} aria-hidden />
      <span className="sr-only">Allowed</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus size={16} aria-hidden />
      <span className="sr-only">Not allowed</span>
    </span>
  );
}

function Stepper() {
  return (
    <ol className="grid gap-0">
      {STEPS.map((step, i) => (
        <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
          {i < STEPS.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-border" />}
          <span
            aria-hidden
            className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-sm font-semibold text-primary"
          >
            {i + 1}
          </span>
          <div className="min-w-0 space-y-1.5">
            <h3 className="font-medium">{step.title}</h3>
            <div className="flex flex-wrap gap-1.5">
              {step.actors.map((actor) => (
                <Badge key={actor} tone={actor === 'Automatic' ? 'neutral' : 'primary'}>
                  {actor}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function GuidePage() {
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">How review works</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{GUIDE_INTRO}</p>
      </header>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb size={18} className="text-primary" aria-hidden />
            {BIG_IDEA.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {BIG_IDEA.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route size={18} className="text-primary" aria-hidden />
            The whole process, step by step
          </CardTitle>
          <CardDescription>Each step shows who acts. Steps marked Automatic are done by the system, not a person.</CardDescription>
        </CardHeader>
        <CardContent>
          <Stepper />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale size={18} className="text-primary" aria-hidden />
            Who can do what
          </CardTitle>
          <CardDescription>{WHO_NOTE}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Action</TH>
                  {WHO_COLUMNS.map((col) => (
                    <TH key={col} className="text-center">
                      {col}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {WHO_ROWS.map((row) => (
                  <TR key={row.action}>
                    <TD className="min-w-48">
                      <div className="font-medium">{row.action}</div>
                      <div className="text-xs text-muted-foreground">{row.note}</div>
                    </TD>
                    {row.allowed.map((yes, i) => (
                      <TD key={WHO_COLUMNS[i]} className="text-center">
                        <Mark yes={yes} />
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale size={18} className="text-primary" aria-hidden />
            Fairness rules the system enforces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {FAIRNESS_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MousePointerClick size={18} className="text-primary" aria-hidden />
            {TRY_IT.title}
          </CardTitle>
          <CardDescription>{TRY_IT.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to={TRY_IT.linkTo}>{TRY_IT.linkLabel}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookText size={18} className="text-primary" aria-hidden />
            Glossary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {GLOSSARY.map((item) => (
              <div key={item.term}>
                <dt className="font-medium">{item.term}</dt>
                <dd className="text-sm text-muted-foreground">{item.meaning}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
