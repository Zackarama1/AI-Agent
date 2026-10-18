'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveShapeAction } from '@/app/actions/shapes';
import { Segmented } from '@/components/editor/controls';
import { ParamControls } from '@/components/editor/param-controls';
import { GarmentSvg } from '@/components/garment/garment-svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_BOTTOM, DEFAULT_ONE_PIECE, DEFAULT_TOP, withBottomTemplate, withOnePieceTemplate, withTopTemplate,
} from '@/lib/garment/defaults';
import { canvasMeasurements } from '@/lib/garment/render';
import { shapeCanvas } from '@/lib/garment/preview';
import type { BottomParams, BottomTemplate, OnePieceParams, OnePieceTemplate, PiecePart, TopParams, TopTemplate } from '@/lib/garment/types';


// "Create new shape" (§5.4): parametric controls from a base template, live preview, custom name.
export function ShapeEditor() {
  const router = useRouter();
  const [kind, setKind] = useState<PiecePart>('top');
  const [params, setParams] = useState<Record<PiecePart, Record<string, unknown>>>({
    top: { ...DEFAULT_TOP },
    bottom: { ...DEFAULT_BOTTOM },
    one_piece: { ...DEFAULT_ONE_PIECE },
  });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = params[kind];
  const canvas = shapeCanvas(kind, current);
  const measurements = canvasMeasurements(canvas)[0]?.measurements ?? [];

  const onTemplate = (t: string) =>
    setParams((all) => ({
      ...all,
      [kind]:
        kind === 'top' ? withTopTemplate(all.top as unknown as TopParams, t as TopTemplate)
        : kind === 'bottom' ? withBottomTemplate(all.bottom as unknown as BottomParams, t as BottomTemplate)
        : withOnePieceTemplate(all.one_piece as unknown as OnePieceParams, t as OnePieceTemplate),
    }));

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveShapeAction({ kind, customName: name, params: current } as Parameters<typeof saveShapeAction>[0]);
      if (!res.ok) return setError(res.error);
      router.push('/shapes');
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        <Segmented
          label="Kind"
          value={kind}
          options={[{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }, { value: 'one_piece', label: 'One-piece' }]}
          onChange={setKind}
        />
        <div className="grid gap-4 rounded-[var(--radius-gs)] border border-line bg-surface p-4 sm:grid-cols-2">
          <GarmentSvg canvas={canvas} idPrefix="se-f" className="aspect-square bg-blush/50" />
          <GarmentSvg canvas={canvas} view="back" idPrefix="se-b" className="aspect-square bg-blush/50" />
        </div>
        <div className="rounded-[var(--radius-gs)] border border-line bg-surface p-4">
          <p className="gs-label mb-2">Points of measure · size M</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {measurements.map((m) => (
              <div key={m.code} className="flex justify-between gap-2">
                <dt className="text-mist">{m.code} · {m.name}</dt>
                <dd className="tabular-nums">{m.valueCm} cm <span className="text-mist">±{m.toleranceCm}</span></dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="flex flex-col gap-5 rounded-[var(--radius-gs)] border border-line bg-surface p-4">
        <ParamControls part={kind} params={current} onTemplate={onTemplate} onChange={(patch) => setParams((all) => ({ ...all, [kind]: { ...all[kind], ...patch } }))} />
        <form
          className="flex flex-col gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save();
          }}
        >
          <label className="gs-label" htmlFor="shape-name">Name</label>
          <Input id="shape-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. The Goldie Tri" />
          {error && <p className="text-sm text-[#9B1B30]" role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
            {pending ? 'Saving…' : 'Save shape'}
          </Button>
        </form>
      </div>
    </div>
  );
}

