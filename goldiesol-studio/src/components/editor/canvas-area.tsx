'use client';

import { Grid3x3, Maximize, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { useMemo } from 'react';
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

  const svg = useMemo(
    () => renderGarmentSvg(canvas, { view, mode, size, grid, colourHex, selected: selection, annotations: true, idPrefix: 'ed' }),
    [canvas, view, mode, size, grid, colourHex, selection],
  );

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as Element;
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
      <div className="relative min-h-[360px] flex-1 overflow-auto bg-blush/50" onClick={onClick} data-testid="garment-canvas">
        <div
          className="mx-auto p-6 [&>svg]:h-auto [&>svg]:w-full"
          style={{ width: `calc(min(100%, 640px) * ${zoom})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
