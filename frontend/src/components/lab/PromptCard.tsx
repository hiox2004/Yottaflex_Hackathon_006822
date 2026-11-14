// Step 1: the copy-paste prompt for an external AI, with a Copy button (Clipboard API, textarea fallback). When copying fails
// the prompt text is selected so the reviewer can copy it by hand, and the failure is said out loud.
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API blocked (http or permissions): fall back to a hidden textarea and execCommand.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

type CopyState = 'idle' | 'copied' | 'failed';

export function PromptCard({ prompt }: { prompt: string }) {
  const [copy, setCopy] = useState<CopyState>('idle');
  const promptRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (copy !== 'copied') return;
    const timer = window.setTimeout(() => setCopy('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copy]);

  const selectPrompt = () => {
    const node = promptRef.current;
    if (!node) return;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const onCopy = async () => {
    const ok = await copyText(prompt);
    setCopy(ok ? 'copied' : 'failed');
    if (!ok) selectPrompt();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Get test cases from an AI</CardTitle>
          <CardDescription>
            Copy this prompt into ChatGPT, Gemini or any other AI. It returns a JSON object of cases. Paste that JSON into step 2.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={onCopy} className="shrink-0">
          {copy === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copy === 'copied' ? 'Copied' : 'Copy prompt'}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {copy === 'failed' && (
          <p role="status" className="text-sm text-danger">
            Could not copy. Select the text and copy manually.
          </p>
        )}
        <pre
          ref={promptRef}
          tabIndex={0}
          aria-label="Prompt text"
          className="max-h-96 overflow-auto rounded-md border bg-muted p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground"
        >
          {prompt}
        </pre>
      </CardContent>
    </Card>
  );
}
