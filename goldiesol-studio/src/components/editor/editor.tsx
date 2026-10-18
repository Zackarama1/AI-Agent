'use client';

import { ArrowLeft, Check, CircleAlert, Loader2, Ruler, Shirt } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { saveDesignVersionAction, updateDesignAction } from '@/app/actions/designs';
import { SunGlyph } from '@/components/brand/wordmark';
import { duplicateEmbellishment, removeEmbellishment } from '@/lib/garment/ops';
import type { CanvasState } from '@/lib/garment/types';
import { DESIGN_STATUSES, type Design, type DesignNote } from '@/lib/types';
import { humanise } from '@/lib/utils';
import { CanvasArea, zoomBy } from './canvas-area';
import { EditorProvider, useEditor, useEditorStore, type EditorLibrary } from './context';
import { LeftRail } from './left-rail';
import { RightPanel } from './right-panel';
import type { VersionEntry } from './store';

const AUTOSAVE_MS = 1200;

function useAutosave(designId: string) {
  const store = useEditorStore();
  const saved = useRef<CanvasState>(store.getState().canvas);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef(false);

  useEffect(() => {
    const flush = async () => {
      if (inFlight.current) {
        timer.current = setTimeout(flush, 300);
        return;
      }
      const canvas = store.getState().canvas;
      if (canvas === saved.current) return;
      inFlight.current = true;
      store.getState().setSave({ status: 'saving' });
      try {
        const v = await saveDesignVersionAction(designId, canvas);
        saved.current = canvas;
        store.getState().addVersion(v);
        // More edits may have landed while saving.
        store.getState().setSave({ status: store.getState().canvas === canvas ? 'saved' : 'dirty' });
        if (store.getState().canvas !== canvas) timer.current = setTimeout(flush, AUTOSAVE_MS);
      } catch {
        store.getState().setSave({ status: 'error', error: 'Couldn’t save — we’ll retry on your next change.' });
      } finally {
        inFlight.current = false;
      }
    };

    const unsubscribe = store.subscribe((state, prev) => {
      if (state.canvas === prev.canvas) return;
      store.getState().setSave({ status: 'dirty' });
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    });
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (store.getState().save.status !== 'saved') e.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unsubscribe();
      clearTimeout(timer.current);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [designId, store]);
}

function useShortcuts() {
  const store = useEditorStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      const s = store.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && key === 'd') {
        const id = s.selection.embellishmentId;
        if (!id) return;
        e.preventDefault();
        let copy: string | undefined;
        s.update((c) => {
          const res = duplicateEmbellishment(c, id);
          copy = res.id;
          return res.canvas;
        });
        if (copy) s.select({ ...s.selection, embellishmentId: copy });
      } else if (!mod && (key === '+' || key === '=')) {
        s.set({ zoom: zoomBy(s.zoom, 1) });
      } else if (!mod && key === '-') {
        s.set({ zoom: zoomBy(s.zoom, -1) });
      } else if (!mod && key === '0') {
        s.set({ zoom: 1 });
      } else if ((key === 'delete' || key === 'backspace') && s.selection.embellishmentId) {
        e.preventDefault();
        const id = s.selection.embellishmentId;
        s.update((c) => removeEmbellishment(c, id));
        s.select({ part: s.selection.part });
      } else if (key === 'escape') {
        s.select({ part: s.selection.part });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
}

function SaveIndicator() {
  const save = useEditor((s) => s.save);
  const latest = useEditor((s) => s.versions[0]?.version_number);
  const content = {
    saved: <><Check className="size-3.5 text-gold-deep" /> Saved{latest ? ` · v${latest}` : ''}</>,
    dirty: <>Unsaved changes</>,
    saving: <><Loader2 className="size-3.5 animate-spin" /> Saving…</>,
    error: <><CircleAlert className="size-3.5 text-[#9B1B30]" /> {save.error}</>,
  }[save.status];
  return <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-mist" role="status" data-testid="save-status" data-status={save.status}>{content}</span>;
}

function TopBar({ design }: { design: Design }) {
  const [name, setName] = useState(design.name);
  const [status, setStatus] = useState(design.status);
  const [, start] = useTransition();
  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) return setName(design.name);
    if (trimmed !== design.name) start(() => updateDesignAction(design.id, { name: trimmed }));
  };
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-3 py-2 sm:px-4">
      <h1 className="sr-only">{design.name}</h1>
      <Link href="/designs" className="flex items-center gap-1.5 text-mist hover:text-ink" aria-label="Back to designs">
        <ArrowLeft className="size-4" />
        <SunGlyph className="size-5" />
      </Link>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Design name"
        maxLength={120}
        className="min-w-0 flex-1 basis-[calc(100%-4rem)] rounded-lg bg-transparent px-1 font-display text-2xl leading-tight hover:bg-blush focus:bg-blush focus:outline-none sm:max-w-md sm:basis-auto"
      />
      <select
        value={status}
        aria-label="Status"
        onChange={(e) => {
          const next = e.target.value as Design['status'];
          setStatus(next);
          start(() => updateDesignAction(design.id, { status: next }));
        }}
        className="h-8 rounded-full border border-line bg-rose/40 px-3 text-xs"
      >
        {DESIGN_STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
      </select>
      <SaveIndicator />
      <div className="ml-auto flex gap-2">
        <Link href={`/designs/${design.id}/model`} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs hover:border-champagne hover:bg-blush">
          <Shirt className="size-3.5" /> Model Mode
        </Link>
        <Link href={`/designs/${design.id}/techpack`} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs hover:border-champagne hover:bg-blush">
          <Ruler className="size-3.5" /> Tech Pack
        </Link>
      </div>
    </header>
  );
}

function Workspace({ design, notes }: { design: Design; notes: DesignNote[] }) {
  useAutosave(design.id);
  useShortcuts();
  return (
    // Desktop: fixed-height three-column workspace. Phone/iPad portrait: one scrolling column.
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <TopBar design={design} />
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row lg:overflow-hidden">
        <div className="order-2 border-t border-line lg:order-1 lg:h-full lg:border-t-0">
          <LeftRail />
        </div>
        <div className="order-1 flex min-h-[55vh] flex-col lg:order-2 lg:min-h-0 lg:flex-1">
          <CanvasArea />
        </div>
        <div className="order-3 border-t border-line lg:h-full lg:border-t-0">
          <RightPanel notes={notes} />
        </div>
      </div>
    </div>
  );
}

export function Editor({
  design,
  canvas,
  versions,
  notes,
  library,
}: {
  design: Design;
  canvas: CanvasState;
  versions: VersionEntry[];
  notes: DesignNote[];
  library: EditorLibrary;
}) {
  return (
    <EditorProvider canvas={canvas} versions={versions} library={library}>
      <Workspace design={design} notes={notes} />
    </EditorProvider>
  );
}
