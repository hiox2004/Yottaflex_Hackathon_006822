// "Try the workflow": the 7-step case lifecycle, each step with a persona switch and a link to the matching Cases tab.
import { Link } from 'react-router-dom';
import { PERSONAS, firstName, type Persona } from '../lib/personas';
import { useSession } from '../session';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface Step {
  text: string;
  /** Personas that can do this step; one switch button each. */
  personas: Persona[];
  tab: 'needs' | 'decided' | 'awaiting_appeal';
}

const persona = (id: string): Persona => PERSONAS.find((p) => p.id === id) as Persona;
const VIK = persona('REV-000001');
const SAM = persona('REV-000007');
const BEN = persona('REV-000018');
const TARA = persona('REV-000048');

const STEPS: Step[] = [
  { text: 'Admin assigns a reviewer to the open case.', personas: [VIK], tab: 'needs' },
  { text: 'Support staff or the assigned reviewer adds evidence.', personas: [SAM], tab: 'needs' },
  { text: 'Assigned reviewer decides, with a rationale.', personas: [TARA], tab: 'needs' },
  { text: 'Support staff or admin files an appeal (only when a violation is confirmed).', personas: [SAM], tab: 'decided' },
  { text: 'Admin assigns an independent appeal reviewer.', personas: [VIK], tab: 'needs' },
  {
    text: 'The appeal reviewer the admin chose decides the appeal (any independent instructor or academic reviewer; e.g. try Tara Abara or Ben Novak).',
    personas: [TARA, BEN],
    tab: 'awaiting_appeal',
  },
  { text: 'Admin closes the case.', personas: [VIK], tab: 'needs' },
];

export function PersonaGuide() {
  const { changeActor } = useSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Try the workflow</CardTitle>
        <CardDescription>Each step is a different role. Switch persona, do the step, then move on.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2 text-sm">
          {STEPS.map((step, i) => (
            <li key={step.text} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex min-w-0 flex-1 gap-2">
                <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
                <span>{step.text}</span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-2 pl-5 sm:pl-0">
                {step.personas.map((p) => (
                  <Button key={p.id} size="sm" variant="outline" onClick={() => changeActor(p.id)}>
                    Switch to {firstName(p.name)}
                  </Button>
                ))}
                <Link to={`/cases?tab=${step.tab}`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                  Open cases
                </Link>
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
