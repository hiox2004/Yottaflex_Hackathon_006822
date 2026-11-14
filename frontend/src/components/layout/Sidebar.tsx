// Left navigation with brand, route links and the current-person card (switch dialog plus quick-switch personas).
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, ClipboardCheck, FlaskConical, GraduationCap, IdCard, Inbox, LayoutDashboard, LifeBuoy, ScrollText, ShieldCheck, UserCog, Users, type LucideIcon } from 'lucide-react';
import { useQueue, useReviewers } from '../../api/hooks';
import type { Role } from '../../api/types';
import { ROLE_LABEL } from '../../labels';
import { ASSIGNED_ONLY, PERSONAS, ROLE_DOES, firstName, resolveActor } from '../../lib/personas';
import { cn } from '../../lib/utils';
import { useSession } from '../../session';
import { Button } from '../ui/button';
import { Avatar, StaffPicker } from './StaffPicker';

// hideFor: roles that cannot open the page (the server answers 403 ROLE_NOT_ALLOWED for learners).
// onlyFor: the only roles that see the item (administrators' workload view).
const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean; hideFor?: Role[]; onlyFor?: Role[] }[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/guide', label: 'Guide', icon: BookOpen },
  { to: '/cases', label: 'Cases', icon: Inbox },
  { to: '/lab', label: 'Test Lab', icon: FlaskConical, hideFor: ['learner'] },
  { to: '/audit', label: 'Audit', icon: ScrollText, hideFor: ['learner'] },
  { to: '/rules', label: 'Rules', icon: BookOpen },
  { to: '/admin', label: 'Administration', icon: UserCog, onlyFor: ['academic_administrator'] },
];

const ROLE_ICON: Record<Role, LucideIcon> = {
  academic_administrator: UserCog,
  support_staff: LifeBuoy,
  academic_reviewer: ClipboardCheck,
  instructor: GraduationCap,
  learner: IdCard,
};

interface Props {
  open: boolean;
  onNavigate: () => void;
}

export function Sidebar({ open, onNavigate }: Props) {
  const { actorId, changeActor } = useSession();
  const reviewers = useReviewers(actorId);
  const queue = useQueue(actorId, { needs_my_action: true }, 1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { name, role, department } = resolveActor(actorId, reviewers.data);
  const links = NAV.filter((item) => !(role && item.hideFor?.includes(role)) && (!item.onlyFor || (role !== undefined && item.onlyFor.includes(role))));

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r bg-sidebar transition-transform md:static md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b px-5 py-2 font-semibold">
        <ShieldCheck size={22} className="shrink-0 text-primary" aria-hidden />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="break-words">YottaFlex Hackathon</span>
          <span className="text-xs font-normal text-muted-foreground">Similarity flags &amp; due process</span>
        </span>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 p-3">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon size={18} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto shrink-0 space-y-2 border-t p-3">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Acting as</span>
          {queue.data && (
            <span className="rounded-full bg-primary/15 px-1.5 tabular-nums text-primary">needs you: {queue.data.counts.needs_me}</span>
          )}
        </div>

        <div className="flex items-center gap-2.5 rounded-md border bg-card p-2">
          <Avatar name={name} className="size-8 text-[11px]" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              {role && <span className="shrink-0 rounded-full bg-muted px-1.5 py-px font-medium text-foreground">{ROLE_LABEL[role]}</span>}
              {department && <span className="truncate">{department}</span>}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">{actorId}</div>
          </div>
        </div>

        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setPickerOpen(true)}>
          <Users size={14} aria-hidden />
          Switch person
        </Button>
        <StaffPicker open={pickerOpen} onOpenChange={setPickerOpen} staff={reviewers.data ?? []} />

        <div className="grid grid-cols-2 gap-1" role="group" aria-label="Quick switch">
          {PERSONAS.map((p) => {
            const Icon = ROLE_ICON[p.role];
            const active = p.id === actorId;
            return (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                onClick={() => changeActor(p.id)}
                className={cn('h-auto flex-col items-start gap-0 px-2 py-1 text-left', p.role === 'learner' && 'col-span-2')}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon size={13} aria-hidden />
                  {firstName(p.name)}
                </span>
                <span className={cn('text-[11px] font-normal', active ? 'opacity-90' : 'text-muted-foreground')}>
                  {ROLE_LABEL[p.role]}
                </span>
              </Button>
            );
          })}
        </div>

        {role && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {ROLE_DOES[role]}
            {ASSIGNED_ONLY.includes(role) && ' Only sees cases assigned to them.'}
          </p>
        )}
      </div>
    </aside>
  );
}
