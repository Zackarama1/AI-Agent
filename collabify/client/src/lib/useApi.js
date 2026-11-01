import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/** Fetch `path` on mount / when it changes. Returns { data, error, loading, reload }. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await api.get(path), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}
