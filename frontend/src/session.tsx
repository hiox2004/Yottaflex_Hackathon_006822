// Session state shared by the header and pages: the acting user and the "Show the engine" switch.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { getActorId, setActorId } from './api/actor';

interface Session {
  actorId: string;
  changeActor: (id: string) => void;
  engine: boolean;
  setEngine: (on: boolean) => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [actorId, setActor] = useState(getActorId);
  const [engine, setEngine] = useState(false);
  const changeActor = (id: string) => {
    setActorId(id);
    setActor(id);
  };
  return <SessionContext.Provider value={{ actorId, changeActor, engine, setEngine }}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession needs a SessionProvider');
  return session;
}
