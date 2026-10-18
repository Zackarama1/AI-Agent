'use client';

import { create } from 'zustand';
import type { SizeLabel } from '@/lib/garment/grading';
import type { CanvasState, CanvasView, PiecePart } from '@/lib/garment/types';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export interface VersionEntry {
  id: string;
  version_number: number;
  change_summary: string | null;
  created_at: string;
}

interface EditorState {
  canvas: CanvasState;
  past: CanvasState[];
  future: CanvasState[];
  lastEdit: { key: string; at: number } | null;
  selection: { part?: PiecePart; embellishmentId?: string };
  view: CanvasView;
  mode: 'rendered' | 'sketch';
  size: SizeLabel;
  zoom: number;
  grid: boolean;
  save: { status: SaveStatus; error?: string };
  versions: VersionEntry[];

  // `coalesce` groups rapid edits (e.g. a slider drag) into one undo step.
  update: (fn: (c: CanvasState) => CanvasState, coalesce?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (s: EditorState['selection']) => void;
  set: (patch: Partial<Pick<EditorState, 'view' | 'mode' | 'size' | 'zoom' | 'grid'>>) => void;
  setSave: (save: EditorState['save']) => void;
  addVersion: (v: VersionEntry) => void;
}

const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export const firstPart = (c: CanvasState): PiecePart | undefined => (c.onePiece ? 'one_piece' : c.top ? 'top' : c.bottom ? 'bottom' : undefined);

export function createEditorStore(canvas: CanvasState, versions: VersionEntry[]) {
  return create<EditorState>((set, get) => ({
    canvas,
    past: [],
    future: [],
    lastEdit: null,
    selection: { part: firstPart(canvas) },
    view: 'front',
    mode: 'rendered',
    size: 'M',
    zoom: 1,
    grid: false,
    save: { status: 'saved' },
    versions,

    update: (fn, coalesce) => {
      const { canvas: current, past, lastEdit } = get();
      const next = fn(current);
      if (next === current) return;
      const now = Date.now();
      const merge = coalesce && lastEdit?.key === coalesce && now - lastEdit.at < COALESCE_MS;
      set({
        canvas: next,
        past: merge ? past : [...past, current].slice(-HISTORY_LIMIT),
        future: [],
        lastEdit: coalesce ? { key: coalesce, at: now } : null,
      });
    },
    undo: () => {
      const { past, canvas: current, future } = get();
      if (!past.length) return;
      set({ canvas: past[past.length - 1], past: past.slice(0, -1), future: [current, ...future], lastEdit: null });
    },
    redo: () => {
      const { past, canvas: current, future } = get();
      if (!future.length) return;
      set({ canvas: future[0], past: [...past, current], future: future.slice(1), lastEdit: null });
    },
    select: (selection) => set({ selection }),
    set: (patch) => set(patch),
    setSave: (save) => set({ save }),
    addVersion: (v) => set((s) => (s.versions.some((x) => x.id === v.id) ? s : { versions: [v, ...s.versions] })),
  }));
}

export type EditorStore = ReturnType<typeof createEditorStore>;
