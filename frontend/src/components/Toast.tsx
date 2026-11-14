// Tiny toast store: toast() is callable from anywhere (no provider), <Toaster /> renders the stack once in the shell.
// Messages auto-dismiss after 5s and can be closed early.
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

export type ToastTone = 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(next: ToastItem[]) {
  items = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismissToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  emit(items.filter((item) => item.id !== id));
}

export function toast(message: string, tone: ToastTone = 'success', durationMs = 5000) {
  const id = nextId++;
  emit([...items, { id, message, tone }]);
  timers.set(id, setTimeout(() => dismissToast(id), durationMs));
}

export function Toaster() {
  const current = useSyncExternalStore(subscribe, () => items, () => items);
  // Unmounting the shell leaves nothing to show the stack, so stop the auto-dismiss timers and drop the stack.
  useEffect(
    () => () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      items = [];
    },
    [],
  );
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(92vw,24rem)] flex-col gap-2">
      {current.map((item) => {
        const Icon = item.tone === 'success' ? CircleCheck : TriangleAlert;
        return (
          <div
            key={item.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-lg"
          >
            <Icon size={18} aria-hidden className={`mt-0.5 shrink-0 ${item.tone === 'success' ? 'text-success' : 'text-danger'}`} />
            <span className="flex-1">{item.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(item.id)}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
