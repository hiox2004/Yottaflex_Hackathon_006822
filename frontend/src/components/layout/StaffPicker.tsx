// "Switch person" dialog: staff (role-filtered, searchable) or learners (server search, top 20). Ids are shown so duplicate names stay distinct.
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useActors } from '../../api/hooks';
import type { Reviewer, Role } from '../../api/types';
import { ROLE_LABEL } from '../../labels';
import { initials, matchesStaff, sortStaff } from '../../lib/personas';
import { cn } from '../../lib/utils';
import { useSession } from '../../session';

type Mode = 'staff' | 'learners';
type StaffRole = Exclude<Role, 'learner'>;
type RoleFilter = 'all' | StaffRole;

const MODE_CHIPS: { value: Mode; label: string }[] = [
  { value: 'staff', label: 'Staff' },
  { value: 'learners', label: 'Learners' },
];

const ROLE_CHIPS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'academic_administrator', label: 'Administrator' },
  { value: 'support_staff', label: 'Support' },
  { value: 'academic_reviewer', label: 'Reviewer' },
  { value: 'instructor', label: 'Instructor' },
];

/** Server search returns at most this many learners (contract limit). */
const LEARNER_LIMIT = 20;

/** Initials circle used for staff rows and the sidebar's current-person card. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary', className)}
    >
      {initials(name)}
    </span>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Reviewer[];
}

export function StaffPicker({ open, onOpenChange, staff }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            searchRef.current?.focus();
          }}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border bg-card p-5 shadow-lg"
        >
          <PickerBody staff={staff} searchRef={searchRef} onDone={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Waits for typing to pause before a search goes to the server. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** Mounted fresh each time the dialog opens, so search, mode and filter reset on every open. */
function PickerBody({ staff, searchRef, onDone }: { staff: Reviewer[]; searchRef: RefObject<HTMLInputElement>; onDone: () => void }) {
  const { actorId, changeActor } = useSession();
  const [mode, setMode] = useState<Mode>('staff');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const settledQuery = useDebounced(query, 250);
  // Only the learners mode searches the server; staff come from the list already loaded.
  const learners = useActors('learner', mode === 'learners' ? settledQuery : '', LEARNER_LIMIT);
  const learnerRows = mode === 'learners' && query.trim() ? (learners.data ?? []) : [];

  const staffMatches = sortStaff(staff).filter((r) => (role === 'all' || r.role === role) && matchesStaff(r, query));

  const choose = (id: string) => {
    changeActor(id);
    onDone();
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const firstId = mode === 'staff' ? staffMatches[0]?.reviewer_id : learnerRows[0]?.actor_id;
    if (firstId) {
      e.preventDefault();
      choose(firstId);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Dialog.Title className="text-base font-semibold">Switch person</Dialog.Title>
          <p className="text-xs text-muted-foreground">Names can repeat. Check the ID before you switch.</p>
        </div>
        <Dialog.Close className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
          <X size={18} aria-hidden />
        </Dialog.Close>
      </div>

      <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
        {MODE_CHIPS.map((chip) => (
          <Chip key={chip.value} active={chip.value === mode} onClick={() => setMode(chip.value)}>
            {chip.label}
          </Chip>
        ))}
      </div>

      <div className="relative">
        <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          type="search"
          autoComplete="off"
          aria-label={mode === 'staff' ? 'Search staff' : 'Search learners'}
          placeholder={mode === 'staff' ? 'Search name, department, role or ID' : 'Type a name or LRN id'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          className="h-9 w-full rounded-md border bg-card pr-3 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-primary"
        />
      </div>

      {mode === 'staff' ? (
        <>
          <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-1.5">
            {ROLE_CHIPS.map((chip) => (
              <Chip key={chip.value} active={chip.value === role} onClick={() => setRole(chip.value)}>
                {chip.label}
              </Chip>
            ))}
          </div>

          <p className="text-xs text-muted-foreground tabular-nums">
            {staffMatches.length} {staffMatches.length === 1 ? 'person' : 'people'}
            {query.trim() && ' · Enter picks the first match'}
          </p>

          <ul aria-label="Staff" className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
            {staffMatches.map((r) => (
              <PersonRow
                key={r.reviewer_id}
                id={r.reviewer_id}
                name={r.name}
                current={r.reviewer_id === actorId}
                meta={`${ROLE_LABEL[r.role]} · ${r.department}`}
                onPick={choose}
              />
            ))}
            {staffMatches.length === 0 && <EmptyRow>No one matches “{query.trim()}”.</EmptyRow>}
          </ul>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            {!query.trim() && 'Type a name or LRN id to find a learner.'}
            {query.trim() && learners.isError && 'Learner search is not available right now.'}
            {query.trim() && !learners.isError && !learners.data && 'Searching…'}
            {query.trim() && learners.data && (
              <>
                {learnerRows.length} {learnerRows.length === 1 ? 'learner' : 'learners'}
                {learnerRows.length >= LEARNER_LIMIT ? ` · first ${LEARNER_LIMIT} shown, type more to narrow` : ' · Enter picks the first match'}
              </>
            )}
          </p>

          <ul aria-label="Learners" className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
            {learnerRows.map((a) => (
              <PersonRow
                key={a.actor_id}
                id={a.actor_id}
                name={a.name}
                current={a.actor_id === actorId}
                meta={`${ROLE_LABEL[a.role]} · ${a.department}`}
                onPick={choose}
              />
            ))}
            {query.trim() && learners.data && learnerRows.length === 0 && <EmptyRow>No learner matches “{query.trim()}”.</EmptyRow>}
          </ul>
        </>
      )}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function PersonRow({ id, name, meta, current, onPick }: { id: string; name: string; meta: string; current: boolean; onPick: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        aria-current={current ? 'true' : undefined}
        onClick={() => onPick(id)}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary',
          current && 'bg-primary/10',
        )}
      >
        <Avatar name={name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{id}</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{meta}</span>
            {current && (
              <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-primary">
                <Check size={12} aria-hidden />
                Current
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <li className="px-2 py-6 text-center text-sm text-muted-foreground">{children}</li>;
}
