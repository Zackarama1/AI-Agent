import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi, type Api } from './api';

/**
 * Load data from the Api and reload whenever the store changes.
 * `deps` are serialised, so pass plain values (ids, filters).
 */
export function useQuery<T>(fn: (api: Api) => Promise<T>, deps: unknown[] = []) {
  const api = getApi();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const key = JSON.stringify(deps);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const result = await fnRef.current(api);
        if (alive) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e as Error);
      }
    };
    load();
    const off = api.onChange(() => {
      load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [api, key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload, loading: data === undefined && !error };
}

/** Run an action with busy/error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}
