// Step 1b: pick an example pack. Load replaces the editor, Append adds the pack's cases below the current ones, and
// Load and run also runs them through the engine. Packs are plain data (lib/labPacks.ts), so nothing here is fetched.
import { FileJson, Layers, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import type { LabPack } from '../../lib/labPacks';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export interface PackFeedback {
  tone: 'ok' | 'error';
  text: string;
}

interface Props {
  packs: LabPack[];
  disabled: boolean;
  onLoad: (pack: LabPack) => void;
  onLoadAndRun: (pack: LabPack) => void;
  onAppend: (pack: LabPack) => PackFeedback;
}

export function PackPicker({ packs, disabled, onLoad, onLoadAndRun, onAppend }: Props) {
  const [feedback, setFeedback] = useState<PackFeedback | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Example packs</CardTitle>
        <CardDescription>
          Load a pack to fill the editor, or append it to combine packs. Loading replaces what is in the editor.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packs.map((pack) => (
            <li key={pack.id} className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold leading-snug">{pack.title}</h4>
                <Badge tone="primary">{pack.cases.length} cases</Badge>
              </div>
              <p className="flex-1 text-xs text-muted-foreground">{pack.description}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={disabled} onClick={() => onLoad(pack)}>
                  <FileJson className="size-3.5" />
                  Load
                </Button>
                <Button size="sm" disabled={disabled} onClick={() => onLoadAndRun(pack)}>
                  <Play className="size-3.5" />
                  Load and run
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => setFeedback(onAppend(pack))}
                >
                  <Plus className="size-3.5" />
                  Append to editor
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {feedback && (
          <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={feedback.tone === 'error' ? 'text-sm text-danger' : 'text-sm text-muted-foreground'}>
            {feedback.text}
          </p>
        )}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Layers className="size-3.5" />
          Append skips a case whose id is already in the editor, so combining packs never duplicates a case.
        </p>
      </CardContent>
    </Card>
  );
}
