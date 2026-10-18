import { useEffect } from "react";

import { FunctionView, panelTitle } from "../functions/FunctionView";
import { parse, securityText } from "../terminal/parser";
import type { Registry } from "../terminal/types";
import { LinkSwatch } from "./LinkSwatch";
import { newPanelId, useWorkspace, type PaneCount } from "./store";

const SECURITY_CHIPS = ["GP", "DES", "HP", "FA", "VAL", "CRD", "CN", "EE", "INS", "BRF"];
const GLOBAL_CHIPS = ["WEI", "NEWS", "WL", "STAT", "HELP"];
const FILLERS = ["", "STAT", "HELP"];

const GRID: Record<PaneCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
  3: "grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:grid-rows-2",
};

interface Props {
  registry: Registry;
  run: (command: string) => void;
}

/** iPad/phone: fixed 1-3 panes with large touch targets; tap a pane to focus it. */
export function TabletWorkspace({ registry, run }: Props) {
  const paneCount = useWorkspace((s) => s.paneCount);
  const order = useWorkspace((s) => s.order);
  const visible = order.slice(0, paneCount);

  // Make sure every visible pane has a panel behind it.
  useEffect(() => {
    const st = useWorkspace.getState();
    if (st.order.length >= paneCount) return;
    const panels = { ...st.panels };
    const next = [...st.order];
    for (let i = st.order.length; i < paneCount; i++) {
      const id = newPanelId();
      panels[id] = { id, command: FILLERS[i] ?? "HELP", link: "none" };
      next.push(id);
    }
    useWorkspace.setState({ panels, order: next, focusedId: st.focusedId ?? next[0] ?? null });
  }, [paneCount, order.length]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className={`grid min-h-0 flex-1 gap-2 ${GRID[paneCount]}`}>
        {visible.map((id, i) => (
          <Pane
            key={id}
            id={id}
            registry={registry}
            run={run}
            className={paneCount === 3 && i === 0 ? "sm:row-span-2" : ""}
          />
        ))}
      </div>
      <FunctionChips registry={registry} run={run} />
    </div>
  );
}

function Pane({ id, registry, run, className }: Props & { id: string; className: string }) {
  const command = useWorkspace((s) => s.panels[id]?.command ?? "");
  const focused = useWorkspace((s) => s.focusedId === id);
  return (
    <section
      data-pane={id}
      aria-label={panelTitle(command, registry)}
      onPointerDown={() => useWorkspace.getState().focus(id)}
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border bg-panel ${
        focused ? "border-amber" : "border-edge"
      } ${className}`}
    >
      <header className="flex min-h-11 items-center gap-1 border-b border-edge bg-head pr-3">
        <LinkSwatch panelId={id} large />
        <span className="truncate font-mono text-sm text-bright">
          {panelTitle(command, registry)}
        </span>
        {focused && <span className="ml-auto font-mono text-[10px] text-amber">FOCUSED</span>}
      </header>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <FunctionView
          command={command}
          registry={registry}
          run={(c) => {
            useWorkspace.getState().focus(id);
            run(c);
          }}
        />
      </div>
    </section>
  );
}

function FunctionChips({ registry, run }: Props) {
  const focusedCommand = useWorkspace((s) =>
    s.focusedId ? (s.panels[s.focusedId]?.command ?? "") : "",
  );
  const r = parse(focusedCommand, registry);
  const security = r.kind === "ok" && r.security ? securityText(r.security) : null;
  const activeCode = r.kind === "ok" ? r.fn.code : null;
  const chip = (label: string, cmd: string) => (
    <button
      key={label}
      type="button"
      onClick={() => run(cmd)}
      className={`h-11 shrink-0 rounded-lg border px-3.5 font-mono text-[13px] font-bold ${
        activeCode === label
          ? "border-amber bg-amber text-ground"
          : "border-edge bg-head text-ink active:bg-edge"
      }`}
    >
      {label}
    </button>
  );
  return (
    <nav aria-label="Functions" className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
      <span className="shrink-0 pr-1 text-xs text-dim">{security ?? "No security"}</span>
      {security && SECURITY_CHIPS.map((c) => chip(c, `${security} ${c}`))}
      <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-edge" />
      {GLOBAL_CHIPS.map((c) => chip(c, c))}
    </nav>
  );
}
