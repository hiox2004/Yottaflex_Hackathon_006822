// Dialog around the form for the chosen action. A successful write replaces the cached case and closes the dialog;
// a refused one shows the server's message inside the dialog and keeps the form open.
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useCaseWrite } from '../api/hooks';
import type { AllowedAction, CaseDetail, Status, TimelineEvent } from '../api/types';
import { actionLabel, CLOSE_EARLY_LABEL, EVENT_LABEL } from '../labels';
import { useSession } from '../session';
import {
  AppealOutcomeForm,
  AssignAppealReviewerForm,
  AssignReviewerForm,
  CloseForm,
  DecisionForm,
  EvidenceForm,
  isWaiverClose,
  RecuseForm,
  TextForm,
} from './ActionForms';
import { ErrorBanner } from './ErrorBanner';
import { toast } from './Toast';

/** What the case needs next, shown in the confirmation after a successful write. */
const NEXT_HINT: Record<Status, string> = {
  open: 'assign a reviewer',
  under_review: 'reviewer records a decision',
  decided: 'file an appeal (if violation confirmed) or close (cleared and inconclusive close now)',
  appealed: 'assign an independent appeal reviewer',
  appeal_review: 'appeal reviewer decides the appeal',
  appeal_decided: 'close the case',
  closed: 'case is closed',
};

interface Props {
  action: AllowedAction | null;
  detail: CaseDetail;
  /** Optional: the case status, used for the title (defaults to detail.status). */
  status?: Status;
  onClose: () => void;
}

export function ActionDialog({ action, detail, status, onClose }: Props) {
  const { actorId } = useSession();
  const client = useQueryClient();
  const write = useCaseWrite(actorId, detail.case_id);
  const timelineKey = ['timeline', actorId, detail.case_id];
  const descriptionId = useId();
  // Bumped whenever the dialog closes or unmounts, so a request still in flight knows nobody is waiting for its toast.
  const openToken = useRef(0);
  useEffect(() => () => {
    openToken.current += 1;
  }, []);
  const submit = (path: string, body: unknown) => {
    const done = action;
    const token = openToken.current;
    write.mutate(
      { path, body },
      {
        onSuccess: async (updated) => {
          // Read back the event the server just appended, so the toast names what was actually logged.
          await client.refetchQueries({ queryKey: timelineKey });
          // Closed while in flight: the cache is already updated by the hook, so stop here and reopen nothing.
          if (openToken.current !== token) return;
          const events = client.getQueryData<TimelineEvent[]>(timelineKey) ?? [];
          const logged: TimelineEvent | undefined = events[events.length - 1];
          const next = NEXT_HINT[updated.status];
          if (logged) {
            const ref = logged.ref_id ? ` · ${logged.ref_id}` : '';
            toast(`Logged: ${EVENT_LABEL[logged.event_type]} by ${logged.actor_name ?? 'system'}${ref}. Next: ${next}`);
          } else if (done) {
            toast(`${actionLabel(done, updated.status)} done. Next: ${next}`);
          }
          onClose();
        },
      },
    );
  };
  const p = { detail, onSubmit: submit, busy: write.isPending };

  const forms: Record<AllowedAction, JSX.Element> = {
    assign_reviewer: <AssignReviewerForm {...p} />,
    add_evidence: <EvidenceForm {...p} />,
    reopen: <TextForm path="/reopen" field="reason" label="Reason for reopening" submitLabel="Reopen" onSubmit={submit} busy={p.busy} />,
    decide: <DecisionForm {...p} />,
    recuse: <RecuseForm onSubmit={submit} busy={p.busy} />,
    file_appeal: <TextForm path="/appeal" field="grounds" label="Grounds for the appeal" submitLabel="File appeal" onSubmit={submit} busy={p.busy} />,
    assign_appeal_reviewer: <AssignAppealReviewerForm {...p} />,
    decide_appeal: <AppealOutcomeForm {...p} />,
    close: <CloseForm {...p} />,
  };

  return (
    <Dialog.Root
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) {
          openToken.current += 1;
          write.reset();
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          aria-describedby={descriptionId}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border bg-card p-6 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold tracking-tight">{action === 'close' && isWaiverClose(detail) ? CLOSE_EARLY_LABEL : action ? actionLabel(action, status ?? detail.status) : ''}</Dialog.Title>
            <Dialog.Close
              aria-label="Close dialog"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description id={descriptionId} className="sr-only">
            Complete the form and submit. The server checks the case rules and shows any refusal in this dialog.
          </Dialog.Description>
          <ErrorBanner error={write.error} />
          {action && forms[action]}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
