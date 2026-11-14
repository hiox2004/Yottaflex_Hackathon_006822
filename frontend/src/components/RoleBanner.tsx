// Who is acting, what that role can do here, and how many cases need the actor now. Collapsible; remembered per browser.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, Eye } from 'lucide-react';
import { useQueue, useReviewers } from '../api/hooks';
import { ROLE_LABEL } from '../labels';
import { ASSIGNED_ONLY_ROLES, ROLE_HELP } from '../lib/roleHelp';
import { ROLE_SCOPE, resolveActor } from '../lib/personas';
import { useSession } from '../session';
import { Button } from './ui/button';
import { Card } from './ui/card';

const HIDDEN_KEY = 'roleBanner:hidden';

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false; // storage blocked: the banner simply starts open
  }
}

function writeHidden(hidden: boolean) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0');
  } catch {
    // storage blocked: the choice lasts for this page view only
  }
}

export function RoleBanner({ page }: { page: 'overview' | 'cases' }) {
  const { actorId } = useSession();
  const [hidden, setHidden] = useState(readHidden);
  const reviewers = useReviewers(actorId);
  const queue = useQueue(actorId, {}, 1);

  const { name, role } = resolveActor(actorId, reviewers.data);
  const needsMe = queue.data?.counts?.needs_me;

  const toggle = (next: boolean) => {
    setHidden(next);
    writeHidden(next);
  };

  if (hidden) {
    return (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => toggle(false)} aria-expanded={false} aria-controls={`role-banner-${page}`}>
          <Eye className="size-4" aria-hidden />
          Show role help
        </Button>
      </div>
    );
  }

  const assignedOnly = role !== undefined && ASSIGNED_ONLY_ROLES.has(role);

  return (
    <Card id={`role-banner-${page}`} className="space-y-3 border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Acting as</span>
          <span className="font-medium">{name}</span>
          {role ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{ROLE_LABEL[role]}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Loading role…</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => toggle(true)} aria-expanded aria-controls={`role-banner-${page}`}>
          <ChevronUp className="size-4" aria-hidden />
          Hide
        </Button>
      </div>

      {role && (
        <div>
          <p className="text-sm font-medium">What you can do here</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {ROLE_HELP[role].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm">
        What needs you now:{' '}
        <Link to="/cases?tab=needs" className="font-medium text-primary hover:underline">
          {needsMe === undefined ? '…' : `${needsMe} ${needsMe === 1 ? 'case' : 'cases'}`}
        </Link>
      </p>

      {role && (
        <p className="rounded-md border border-dashed bg-background/60 p-3 text-sm text-muted-foreground">
          {ROLE_SCOPE[role]}
          {assignedOnly && ' If this is empty, switch to an administrator to assign you a case, or use Quick switch in the sidebar.'}
        </p>
      )}
    </Card>
  );
}
