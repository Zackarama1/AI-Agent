'use client';

import { Copy, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { saveShapeAction } from '@/app/actions/shapes';
import { AREA_EMBELLISHMENTS, PART_PATHS, withBottomTemplate, withOnePieceTemplate, withTopTemplate } from '@/lib/garment/defaults';
import {
  duplicateEmbellishment, getPiece, PART_LABEL, partsOf, removeEmbellishment, setParams, updateEmbellishment, updatePiece,
} from '@/lib/garment/ops';
import type { BottomParams, BottomTemplate, Embellishment, OnePieceParams, OnePieceTemplate, PiecePart, TopParams, TopTemplate } from '@/lib/garment/types';
import type { DesignNote } from '@/lib/types';
import { cn, formatDate, humanise } from '@/lib/utils';
import { useEditor, useEditorStore, useLibrary } from './context';
import { PanelSection, Segmented, Select, Slider, Swatch } from './controls';
import { ParamControls } from './param-controls';

const TABS = ['properties', 'ai', 'notes', 'versions'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { properties: 'Properties', ai: 'AI Partner', notes: 'Notes', versions: 'Versions' };

function SaveAsShape({ part }: { part: PiecePart }) {
  const store = useEditorStore();
  const canvas = useEditor((s) => s.canvas);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const piece = getPiece(canvas, part);
  if (!piece) return null;

  const save = () =>
    start(async () => {
      const kind = part === 'one_piece' ? 'one_piece' : part;
      const res = await saveShapeAction({ kind, customName: name, params: piece.params } as Parameters<typeof saveShapeAction>[0]);
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      store.getState().update((c) => updatePiece(c, part, (p) => ({ ...p, shapeId: res.shape.id })));
      setMessage({ ok: true, text: `Saved as "${res.shape.custom_name}".` });
      setName('');
    });

  return (
    <PanelSection title="Save as shape">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={part === 'top' ? 'e.g. The Riviera Tri' : part === 'bottom' ? 'e.g. Soleil Cheeky' : 'e.g. The Amalfi Maillot'}
          aria-label="Shape name"
          maxLength={60}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs"
        />
        <button type="submit" disabled={pending || !name.trim()} className="rounded-lg bg-ink px-3 text-xs text-ivory disabled:opacity-40">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>
      {message && <p className={cn('text-xs', message.ok ? 'text-gold-deep' : 'text-[#9B1B30]')} role="status">{message.text}</p>}
    </PanelSection>
  );
}

function PieceProperties({ part }: { part: PiecePart }) {
  const store = useEditorStore();
  const canvas = useEditor((s) => s.canvas);
  const { shapes } = useLibrary();
  const piece = getPiece(canvas, part);
  if (!piece) return null;
  const params = piece.params as Record<string, unknown>;
  const shape = shapes.find((s) => s.id === piece.shapeId);

  const onTemplate = (template: string) =>
    store.getState().update((c) =>
      updatePiece(c, part, (p) => ({
        ...p,
        shapeId: undefined,
        params:
          part === 'top' ? withTopTemplate(p.params as TopParams, template as TopTemplate)
          : part === 'bottom' ? withBottomTemplate(p.params as BottomParams, template as BottomTemplate)
          : withOnePieceTemplate(p.params as OnePieceParams, template as OnePieceTemplate),
      })),
    );

  return (
    <>
      <PanelSection title={PART_LABEL[part]} aside={shape ? <span className="gs-label text-gold-deep">{shape.custom_name}</span> : <span className="gs-label">Custom</span>}>
        <ParamControls
          part={part}
          params={params}
          onTemplate={onTemplate}
          onChange={(patch, key) => store.getState().update((c) => setParams(c, part, patch), key)}
        />
        <p className="text-[11px] text-mist">Measurements are for base size M; other sizes grade automatically.</p>
      </PanelSection>
      <SaveAsShape part={part} />
    </>
  );
}

function EmbellishmentProperties({ e }: { e: Embellishment }) {
  const store = useEditorStore();
  const { colours } = useLibrary();
  const part = e.part === 'strap' || e.part === 'tie' ? 'top' : e.part;
  const area = AREA_EMBELLISHMENTS.includes(e.type);
  const set = (patch: Partial<Embellishment>, key?: string) => store.getState().update((c) => updateEmbellishment(c, e.id, patch), key);
  const paths = PART_PATHS[part];
  const swatches = colours.filter((c) => ['Goldiesol Core', 'Metallics', 'Riviera Neutrals', 'Sunset Coral', 'Jewel Tones'].includes(c.palette));
  const usesWidth = ['lace_trim', 'scallop_edge', 'ruffle', 'contrast_binding', 'pearl', 'applique_flower', 'bow', 'ring'].includes(e.type);
  const usesSpacing = ['pearl', 'bead_strand', 'applique_flower', 'charm'].includes(e.type);

  return (
    <PanelSection
      title={humanise(e.type)}
      aside={
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Duplicate (⌘D)"
            title="Duplicate (⌘D)"
            className="rounded-full p-1.5 text-mist hover:bg-blush hover:text-ink"
            onClick={() => {
              let id: string | undefined;
              store.getState().update((c) => {
                const res = duplicateEmbellishment(c, e.id);
                id = res.id;
                return res.canvas;
              });
              if (id) store.getState().select({ part, embellishmentId: id });
            }}
          >
            <Copy className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Remove (Delete)"
            title="Remove (Delete)"
            className="rounded-full p-1.5 text-mist hover:bg-blush hover:text-ink"
            onClick={() => {
              store.getState().update((c) => removeEmbellishment(c, e.id));
              store.getState().select({ part });
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      }
    >
      <Select
        label={area ? 'Area' : 'Follows'}
        value={e.path}
        options={paths.map((p) => p.value)}
        format={(v) => paths.find((p) => p.value === v)?.label ?? humanise(v)}
        onChange={(path) => set({ path })}
      />
      {usesWidth && <Slider label={e.type === 'pearl' ? 'Pearl size' : 'Width'} unit="mm" min={2} max={60} step={1} value={e.widthMm ?? 10} onChange={(widthMm) => set({ widthMm }, `${e.id}.w`)} />}
      {usesSpacing && <Slider label="Spacing" unit="mm" min={3} max={80} step={1} value={e.spacingMm ?? 12} onChange={(spacingMm) => set({ spacingMm }, `${e.id}.s`)} />}
      {e.type === 'bead_scatter' && <Slider label="Beads per panel" min={5} max={200} step={5} value={e.density ?? 40} onChange={(density) => set({ density }, `${e.id}.d`)} />}
      <div>
        <p className="gs-label mb-1.5">Colour</p>
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((c) => <Swatch key={c.id} hex={c.hex} name={c.name} selected={e.colourId === c.id} onClick={() => set({ colourId: c.id })} />)}
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="gs-label">Construction note</span>
        <textarea
          value={e.notes ?? ''}
          maxLength={1000}
          onChange={(ev) => set({ notes: ev.target.value || undefined }, `${e.id}.notes`)}
          rows={3}
          placeholder="e.g. Hand-sewn, lock-stitch per pearl"
          className="rounded-lg border border-line bg-surface p-2 text-xs"
        />
      </label>
    </PanelSection>
  );
}

function PropertiesTab() {
  const store = useEditorStore();
  const canvas = useEditor((s) => s.canvas);
  const selection = useEditor((s) => s.selection);
  const parts = partsOf(canvas);
  const part = selection.part && parts.includes(selection.part) ? selection.part : parts[0];
  const emb = canvas.embellishments.find((e) => e.id === selection.embellishmentId);
  const onPart = canvas.embellishments.filter((e) => (e.part === 'strap' || e.part === 'tie' ? 'top' : e.part) === part);

  return (
    <>
      {parts.length > 1 && (
        <div className="px-4 pt-4">
          <Segmented label="Piece" value={part} options={parts.map((p) => ({ value: p, label: PART_LABEL[p] }))} onChange={(p) => store.getState().select({ part: p })} />
        </div>
      )}
      {emb ? (
        <>
          <EmbellishmentProperties e={emb} />
          <div className="px-4 pb-4">
            <button type="button" className="text-xs text-mist hover:text-ink" onClick={() => store.getState().select({ part })}>
              ← Back to {PART_LABEL[part].toLowerCase()} measurements
            </button>
          </div>
        </>
      ) : (
        <>
          {part && <PieceProperties part={part} />}
          {onPart.length > 0 && (
            <PanelSection title="Details">
              <ul className="flex flex-col gap-1">
                {onPart.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => store.getState().select({ part, embellishmentId: e.id })} className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-blush">
                      <span className="font-medium">{humanise(e.type)}</span> <span className="text-mist">· {humanise(e.path)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </PanelSection>
          )}
        </>
      )}
    </>
  );
}

function VersionsTab() {
  const versions = useEditor((s) => s.versions);
  return (
    <PanelSection title="Version history">
      <ol className="flex flex-col gap-3 text-xs" data-testid="version-list">
        {versions.map((v) => (
          <li key={v.id} className="border-l-2 border-champagne/60 pl-3">
            <span className="gs-label block">v{v.version_number} · {formatDate(v.created_at)} {new Date(v.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            {v.change_summary}
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-mist">Every autosave is a version. Restoring and branching from a version arrive in build phase 3.</p>
    </PanelSection>
  );
}

export function RightPanel({ notes }: { notes: DesignNote[] }) {
  const [tab, setTab] = useState<Tab>('properties');
  return (
    <div className="flex min-h-0 flex-col border-line lg:h-full lg:w-80 lg:border-l">
      <div role="tablist" aria-label="Design panels" className="flex shrink-0 overflow-x-auto border-b border-line bg-surface/70">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn('flex-1 whitespace-nowrap px-3 py-2.5 text-xs', tab === t ? 'border-b-2 border-gold-deep font-semibold text-ink' : 'text-mist hover:text-ink')}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'properties' && <PropertiesTab />}
        {tab === 'ai' && (
          <PanelSection title="Design Partner">
            <p className="text-xs text-mist">
              Your AI design partner — questions, suggestions and the Goldiesol Scorecard — joins this panel in build phase 4.
            </p>
          </PanelSection>
        )}
        {tab === 'notes' && (
          <PanelSection title="Notes & feedback">
            {notes.length ? (
              <ul className="flex flex-col gap-3 text-xs">
                {notes.map((n) => (
                  <li key={n.id}>
                    <span className="gs-label block">{humanise(n.type)}{n.resolved ? ' · resolved' : ''}</span>
                    {n.body}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-mist">No notes yet.</p>
            )}
            <p className="text-[11px] text-mist">Adding notes, change requests and canvas pins arrives in build phase 3.</p>
          </PanelSection>
        )}
        {tab === 'versions' && <VersionsTab />}
      </div>
    </div>
  );
}
