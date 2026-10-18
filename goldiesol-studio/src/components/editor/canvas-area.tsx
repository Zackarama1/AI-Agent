'use client';

import { Grid3x3, MapPin, Maximize, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { SIZES } from '@/lib/garment/grading';
import { renderGarmentSvg } from '@/lib/garment/render';
import type { CanvasView, PiecePart } from '@/lib/garment/types';
import { cn } from '@/lib/utils';
import { useEditor, useEditorStore, useLibrary } from './context';
import { Segmented } from './controls';
import { ZOOM_STEPS } from './store';

const VIEWS: { value: CanvasView; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'side', label: 'Side' },
];

export function zoomBy(zoom: number, dir: 1 | -1) {
  const i = ZOOM_STEPS.findIndex((z) => z >= zoom - 1e-6);
  const next = ZOOM_STEPS[Math.min(Math.max((i === -1 ? ZOOM_STEPS.length - 1 : i) + dir, 0), ZOOM_STEPS.length - 1)];
  return next;
}

function IconButton({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn('rounded-full p-1.5 text-mist hover:bg-blush hover:text-ink disabled:opacity-30 [&_svg]:size-4', active && 'bg-rose/50 text-ink')}
    >
      {children}
    </button>
  );
}

export function CanvasArea() {
  const store = useEditorStore();
  const { colourHex } = useLibrary();
  const canvas = useEditor((s) => s.canvas);
  const view = useEditor((s) => s.view);
  const mode = useEditor((s) => s.mode);
  const size = useEditor((s) => s.size);
  const zoom = useEditor((s) => s.zoom);
  const grid = useEditor((s) => s.grid);
  const selection = useEditor((s) => s.selection);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const pinMode = useEditor((s) => s.pinMode);
  const pendingPin = useEditor((s) => s.pendingPin);
  const notes = useEditor((s) => s.notes);
  const focusedNoteId = useEditor((s) => s.focusedNoteId);
  const surface = useRef<HTMLDivElement>(null);
  // Pins are numbered across all views so the number matches the Notes list.
  const pinned = notes.filter((n) => n.anchor);

  const svg = useMemo(
    () => renderGarmentSvg(canvas, { view, mode, size, grid, colourHex, selected: selection, annotations: true, idPrefix: 'ed' }),
    [canvas, view, mode, size, grid, colourHex, selection],
  );

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as Element;
    if (pinMode && surface.current) {
      const r = surface.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      const part = target.closest('[data-part]')?.getAttribute('data-part') as PiecePart | null;
      store.getState().setPendingPin({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, view, ...(part && { part }) });
      return;
    }
    if (target.closest('[data-pin]')) return;
    const emb = target.closest('[data-embellishment]')?.getAttribute('data-embellishment');
    const part = target.closest('[data-part]')?.getAttribute('data-part') as PiecePart | null;
    if (emb) store.getState().select({ part: part ?? undefined, embellishmentId: emb });
    else if (part) store.getState().select({ part });
  };

  const set = store.getState().set;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/70 px-3 py-2">
        <Segmented label="View" value={view} options={VIEWS} onChange={(v) => set({ view: v })} />
        <div className="flex items-center gap-1">
          <IconButton label="Undo (⌘Z)" onClick={() => store.getState().undo()} disabled={!canUndo}><Undo2 /></IconButton>
          <IconButton label="Redo (⇧⌘Z)" onClick={() => store.getState().redo()} disabled={!canRedo}><Redo2 /></IconButton>
          <span className="mx-1 h-5 w-px bg-line" />
          <IconButton label="Zoom out (−)" onClick={() => set({ zoom: zoomBy(zoom, -1) })}><Minus /></IconButton>
          <button type="button" onClick={() => set({ zoom: 1 })} className="w-12 text-center text-xs tabular-nums text-mist hover:text-ink" title="Reset zoom (0)">
            {Math.round(zoom * 100)}%
          </button>
          <IconButton label="Zoom in (+)" onClick={() => set({ zoom: zoomBy(zoom, 1) })}><Plus /></IconButton>
          <IconButton label="Fit" onClick={() => set({ zoom: 1 })}><Maximize /></IconButton>
          <IconButton label="Grid (1 cm)" onClick={() => set({ grid: !grid })} active={grid}><Grid3x3 /></IconButton>
          <IconButton label={pinMode ? 'Cancel pin (Esc)' : 'Pin a note'} onClick={() => store.getState().setPinMode(!pinMode)} active={pinMode}><MapPin /></IconButton>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="preview-size">Preview size</label>
          <select
            id="preview-size"
            value={size}
            onChange={(e) => set({ size: e.target.value as typeof size })}
            className="h-7 rounded-full border border-line bg-surface px-2 text-xs"
            title="Preview graded size"
          >
            {SIZES.map((s) => <option key={s} value={s}>Size {s}</option>)}
          </select>
          <Segmented
            label="Render mode"
            value={mode}
            options={[{ value: 'rendered', label: 'Rendered' }, { value: 'sketch', label: 'Flat sketch' }]}
            onChange={(m) => set({ mode: m })}
          />
        </div>
      </div>
      {pinMode && (
        <p className="border-b border-line bg-rose/30 px-3 py-1.5 text-center text-xs" role="status">
          Tap the garment where the note belongs. Esc to cancel.
        </p>
      )}
      <div
        className={cn('relative min-h-[360px] flex-1 overflow-auto bg-blush/50', pinMode && 'cursor-crosshair')}
        onClick={onClick}
        data-testid="garment-canvas"
      >
        <div className="mx-auto p-6" style={{ width: `calc(min(100%, 640px) * ${zoom})` }}>
          <div ref={surface} className="relative">
            <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            {pinned.map((n, i) =>
              n.anchor!.view === view ? (
                <button
                  key={n.id}
                  type="button"
                  data-pin
                  aria-label={`Note ${i + 1}: ${n.body}`}
                  title={n.body}
                  onClick={() => {
                    store.getState().focusNote(n.id);
                    store.getState().setRightTab('notes');
                  }}
                  className={cn(
                    'absolute flex size-6 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none border-2 border-surface text-[11px] font-semibold text-ivory shadow-soft transition-transform hover:scale-110',
                    n.type === 'change_request' ? 'bg-[#9B1B30]' : 'bg-gold-deep',
                    n.resolved && 'opacity-40',
                    focusedNoteId === n.id && 'scale-125 ring-2 ring-champagne',
                  )}
                  style={{ left: `${n.anchor!.x * 100}%`, top: `${n.anchor!.y * 100}%` }}
                >
                  {i + 1}
                </button>
              ) : null,
            )}
            {pendingPin && pendingPin.view === view && (
              <span
                data-pin
                className="absolute size-6 -translate-x-1/2 -translate-y-full animate-pulse rounded-full rounded-bl-none border-2 border-surface bg-champagne shadow-soft"
                style={{ left: `${pendingPin.x * 100}%`, top: `${pendingPin.y * 100}%` }}
                aria-hidden
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
