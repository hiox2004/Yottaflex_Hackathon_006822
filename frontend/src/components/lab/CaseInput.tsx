// Step 2: paste the AI's JSON (or load a pack above) and run it through the engine. Parse errors show inline.
import { Play, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/field';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
  parseError: string | null;
  running: boolean;
}

export function CaseInput({ value, onChange, onRun, onClear, parseError, running }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paste the cases</CardTitle>
        <CardDescription>
          Paste the AI's reply. Markdown code fences are removed for you. Nothing is saved on the server; this tab keeps your input and results until you clear the session or close the tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          aria-label="Test cases JSON"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder={'{"cases": [ ... ]}'}
          className="h-56 font-mono text-xs"
          aria-invalid={parseError ? true : undefined}
        />
        {parseError && (
          <p role="alert" className="text-sm text-danger">
            {parseError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onRun} disabled={running || value.trim() === ''}>
            <Play className="size-4" />
            {running ? 'Running...' : 'Run through the engine'}
          </Button>
          <Button variant="ghost" onClick={onClear} disabled={running} className="ml-auto">
            <Trash2 className="size-4" />
            Clear session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
