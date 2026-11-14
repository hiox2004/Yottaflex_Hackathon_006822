// Session state shared by the layout and pages: the acting reviewer and how to change them.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { getActorId, setActorId } from './api/actor';

interface Session {
  actorId: string;
  changeActor: (id: string) => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [actorId, setActor] = useState(getActorId);
  const changeActor = (id: string) => {
    setActorId(id);
    setActor(id);
  };
  return <SessionContext.Provider value={{ actorId, changeActor }}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession needs a SessionProvider');
  return session;
}
