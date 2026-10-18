import { useCallback, useEffect, useRef, useState } from "react";

import { api, type FormFactor } from "../api/client";
import { defaultSnapshot, isSnapshot, useWorkspace, type WorkspaceSnapshot } from "./store";

export type SaveState = "idle" | "saving" | "saved" | "offline";

const localKey = (name: string, ff: FormFactor) => `quarry.ws.${ff}.${name}`;

function readLocal(name: string, ff: FormFactor): WorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(localKey(name, ff));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(name: string, ff: FormFactor, snap: WorkspaceSnapshot): void {
  try {
    localStorage.setItem(localKey(name, ff), JSON.stringify(snap));
  } catch {
    // Storage unavailable (private mode): the server copy is the source of truth.
  }
}

export async function loadWorkspace(name: string, ff: FormFactor): Promise<WorkspaceSnapshot> {
  try {
    const remote = await api.getWorkspace(name, ff);
    if (isSnapshot(remote.layout)) return remote.layout;
  } catch {
    // 404 (never saved) or offline: fall back to the local copy.
  }
  return readLocal(name, ff) ?? defaultSnapshot();
}

/**
 * Loads the current workspace when it (or the form factor) changes and autosaves
 * edits: immediately to localStorage, debounced to the API. `saveNow` backs Ctrl+S.
 */
export function useWorkspacePersistence(ff: FormFactor) {
  const workspace = useWorkspace((s) => s.workspace);
  const [state, setState] = useState<SaveState>("idle");
  // Which workspace/form factor finished loading; anything else means "loading".
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${ff}:${workspace}`;
  const loading = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ name: string; snap: WorkspaceSnapshot } | null>(null);

  // Saves a snapshot taken at edit time under the workspace it belongs to, so a
  // pending autosave can never land on a workspace the user has since switched to.
  const save = useCallback(
    async (name: string, snap: WorkspaceSnapshot) => {
      writeLocal(name, ff, snap);
      setState("saving");
      try {
        await api.saveWorkspace(name, ff, snap as unknown as Record<string, unknown>);
        setState("saved");
      } catch {
        setState("offline");
      }
    },
    [ff],
  );

  const saveNow = useCallback(async () => {
    clearTimeout(timer.current);
    if (pending.current && pending.current.name !== useWorkspace.getState().workspace) {
      void save(pending.current.name, pending.current.snap);
    }
    pending.current = null;
    const st = useWorkspace.getState();
    await save(st.workspace, st.snapshot());
  }, [save]);

  useEffect(() => {
    let cancelled = false;
    loading.current = true;
    void loadWorkspace(workspace, ff).then((snap) => {
      if (cancelled) return;
      useWorkspace.getState().load(snap);
      loading.current = false;
      setLoadedKey(`${ff}:${workspace}`);
    });
    return () => {
      cancelled = true;
    };
  }, [workspace, ff]);

  useEffect(
    () =>
      useWorkspace.subscribe((st, prev) => {
        if (loading.current || st.revision !== prev.revision || st.workspace !== prev.workspace)
          return;
        const name = st.workspace;
        const snap = st.snapshot();
        writeLocal(name, ff, snap);
        clearTimeout(timer.current);
        // An unsent edit to another workspace is flushed rather than dropped.
        if (pending.current && pending.current.name !== name) {
          void save(pending.current.name, pending.current.snap);
        }
        pending.current = { name, snap };
        timer.current = setTimeout(() => {
          pending.current = null;
          void save(name, snap);
        }, 800);
      }),
    [ff, save],
  );

  /** `ready` is false while a workspace loads; commands issued then must wait. */
  return { saveState: state, saveNow, ready: loadedKey === key };
}
