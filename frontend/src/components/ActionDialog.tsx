// Dialog around the form for the chosen action. A successful write replaces the cached case and closes the dialog;
// a refused one shows the server's message inside the dialog and keeps the form open.
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useCaseWrite } from '../api/hooks';
import type { AllowedAction, CaseDetail } from '../api/types';
import { ACTION_LABEL } from '../labels';
import { useSession } from '../session';
import {
  AppealOutcomeForm,
  AssignAppealReviewerForm,
  AssignReviewerForm,
  CloseForm,
  DecisionForm,
  EvidenceForm,
  TextForm,
} from './ActionForms';
import { ErrorBanner } from './ErrorBanner';

interface Props {
  action: AllowedAction | null;
  detail: CaseDetail;
  onClose: () => void;
}

export function ActionDialog({ action, detail, onClose }: Props) {
  const { actorId } = useSession();
  const write = useCaseWrite(actorId, detail.case_id);
  const submit = (path: string, body: unknown) => write.mutate({ path, body }, { onSuccess: onClose });
  const p = { detail, onSubmit: submit, busy: write.isPending };

  const forms: Record<AllowedAction, JSX.Element> = {
    assign_reviewer: <AssignReviewerForm {...p} />,
    add_evidence: <EvidenceForm {...p} />,
    reopen: <TextForm path="/reopen" field="reason" label="Reason for reopening" submitLabel="Reopen" onSubmit={submit} busy={p.busy} />,
    decide: <DecisionForm {...p} />,
    file_appeal: <TextForm path="/appeal" field="grounds" label="Grounds for the appeal" submitLabel="File appeal" onSubmit={submit} busy={p.busy} />,
    assign_appeal_reviewer: <AssignAppealReviewerForm {...p} />,
    decide_appeal: <AppealOutcomeForm {...p} />,
    close: <CloseForm onSubmit={submit} busy={p.busy} />,
  };

  return (
    <Dialog.Root
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) {
          write.reset();
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <div className="dialog-head">
            <Dialog.Title>{action ? ACTION_LABEL[action] : ''}</Dialog.Title>
            <Dialog.Close className="btn icon-btn" aria-label="Close dialog">
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>
          <ErrorBanner error={write.error} />
          {action && forms[action]}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
