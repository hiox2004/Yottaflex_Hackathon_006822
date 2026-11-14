// Current actor id: kept in localStorage (best effort) and sent as X-Actor-Id on every request.
const KEY = 'integrity.actorId';
const DEFAULT_ACTOR = 'REV-000011';
let current: string | null = null;

export function getActorId(): string {
  if (current) return current;
  try {
    current = localStorage.getItem(KEY);
  } catch {
    current = null; // storage blocked: fall back to the default for this session
  }
  return current ?? DEFAULT_ACTOR;
}

export function setActorId(id: string): void {
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // not persisted; still used for this session
  }
}
