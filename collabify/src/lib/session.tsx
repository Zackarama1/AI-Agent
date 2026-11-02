import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApi } from './api';
import type { Profile } from './types';

type SessionValue = { profile: Profile | null | undefined; refresh: () => Promise<void>; signOut: () => Promise<void> };
const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const api = getApi();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const refresh = useCallback(async () => setProfile(await api.getSession()), [api]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      api.getSession().then((p) => {
        if (alive) setProfile(p);
      });
    };
    load();
    const off = api.onChange(load);
    return () => {
      alive = false;
      off();
    };
  }, [api]);
  const value = useMemo(
    () => ({ profile, refresh, signOut: async () => { await api.signOut(); setProfile(null); } }),
    [profile, refresh, api],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** The signed-in profile; only use under a layout that guarantees a session. */
export function useMe(): Profile {
  const { profile } = useSession();
  if (!profile) throw new Error('Not signed in');
  return profile;
}
