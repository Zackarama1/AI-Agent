import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";

import { api, setAuthToken, User } from "../api/client";

export type Mode = "simple" | "advanced";

type AppState = {
  ready: boolean;
  user: User | null;
  mode: Mode;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setMode: (m: Mode) => void;
};

const TOKEN_KEY = "stocksense_token";
const MODE_KEY = "stocksense_mode";

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setModeState] = useState<Mode>("simple");

  // Restore session + preferences on launch.
  useEffect(() => {
    (async () => {
      try {
        const savedMode = (await SecureStore.getItemAsync(MODE_KEY)) as Mode | null;
        if (savedMode === "simple" || savedMode === "advanced") setModeState(savedMode);

        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          setUser(await api.me()); // validates the token
        }
      } catch {
        setAuthToken(null);
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persistSession = async (token: string, u: User) => {
    setAuthToken(token);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setUser(u);
  };

  const value = useMemo<AppState>(
    () => ({
      ready,
      user,
      mode,
      login: async (email, password) => {
        const r = await api.login(email, password);
        await persistSession(r.token, r.user);
      },
      register: async (email, password) => {
        const r = await api.register(email, password);
        await persistSession(r.token, r.user);
      },
      logout: async () => {
        setAuthToken(null);
        setUser(null);
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      },
      setMode: (m) => {
        setModeState(m);
        SecureStore.setItemAsync(MODE_KEY, m).catch(() => {});
      },
    }),
    [ready, user, mode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
