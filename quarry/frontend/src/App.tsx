import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api/client";
import { Clocks, StatusBar } from "./components/StatusBar";
import { CommandLine, type CommandLineHandle } from "./terminal/CommandLine";
import { useRegistry } from "./terminal/registry";
import { useWorkspacePersistence } from "./workspace/persistence";
import { DEFAULT_WORKSPACES, useWorkspace, type PaneCount } from "./workspace/store";
import { TabletWorkspace } from "./workspace/TabletWorkspace";
import { useFormFactor } from "./workspace/useFormFactor";

// Docking is desktop-only; keep it out of the iPad bundle.
const DesktopWorkspace = lazy(() =>
  import("./workspace/DesktopWorkspace").then((m) => ({ default: m.DesktopWorkspace })),
);

const HISTORY_KEY = "quarry.history";
const CB_KEY = "quarry.colourBlind";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

export default function App() {
  const ff = useFormFactor();
  const touch = ff === "tablet";
  const { registry, error: registryError } = useRegistry();
  const { saveState, saveNow, ready } = useWorkspacePersistence(ff);
  const workspace = useWorkspace((s) => s.workspace);
  const paneCount = useWorkspace((s) => s.paneCount);
  const cmdRef = useRef<CommandLineHandle>(null);
  const [history, setHistory] = useState<string[]>(() => readJson<string[]>(HISTORY_KEY, []));
  const [colourBlind, setColourBlind] = useState<boolean>(() => readJson(CB_KEY, false));

  useEffect(() => {
    document.documentElement.dataset.cb = String(colourBlind);
    try {
      localStorage.setItem(CB_KEY, JSON.stringify(colourBlind));
    } catch {
      // ignore
    }
  }, [colourBlind]);

  // Commands typed while a workspace is still loading are queued, not overwritten.
  const queued = useRef<{ command: string; newPanel: boolean }[]>([]);
  const readyRef = useRef(ready);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  const run = useCallback(
    (command: string, opts?: { newPanel?: boolean }) => {
      if (!readyRef.current) {
        queued.current.push({ command, newPanel: opts?.newPanel ?? false });
        return;
      }
      const st = useWorkspace.getState();
      st.openCommand(command, registry, { newPanel: !touch && (opts?.newPanel ?? false) });
      const text = command.trim().toUpperCase();
      setHistory((h) => {
        const next = [text, ...h.filter((x) => x !== text)].slice(0, 100);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      void api.addHistory(text).catch(() => undefined);
    },
    [registry, touch],
  );

  useEffect(() => {
    if (!ready || queued.current.length === 0) return;
    const pending = queued.current;
    queued.current = [];
    for (const q of pending) run(q.command, { newPanel: q.newPanel });
  }, [ready, run]);

  // Global shortcuts (see KEYS).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const st = useWorkspace.getState();
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        cmdRef.current?.focus();
      } else if (e.key === "/" && !isTyping(e.target)) {
        e.preventDefault();
        cmdRef.current?.focus();
      } else if (e.key === "F1") {
        e.preventDefault();
        run("HELP");
      } else if (e.key === "?" && !isTyping(e.target)) {
        e.preventDefault();
        run("KEYS");
      } else if (mod && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        st.focusIndex(Number(e.key) - 1);
      } else if (mod && e.key.toLowerCase() === "l") {
        e.preventDefault();
        if (st.focusedId) st.cycleLink(st.focusedId);
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, saveNow]);

  // Swipe left/right on the top bar to change workspace (iPad).
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const switchBy = (delta: number) => {
    const names = DEFAULT_WORKSPACES as readonly string[];
    const i = Math.max(0, names.indexOf(workspace));
    useWorkspace.getState().setWorkspace(names[(i + delta + names.length) % names.length]!);
  };

  return (
    <div className="flex h-full flex-col">
      <header
        className={`flex flex-wrap items-center gap-3 border-b border-edge bg-bar ${touch ? "px-4 py-2.5" : "px-3 py-2"}`}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") swipeStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipeStart.current;
          swipeStart.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 80 && Math.abs(e.clientY - s.y) < 40) switchBy(dx < 0 ? 1 : -1);
        }}
      >
        <span className="font-mono text-base font-bold tracking-[3px] text-amber">QUARRY</span>
        <div className="order-last flex min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-[999_1_360px]">
          <CommandLine
            ref={cmdRef}
            registry={registry}
            history={history}
            onRun={(c, o) => run(c, o)}
            touch={touch}
          />
        </div>
        <div role="group" aria-label="Workspaces" className="flex gap-1">
          {DEFAULT_WORKSPACES.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={workspace === name}
              onClick={() => useWorkspace.getState().setWorkspace(name)}
              className={`border px-3 ${touch ? "h-11 rounded-lg" : "h-8 rounded-[3px]"} ${
                workspace === name
                  ? "border-amber bg-amber-wash font-semibold text-amber"
                  : "border-edge bg-transparent text-soft"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        {touch && (
          <div role="group" aria-label="Panes" className="flex gap-1">
            {([1, 2, 3] as PaneCount[]).map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} pane${n > 1 ? "s" : ""}`}
                aria-pressed={paneCount === n}
                onClick={() => useWorkspace.getState().setPaneCount(n)}
                className={`h-11 w-11 rounded-lg border font-mono ${
                  paneCount === n ? "border-amber text-amber" : "border-edge text-soft"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        <div className="hidden md:block">
          <Clocks compact={touch} />
        </div>
      </header>

      {registryError && (
        <div role="alert" className="border-b border-down bg-[#2a1414] px-3 py-1.5 text-sm">
          Cannot reach the QUARRY API, so commands are unavailable. Check the backend is running.
        </div>
      )}

      <main className="min-h-0 flex-1">
        {touch ? (
          <TabletWorkspace registry={registry} run={run} />
        ) : (
          <Suspense fallback={<p className="m-0 p-4 text-dim">Loading workspace…</p>}>
            <DesktopWorkspace registry={registry} run={run} />
          </Suspense>
        )}
      </main>

      <div className="flex items-center border-t border-edge bg-bar">
        <div className="min-w-0 flex-1">
          <StatusBar saveState={saveState} />
        </div>
        <button
          type="button"
          aria-pressed={colourBlind}
          onClick={() => setColourBlind((v) => !v)}
          className="h-8 shrink-0 border-0 border-l border-edge bg-transparent px-3 font-mono text-[11px] text-dim"
        >
          {colourBlind ? "Colours: CB-safe" : "Colours: standard"}
        </button>
      </div>
    </div>
  );
}
