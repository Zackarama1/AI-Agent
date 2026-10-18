'use client';

import { Copy, MapPin, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { duplicateDesignAction, getVersionAction, restoreVersionAction } from '@/app/actions/designs';
import { addNoteAction, setNoteResolvedAction } from '@/app/actions/notes';
import { saveShapeAction } from '@/app/actions/shapes';
import { GarmentSvg } from '@/components/garment/garment-svg';
import { AREA_EMBELLISHMENTS, PART_PATHS, withBottomTemplate, withOnePieceTemplate, withTopTemplate } from '@/lib/garment/defaults';
import {
  duplicateEmbellishment, getPiece, PART_LABEL, partsOf, removeEmbellishment, setParams, updateEmbellishment, updatePiece,
} from '@/lib/garment/ops';
import type { BottomParams, BottomTemplate, CanvasState, Embellishment, OnePieceParams, OnePieceTemplate, PiecePart, TopParams, TopTemplate } from '@/lib/garment/types';
import { cn, formatDate, humanise } from '@/lib/utils';
import { useEditor, useEditorStore, useLibrary } from './context';
import { PanelSection, Segmented, Select, Slider, Swatch } from './controls';
import { ParamControls } from './param-controls';
import type { RightTab } from './store';
import type { DesignNote } from '@/lib/types';

const TABS = ['properties', 'ai', 'notes', 'versions'] as const satisfies readonly RightTab[];
type Tab = RightTab;
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

function VersionsTab({ designId }: { designId: string }) {
  const store = useEditorStore();
  const router = useRouter();
  const { colourHex } = useLibrary();
  const versions = useEditor((s) => s.versions);
  const saveStatus = useEditor((s) => s.save.status);
  const [preview, setPreview] = useState<{ id: string; version_number: number; canvas: CanvasState } | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const latest = versions[0]?.id;

  const open = (id: string) =>
    start(async () => {
      setError(null);
      try {
        setPreview(await getVersionAction(designId, id));
      } catch {
        setError('Couldn’t load that version.');
      }
    });

  const restore = () =>
    preview &&
    start(async () => {
      const res = await restoreVersionAction(designId, preview.id);
      store.getState().replaceCanvas(res.canvas);
      store.getState().addVersion(res.version);
      setPreview(null);
    });

  const branch = () =>
    preview &&
    start(async () => {
      const copy = await duplicateDesignAction(designId, preview.id);
      router.push(`/designs/${copy.id}`);
    });

  return (
    <PanelSection title="Version history">
      {preview && (
        <div className="flex flex-col gap-2 rounded-xl border border-champagne bg-blush/60 p-3" data-testid="version-preview">
          <div className="flex items-center justify-between">
            <span className="gs-label text-gold-deep">Previewing v{preview.version_number}</span>
            <button type="button" className="text-xs text-mist hover:text-ink" onClick={() => setPreview(null)}>Close</button>
          </div>
          <GarmentSvg canvas={preview.canvas} colourHex={colourHex} idPrefix={`vp-${preview.version_number}`} padCm={2} className="aspect-square rounded-lg bg-surface" />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || preview.id === latest || saveStatus === 'saving'}
              onClick={restore}
              className="flex-1 rounded-lg bg-ink px-2 py-1.5 text-xs text-ivory disabled:opacity-40"
            >
              {preview.id === latest ? 'Current version' : 'Restore this version'}
            </button>
            <button type="button" disabled={pending} onClick={branch} className="flex-1 rounded-lg border border-line px-2 py-1.5 text-xs hover:bg-surface">
              Branch as new design
            </button>
          </div>
          <p className="text-[11px] text-mist">Restoring saves it as a new version — history is never rewritten.</p>
        </div>
      )}
      {error && <p className="text-xs text-[#9B1B30]" role="alert">{error}</p>}
      <ol className="flex flex-col gap-1 text-xs" data-testid="version-list">
        {versions.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => open(v.id)}
              className={cn('w-full rounded-lg border-l-2 py-1.5 pl-3 pr-2 text-left hover:bg-blush', preview?.id === v.id ? 'border-gold-deep bg-blush' : 'border-champagne/60')}
            >
              <span className="gs-label block">
                v{v.version_number}{v.id === latest ? ' · current' : ''} · {formatDate(v.created_at)}{' '}
                {new Date(v.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {v.change_summary}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-mist">Every autosave is a version. Open one to preview, restore or branch from it.</p>
    </PanelSection>
  );
}

const NOTE_TYPE_OPTIONS = ['note', 'feedback', 'change_request', 'supplier_feedback'] as const;
const NOTE_FILTERS = ['open', 'resolved', 'all'] as const;

function NotesTab({ designId }: { designId: string }) {
  const store = useEditorStore();
  const notes = useEditor((s) => s.notes);
  const pendingPin = useEditor((s) => s.pendingPin);
  const pinMode = useEditor((s) => s.pinMode);
  const focusedNoteId = useEditor((s) => s.focusedNoteId);
  const [type, setType] = useState<(typeof NOTE_TYPE_OPTIONS)[number]>('note');
  const [body, setBody] = useState('');
  const [filter, setFilter] = useState<(typeof NOTE_FILTERS)[number]>('open');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pinNumber = new Map(notes.filter((n) => n.anchor).map((n, i) => [n.id, i + 1]));
  const shown = notes.filter((n) => (filter === 'all' ? true : filter === 'open' ? !n.resolved : n.resolved));

  const submit = () =>
    start(async () => {
      setError(null);
      try {
        const note = await addNoteAction({ designId, type, body, anchor: pendingPin });
        store.getState().upsertNote(note);
        store.getState().setPendingPin(null);
        setBody('');
      } catch {
        setError('Couldn’t save that note.');
      }
    });

  // Optimistic: tick first, then confirm with the server (roll back if it fails).
  const resolve = (note: DesignNote, resolved: boolean) => {
    store.getState().upsertNote({ ...note, resolved });
    start(async () => {
      try {
        store.getState().upsertNote(await setNoteResolvedAction(note.id, resolved));
      } catch {
        store.getState().upsertNote(note);
        setError('Couldn’t update that note.');
      }
    });
  };

  return (
    <>
      <PanelSection title="Add a note">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) submit();
          }}
        >
          <Select label="Type" value={type} options={NOTE_TYPE_OPTIONS} onChange={setType} />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            aria-label="Note text"
            placeholder={type === 'change_request' ? 'e.g. Lower the front rise by 2 cm' : 'What should we remember about this piece?'}
            className="rounded-lg border border-line bg-surface p-2 text-xs"
          />
          <div className="flex items-center justify-between gap-2">
            {pendingPin ? (
              <span className="flex items-center gap-1 text-xs text-gold-deep">
                <MapPin className="size-3.5" /> Pinned on the {pendingPin.view}
                <button type="button" aria-label="Remove pin" onClick={() => store.getState().setPendingPin(null)} className="text-mist hover:text-ink">
                  <X className="size-3.5" />
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => store.getState().setPinMode(!pinMode)} className="flex items-center gap-1 text-xs text-mist hover:text-ink">
                <MapPin className="size-3.5" /> {pinMode ? 'Tap the canvas…' : 'Pin to the garment'}
              </button>
            )}
            <button type="submit" disabled={pending || !body.trim()} className="rounded-lg bg-ink px-3 py-1.5 text-xs text-ivory disabled:opacity-40">
              Add
            </button>
          </div>
          {error && <p className="text-xs text-[#9B1B30]" role="alert">{error}</p>}
        </form>
      </PanelSection>
      <PanelSection
        title="Notes & feedback"
        aside={<Segmented label="Show" value={filter} options={NOTE_FILTERS.map((f) => ({ value: f, label: humanise(f) }))} onChange={setFilter} />}
      >
        {shown.length ? (
          <ul className="flex flex-col gap-2 text-xs" data-testid="note-list">
            {shown.map((n) => (
              <li
                key={n.id}
                className={cn('rounded-xl border p-2.5', focusedNoteId === n.id ? 'border-gold-deep bg-blush' : 'border-line', n.resolved && 'opacity-60')}
                onMouseEnter={() => store.getState().focusNote(n.id)}
                onMouseLeave={() => store.getState().focusNote(null)}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={cn('gs-label', n.type === 'change_request' && 'text-[#9B1B30]')}>
                    {pinNumber.has(n.id) && (
                      <button
                        type="button"
                        className="mr-1 underline decoration-dotted"
                        onClick={() => n.anchor && store.getState().set({ view: n.anchor.view })}
                        aria-label={`Show pin ${pinNumber.get(n.id)} on the ${n.anchor?.view}`}
                      >
                        #{pinNumber.get(n.id)}
                      </button>
                    )}
                    {humanise(n.type)}
                  </span>
                  <label className="flex items-center gap-1 text-mist">
                    <input type="checkbox" checked={n.resolved} onChange={(e) => resolve(n, e.target.checked)} className="accent-[var(--gs-gold-deep)]" />
                    Resolved
                  </label>
                </div>
                <p className={cn(n.resolved && 'line-through decoration-mist/60')}>{n.body}</p>
                <p className="mt-1 text-[10px] text-mist">{formatDate(n.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-mist">{filter === 'open' ? 'Nothing open — lovely.' : 'No notes here.'}</p>
        )}
      </PanelSection>
    </>
  );
}

export function RightPanel({ designId }: { designId: string }) {
  const store = useEditorStore();
  const tab = useEditor((s) => s.rightTab);
  const openCount = useEditor((s) => s.notes.filter((n) => !n.resolved).length);
  return (
    <div className="flex min-h-0 flex-col border-line lg:h-full lg:w-80 lg:border-l">
      <div role="tablist" aria-label="Design panels" className="flex shrink-0 overflow-x-auto border-b border-line bg-surface/70">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => store.getState().setRightTab(t)}
            className={cn('flex-1 whitespace-nowrap px-3 py-2.5 text-xs', tab === t ? 'border-b-2 border-gold-deep font-semibold text-ink' : 'text-mist hover:text-ink')}
          >
            {TAB_LABEL[t]}
            {t === 'notes' && openCount > 0 && <span className="ml-1 rounded-full bg-rose/60 px-1.5 text-[10px]">{openCount}</span>}
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
        {tab === 'notes' && <NotesTab designId={designId} />}
        {tab === 'versions' && <VersionsTab designId={designId} />}
      </div>
    </div>
  );
}
