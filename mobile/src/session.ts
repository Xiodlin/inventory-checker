import { createContext, useContext } from 'react';

export const SessionContext = createContext<{ revision: number } | null>(null);
export function useSession() {
  const state = useContext(SessionContext);
  if (!state) throw new Error('Local data provider is missing.');
  return state;
}
