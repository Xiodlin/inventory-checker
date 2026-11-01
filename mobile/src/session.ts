import { createContext, useContext } from 'react';

export interface Session {
  email: string;
  revision: number;
  logout: () => Promise<void>;
}
export const SessionContext = createContext<Session | null>(null);
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Session provider is missing.');
  return session;
}
