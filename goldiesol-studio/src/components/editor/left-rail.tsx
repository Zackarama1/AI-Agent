'use client';

import { Gem, ImageIcon, Layers, Palette, Scissors, Shapes, Type } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GarmentSvg } from '@/components/garment/garment-svg';
import { EMBELLISHMENT_PRESETS, newCanvas } from '@/lib/garment/defaults';
import { shapeCanvas } from '@/lib/garment/preview';
import {
  addEmbellishment, fillHex, getPiece, newId, PART_LABEL, partsOf, recolour, setFill, updatePiece,
} from '@/lib/garment/ops';
import {
  HARDWARE_FINISHES, HARDWARE_PLACEMENTS, LACE_TEXTURES, PRINTS, type CanvasState, type Fill, type HardwareItem,
  type PiecePart,
} from '@/lib/garment/types';
import type { Shape } from '@/lib/types';
import { cn, humanise } from '@/lib/utils';
import { useEditor, useEditorStore, useLibrary } from './context';
import { PanelSection, Segmented, Select, Slider, Swatch } from './controls';

const TABS = [
  { id: 'shapes', label: 'Shapes', icon: Shapes },
  { id: 'fabrics', label: 'Fabrics', icon: Layers },
  { id: 'lace', label: 'Lace & Trims', icon: Scissors },
  { id: 'beading', label: 'Beading & Hardware', icon: Gem },
  { id: 'colours', label: 'Colours & Prints', icon: Palette },
  { id: 'text', label: 'Text / Labels', icon: Type },
  { id: 'inspiration', label: 'Inspiration', icon: ImageIcon },
] as const;
type TabId = (typeof TABS)[number]['id'];

// The piece most edits apply to: the selected one, else the first on the canvas.
function useTargetPart(): PiecePart | undefined {
  const canvas = useEditor((s) => s.canvas);
  const selected = useEditor((s) => s.selection.part);
  const parts = partsOf(canvas);
  return selected && parts.includes(selected) ? selected : parts[0];
}

function PartPicker() {
  const store = useEditorStore();
  const canvas = useEditor((s) => s.canvas);
  const part = useTargetPart();
  const parts = partsOf(canvas);
  if (parts.length < 2 || !part) return null;
  return (
    <Segmented
      label="Apply to"
      value={part}
      options={parts.map((p) => ({ value: p, label: PART_LABEL[p] }))}
      onChange={(p) => store.getState().select({ part: p })}
    />
  );
}

// --- Shapes -----------------------------------------------------------------

function shapePreview(shape: Shape): CanvasState {
  return shapeCanvas(shape.kind, shape.params);
}


