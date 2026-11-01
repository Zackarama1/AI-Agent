import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { createIdentity, unwrapPrivateKey, exportPrivateKey, importPrivateKey } from './e2ee.js';

const AuthContext = createContext(null);
// The unwrapped messaging key lives only in this tab's sessionStorage, never on the server.
const KEY_STORAGE = 'collabify.e2ee.key';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [privateKey, setPrivateKey] = useState(null);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(async ({ user }) => {
        setUser(user);
        const stored = sessionStorage.getItem(KEY_STORAGE);
        if (user && stored) {
          try {
            setPrivateKey(await importPrivateKey(stored));
          } catch {
            sessionStorage.removeItem(KEY_STORAGE);
          }
        }
      })
      .catch(() => setUser(null));
  }, []);

  const rememberKey = async (key) => {
    setPrivateKey(key);
    try {
      sessionStorage.setItem(KEY_STORAGE, await exportPrivateKey(key));
    } catch {
      /* storage unavailable - key stays in memory for this page */
    }
  };

  const login = useCallback(async (email, password) => {
    const { user } = await api.post('/auth/login', { email, password });
    if (user.wrappedPrivateKey) {
      try {
        await rememberKey(await unwrapPrivateKey(user.wrappedPrivateKey, password));
      } catch {
        /* key wrapped with an older password; messaging will prompt */
      }
    } else {
      const id = await createIdentity(password);
      await api.put('/auth/keys', { publicKey: id.publicKey, wrappedPrivateKey: id.wrappedPrivateKey });
      await rememberKey(id.privateKey);
    }
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (form) => {
    const id = await createIdentity(form.password);
    const { user } = await api.post('/auth/register', { ...form, publicKey: id.publicKey, wrappedPrivateKey: id.wrappedPrivateKey });
    await rememberKey(id.privateKey);
    setUser(user);
    return user;
  }, []);

  const unlock = useCallback(
    async (password) => {
      const key = await unwrapPrivateKey(user.wrappedPrivateKey, password);
      await rememberKey(key);
    },
    [user],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    sessionStorage.removeItem(KEY_STORAGE);
    setPrivateKey(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const { user } = await api.get('/auth/me');
    setUser(user);
    return user;
  }, []);

  const value = useMemo(
    () => ({ user, setUser, privateKey, login, register, logout, refresh, unlock }),
    [user, privateKey, login, register, logout, refresh, unlock],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
