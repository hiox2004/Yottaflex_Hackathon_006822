// Always-visible one-sentence explanation of the platform, sits above the Topbar in the content column.
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PlatformStrip() {
  return (
    <div className="flex items-center gap-2 border-b bg-accent/60 px-4 py-1.5 text-sm text-foreground">
      <Info size={16} className="shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 line-clamp-2 sm:truncate">
        Turns similarity-checker flags into fair, traceable academic-integrity cases: a score only asks a human to look; conflict-free reviewers decide with written rationale and evidence, learners can appeal to an independent reviewer, and every step is kept in an audit trail.
      </p>
      <Link to="/guide" className="shrink-0 whitespace-nowrap font-medium text-primary underline-offset-4 hover:underline">
        How it works
      </Link>
    </div>
  );
}