function ShapesPanel() {
  const store = useEditorStore();
  const { shapes } = useLibrary();
  const canvas = useEditor((s) => s.canvas);
  const parts = partsOf(canvas);
  const previews = useMemo(() => new Map(shapes.map((s) => [s.id, shapePreview(s)])), [shapes]);

  const load = (shape: Shape) => {
    const part: PiecePart = shape.kind === 'one_piece' ? 'one_piece' : (shape.kind as PiecePart);
    store.getState().update((c) => updatePiece(c, part, (p) => ({ ...p, params: shape.params, shapeId: shape.id })));
    store.getState().select({ part });
  };

  return (
    <>
      {parts.map((part) => {
        const kind = part === 'one_piece' ? 'one_piece' : part;
        const list = shapes.filter((s) => s.kind === kind);
        const current = getPiece(canvas, part)?.shapeId;
        return (
          <PanelSection key={part} title={`Saved ${part === 'one_piece' ? 'one-pieces' : `${part}s`}`}>
            {list.length ? (
              <div className="grid grid-cols-2 gap-2">
                {list.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => load(s)}
                    className={cn('flex flex-col items-center gap-1 rounded-xl border bg-surface p-2 text-center hover:border-champagne', current === s.id ? 'border-gold-deep' : 'border-line')}
                  >
                    <GarmentSvg canvas={previews.get(s.id)!} idPrefix={`sh-${s.id.slice(0, 6)}`} padCm={2} className="h-14 w-full" />
                    <span className="text-xs leading-tight">{s.custom_name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mist">No saved shapes yet — tune one in Properties and save it with a name.</p>
            )}
          </PanelSection>
        );
      })}
    </>
  );
}

// --- Fabrics ----------------------------------------------------------------

const FABRIC_KINDS = [
  { value: 'solid', label: 'Swim' },
  { value: 'lace', label: 'Lace' },
  { value: 'crochet', label: 'Crochet' },
  { value: 'mesh', label: 'Mesh' },
] as const;

function FabricsPanel() {
  const store = useEditorStore();
  const { materials } = useLibrary();
  const canvas = useEditor((s) => s.canvas);
  const part = useTargetPart();
  if (!part) return null;
  const piece = getPiece(canvas, part)!;
  const fill = piece.fill;
  const hex = fillHex(fill);
  const kind = (['lace', 'crochet', 'mesh'].includes(fill.kind) ? fill.kind : 'solid') as (typeof FABRIC_KINDS)[number]['value'];

  const setKind = (k: typeof kind) => {
    const next: Fill =
      k === 'lace' ? { kind: 'lace', texture: 'floral', hex: fill.kind === 'lace' ? fill.hex : '#FFFFFF', baseHex: hex }
      : k === 'crochet' ? { kind: 'crochet', hex: '#FBF7F2', baseHex: hex }
      : k === 'mesh' ? { kind: 'mesh', hex, opacity: 0.5 }
      : { kind: 'solid', hex: fill.kind === 'lace' || fill.kind === 'crochet' ? (fill.baseHex ?? hex) : hex };
    store.getState().update((c) => setFill(c, part, next));
  };
  const fabrics = materials.filter((m) => m.type === 'main_fabric' || m.type === 'lace' || m.type === 'mesh');

  return (
    <>
      <PanelSection title="Fabric" aside={<PartPicker />}>
        <Segmented label="Fabric type" value={kind} options={[...FABRIC_KINDS]} onChange={setKind} />
        {fill.kind === 'lace' && (
          <Select
            label="Lace"
            value={fill.texture}
            options={LACE_TEXTURES}
            onChange={(texture) => store.getState().update((c) => setFill(c, part, { ...fill, texture }))}
          />
        )}
        {fill.kind === 'mesh' && (
          <Slider label="Sheerness" min={0} max={1} step={0.05} value={fill.opacity} onChange={(opacity) => store.getState().update((c) => setFill(c, part, { ...fill, opacity }), `${part}.mesh`)} />
        )}
        <p className="text-[11px] text-mist">Colour the fabric from Colours &amp; Prints.</p>
      </PanelSection>
      <PanelSection title="From the library">
        <ul className="flex flex-col gap-1">
          {fabrics.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => store.getState().update((c) => updatePiece(c, part, (p) => ({ ...p, materialId: m.id })))}
                className={cn('w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-blush', piece.materialId === m.id && 'bg-rose/40')}
              >
                <span className="block font-medium text-ink">{m.name}</span>
                <span className="text-mist">{m.composition}</span>
              </button>
            </li>
          ))}
        </ul>
      </PanelSection>
    </>
  );
}

// --- Lace & beading ---------------------------------------------------------

