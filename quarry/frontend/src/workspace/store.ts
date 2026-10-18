import { create } from "zustand";

import { parse, securityText } from "../terminal/parser";
import type { Registry } from "../terminal/types";

export const LINK_GROUPS = ["none", "amber", "cyan", "violet"] as const;
export type LinkGroup = (typeof LINK_GROUPS)[number];

export const DEFAULT_WORKSPACES = ["UK Morning", "Macro", "Credit Desk"] as const;
export type PaneCount = 1 | 2 | 3;

export interface PanelState {
  id: string;
  command: string;
  link: LinkGroup;
}

/** Everything persisted for a workspace (plus dockview geometry on desktop). */
export interface WorkspaceSnapshot {
  version: 1;
  panels: PanelState[];
  focusedId: string | null;
  paneCount: PaneCount;
  dock?: unknown;
}

interface WorkspaceStore {
  workspace: string;
  panels: Record<string, PanelState>;
  order: string[];
  focusedId: string | null;
  paneCount: PaneCount;
  dock: unknown;
  /** Bumped on load so the docking view rebuilds from the snapshot. */
  revision: number;

  setWorkspace(name: string): void;
  load(snapshot: WorkspaceSnapshot): void;
  snapshot(): WorkspaceSnapshot;
  setDock(dock: unknown): void;
  openCommand(text: string, registry: Registry, opts?: { newPanel?: boolean }): string;
  focus(id: string): void;
  focusIndex(index: number): void;
  closePanel(id: string): void;
  cycleLink(id: string): void;
  setPaneCount(n: PaneCount): void;
}

let seq = 0;
export const newPanelId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

export function defaultSnapshot(): WorkspaceSnapshot {
  const ids = [newPanelId(), newPanelId(), newPanelId()];
  return {
    version: 1,
    panels: [
      { id: ids[0]!, command: "", link: "amber" },
      { id: ids[1]!, command: "STAT", link: "none" },
      { id: ids[2]!, command: "HELP", link: "none" },
    ],
    focusedId: ids[0]!,
    paneCount: 2,
  };
}

/**
 * Re-point a linked panel's security-based command at a new security, keeping its
 * function and arguments (e.g. "AAPL US GP 1Y" -> "VOD LN GP 1Y").
 */
export function relink(command: string, securityCmd: string, registry: Registry): string | null {
  const r = parse(command, registry);
  if (r.kind !== "ok" || !r.security) return null;
  return [securityCmd, r.fn.code, ...r.args].join(" ");
}

export const useWorkspace = create<WorkspaceStore>()((set, get) => ({
  workspace: DEFAULT_WORKSPACES[0],
  ...fromSnapshot(defaultSnapshot()),
  dock: undefined,
  revision: 0,

  setWorkspace: (name) => set({ workspace: name }),

  load: (s) => set((st) => ({ ...fromSnapshot(s), dock: s.dock, revision: st.revision + 1 })),

  snapshot: () => {
    const st = get();
    const snap: WorkspaceSnapshot = {
      version: 1,
      panels: st.order.map((id) => st.panels[id]!),
      focusedId: st.focusedId,
      paneCount: st.paneCount,
    };
    if (st.dock !== undefined) snap.dock = st.dock;
    return snap;
  },

  setDock: (dock) => set({ dock }),

  openCommand: (text, registry, opts) => {
    const st = get();
    const result = parse(text, registry);
    const command = result.kind === "ok" ? result.canonical : text.trim().toUpperCase();
    let targetId = opts?.newPanel || !st.focusedId ? null : st.focusedId;
    const panels = { ...st.panels };
    let order = st.order;
    if (targetId === null || !panels[targetId]) {
      targetId = newPanelId();
      panels[targetId] = { id: targetId, command, link: "none" };
      order = [...order, targetId];
    } else {
      panels[targetId] = { ...panels[targetId]!, command };
    }
    const target = panels[targetId]!;
    if (result.kind === "ok" && result.security && target.link !== "none") {
      const sec = securityText(result.security);
      for (const id of order) {
        const p = panels[id]!;
        if (id === targetId || p.link !== target.link) continue;
        const next = relink(p.command, sec, registry);
        if (next) panels[id] = { ...p, command: next };
      }
    }
    set({ panels, order, focusedId: targetId });
    return targetId;
  },

  focus: (id) => {
    if (get().panels[id]) set({ focusedId: id });
  },

  focusIndex: (index) => {
    const id = get().order[index];
    if (id) set({ focusedId: id });
  },

  closePanel: (id) =>
    set((st) => {
      if (!st.panels[id]) return st;
      const panels = Object.fromEntries(Object.entries(st.panels).filter(([k]) => k !== id));
      const order = st.order.filter((x) => x !== id);
      return { panels, order, focusedId: st.focusedId === id ? (order[0] ?? null) : st.focusedId };
    }),

  cycleLink: (id) =>
    set((st) => {
      const p = st.panels[id];
      if (!p) return st;
      const next = LINK_GROUPS[(LINK_GROUPS.indexOf(p.link) + 1) % LINK_GROUPS.length]!;
      return { panels: { ...st.panels, [id]: { ...p, link: next } } };
    }),

  setPaneCount: (n) => set({ paneCount: n }),
}));

function fromSnapshot(s: WorkspaceSnapshot) {
  const panels: Record<string, PanelState> = {};
  for (const p of s.panels) panels[p.id] = p;
  const order = s.panels.map((p) => p.id);
  const focusedId = s.focusedId && panels[s.focusedId] ? s.focusedId : (order[0] ?? null);
  return { panels, order, focusedId, paneCount: s.paneCount };
}

export function isSnapshot(v: unknown): v is WorkspaceSnapshot {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Partial<WorkspaceSnapshot>;
  return (
    s.version === 1 &&
    Array.isArray(s.panels) &&
    s.panels.every(
      (p) =>
        typeof p?.id === "string" &&
        typeof p.command === "string" &&
        (LINK_GROUPS as readonly string[]).includes(p.link),
    )
  );
}