function PresetsPanel({ group }: { group: 'lace' | 'beading' }) {
  const store = useEditorStore();
  const part = useTargetPart();
  if (!part) return null;
  const add = (preset: (typeof EMBELLISHMENT_PRESETS)[number]) => {
    const { type, widthMm, spacingMm, density } = preset;
    let addedId = '';
    store.getState().update((c) => {
      const res = addEmbellishment(c, { type, part, widthMm, spacingMm, density });
      addedId = res.id;
      return res.canvas;
    });
    store.getState().select({ part, embellishmentId: addedId });
  };
  return (
    <PanelSection title={group === 'lace' ? 'Lace & trims' : 'Beading'} aside={<PartPicker />}>
      <div className="grid grid-cols-2 gap-2">
        {EMBELLISHMENT_PRESETS.filter((p) => p.group === group).map((p) => (
          <button
            key={p.type}
            type="button"
            onClick={() => add(p)}
            className="rounded-xl border border-line bg-surface px-2 py-2.5 text-xs hover:border-champagne hover:bg-blush"
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-mist">Added to the {PART_LABEL[part].toLowerCase()}. Choose the exact edge in Properties.</p>
    </PanelSection>
  );
}

function HardwarePanel() {
  const store = useEditorStore();
  const hardware = useEditor((s) => s.canvas.hardware);
  const update = (fn: (h: HardwareItem[]) => HardwareItem[]) => store.getState().update((c) => ({ ...c, hardware: fn(c.hardware) }));
  return (
    <PanelSection
      title="Hardware"
      aside={
        <button
          type="button"
          className="text-xs text-gold-deep hover:underline"
          onClick={() => update((h) => [...h, { id: newId(), type: 'ring', finish: 'gold', sizeMm: 20, placement: 'centre_front' }])}
        >
          + Add
        </button>
      }
    >
      {hardware.length === 0 && <p className="text-xs text-mist">Rings, sliders, clasps and toggles — in gold, rose gold, pearl, tortoise or clear.</p>}
      {hardware.map((h) => {
        const set = (patch: Partial<HardwareItem>) => update((all) => all.map((x) => (x.id === h.id ? { ...x, ...patch } : x)));
        return (
          <div key={h.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <Select label="Type" value={h.type} options={['ring', 'slider', 'clasp', 'toggle', 'bead_end'] as const} onChange={(type) => set({ type })} />
            <Select label="Finish" value={h.finish} options={HARDWARE_FINISHES} onChange={(finish) => set({ finish })} />
            <Select label="Placement" value={h.placement} options={HARDWARE_PLACEMENTS} onChange={(placement) => set({ placement })} />
            <Slider label="Size" unit="mm" min={4} max={40} step={1} value={h.sizeMm} onChange={(sizeMm) => set({ sizeMm })} />
            <button type="button" className="self-end text-xs text-mist hover:text-ink" onClick={() => update((all) => all.filter((x) => x.id !== h.id))}>
              Remove
            </button>
          </div>
        );
      })}
    </PanelSection>
  );
}

// --- Colours & prints -------------------------------------------------------

const MAX_UPLOAD_BYTES = 1_500_000;

function ColoursPanel() {
  const store = useEditorStore();
  const { colours } = useLibrary();
  const canvas = useEditor((s) => s.canvas);
  const part = useTargetPart();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const palettes = useMemo(() => {
    const m = new Map<string, typeof colours>();
    for (const c of colours) m.set(c.palette, [...(m.get(c.palette) ?? []), c]);
    return [...m];
  }, [colours]);
  if (!part) return null;
  const fill = getPiece(canvas, part)!.fill;
  const current = fillHex(fill).toLowerCase();

  const upload = (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setUploadError('Use a PNG, JPEG or WebP image.');
    if (file.size > MAX_UPLOAD_BYTES) return setUploadError('Keep prints under 1.5 MB for now.');
    const reader = new FileReader();
    reader.onload = () => store.getState().update((c) => setFill(c, part, { kind: 'image', imageUrl: String(reader.result), scale: 1 }));
    reader.readAsDataURL(file);
  };

  return (
    <>
      <PanelSection title="Colour" aside={<PartPicker />}>
        {palettes.map(([palette, list]) => (
          <div key={palette}>
            <p className="gs-label mb-1.5">{palette}</p>
            <div className="flex flex-wrap gap-1.5">
              {list.map((c) => (
                <Swatch
                  key={c.id}
                  hex={c.hex}
                  name={c.name}
                  selected={current === c.hex.toLowerCase()}
                  onClick={() => store.getState().update((cv) => setFill(cv, part, recolour(fill, c.hex, c.id)))}
                />
              ))}
            </div>
          </div>
        ))}
      </PanelSection>
      <PanelSection title="Prints">
        <div className="grid grid-cols-3 gap-2">
          {PRINTS.map((p) => (
            <button
              key={p}
              type="button"
              title={humanise(p)}
              onClick={() =>
                store.getState().update((c) =>
                  setFill(c, part, { kind: 'print', print: p, hex: fill.kind === 'print' ? fill.hex : fillHex(fill), accentHex: fill.kind === 'print' ? fill.accentHex : '#C8664B', scale: 1 }),
                )
              }
              className={cn('flex flex-col items-center gap-1 rounded-lg border p-1 text-[10px] text-mist hover:border-champagne', fill.kind === 'print' && fill.print === p ? 'border-gold-deep' : 'border-line')}
            >
              <PrintChip print={p} />
              {humanise(p)}
            </button>
          ))}
        </div>
        {fill.kind === 'print' && (
          <>
            <p className="gs-label">Print accent</p>
            <div className="flex flex-wrap gap-1.5">
              {colours.filter((c) => ['Sunset Coral', 'Jewel Tones', 'Goldiesol Core', 'Mediterranean Blues'].includes(c.palette)).map((c) => (
                <Swatch key={c.id} hex={c.hex} name={c.name} selected={fill.accentHex.toLowerCase() === c.hex.toLowerCase()} onClick={() => store.getState().update((cv) => setFill(cv, part, { ...fill, accentHex: c.hex }))} />
              ))}
            </div>
            <Slider label="Print scale" min={0.5} max={3} step={0.25} value={fill.scale} onChange={(scale) => store.getState().update((c) => setFill(c, part, { ...fill, scale }), `${part}.printScale`)} />
          </>
        )}
        <label className="mt-1 cursor-pointer rounded-xl border border-dashed border-line px-3 py-2 text-center text-xs text-mist hover:border-champagne">
          Upload your own print
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {uploadError && <p className="text-xs text-[#9B1B30]" role="alert">{uploadError}</p>}
      </PanelSection>
    </>
  );
}

function PrintChip({ print }: { print: (typeof PRINTS)[number] }) {
  const canvas = useMemo<CanvasState>(() => {
    const c = newCanvas('one_piece');
    return { ...c, onePiece: { ...c.onePiece!, fill: { kind: 'print', print, hex: '#FBF7F2', accentHex: '#C8664B', scale: 0.8 } } };
  }, [print]);
  return <GarmentSvg canvas={canvas} idPrefix={`pc-${print}`} padCm={1} className="h-10 w-full" />;
}

// --- Text / labels ----------------------------------------------------------

function TextPanel() {
  const store = useEditorStore();
  const annotations = useEditor((s) => s.canvas.annotations);
  const [text, setText] = useState('');
  const update = (fn: (a: CanvasState['annotations']) => CanvasState['annotations']) =>
    store.getState().update((c) => ({ ...c, annotations: fn(c.annotations) }));
  return (
    <PanelSection title="Callouts">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          update((a) => [...a, { id: newId(), x: 0.08, y: 0.08 + (a.length % 8) * 0.08, text: text.trim().slice(0, 200) }]);
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Gold logo ring at hip"
          aria-label="Callout text"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs"
        />
        <button type="submit" className="rounded-lg bg-ink px-3 text-xs text-ivory">Add</button>
      </form>
      {annotations.map((a) => (
        <div key={a.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <p className="text-xs">{a.text}</p>
          <Slider label="Across" min={0} max={1} step={0.01} value={a.x} onChange={(x) => update((all) => all.map((n) => (n.id === a.id ? { ...n, x } : n)))} />
          <Slider label="Down" min={0} max={1} step={0.01} value={a.y} onChange={(y) => update((all) => all.map((n) => (n.id === a.id ? { ...n, y } : n)))} />
          <button type="button" className="self-end text-xs text-mist hover:text-ink" onClick={() => update((all) => all.filter((n) => n.id !== a.id))}>Remove</button>
        </div>
      ))}
      <p className="text-[11px] text-mist">Callouts show on the front view and carry into the tech pack.</p>
    </PanelSection>
  );
}

// --- Rail -------------------------------------------------------------------

export function LeftRail() {
  const [tab, setTab] = useState<TabId>('shapes');
  return (
    <div className="flex min-h-0 border-line lg:h-full lg:border-r">
      <nav aria-label="Design tools" className="flex shrink-0 flex-col gap-1 border-r border-line bg-surface/70 p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn('rounded-xl p-2.5 text-mist hover:bg-blush hover:text-ink', tab === id && 'bg-rose/50 text-ink')}
          >
            <Icon className="size-[18px]" strokeWidth={1.5} />
          </button>
        ))}
      </nav>
      <div className="max-h-[70vh] min-w-0 flex-1 overflow-y-auto lg:max-h-none lg:w-72" data-testid={`rail-${tab}`}>
        <p className="gs-label px-4 pt-4">{TABS.find((t) => t.id === tab)!.label}</p>
        {tab === 'shapes' && <ShapesPanel />}
        {tab === 'fabrics' && <FabricsPanel />}
        {tab === 'lace' && <PresetsPanel group="lace" />}
        {tab === 'beading' && (
          <>
            <PresetsPanel group="beading" />
            <HardwarePanel />
          </>
        )}
        {tab === 'colours' && <ColoursPanel />}
        {tab === 'text' && <TextPanel />}
        {tab === 'inspiration' && (
          <PanelSection title="Inspiration board">
            <p className="text-xs text-mist">Moodboards, sketches and photos arrive with the Design Brief interview in build phase 4.</p>
          </PanelSection>
        )}
      </div>
    </div>
  );
}

