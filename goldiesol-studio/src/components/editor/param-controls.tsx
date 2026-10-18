'use client';

import { BOTTOM_TEMPLATES, ONE_PIECE_TEMPLATES, TOP_TEMPLATES } from '@/lib/garment/defaults';
import { TOP_FAMILY } from '@/lib/garment/templates/top';
import type { PiecePart } from '@/lib/garment/types';
import { humanise } from '@/lib/utils';
import { Select, Slider, Toggle } from './controls';
import { BOTTOM_FIELDS, ONE_PIECE_FIELDS, TOP_FIELDS, type LooseFieldSet } from './fields';

const FIELDS = { top: TOP_FIELDS, bottom: BOTTOM_FIELDS, one_piece: ONE_PIECE_FIELDS } as const;
const TEMPLATES = { top: TOP_TEMPLATES, bottom: BOTTOM_TEMPLATES, one_piece: ONE_PIECE_TEMPLATES } as const;

// Templates rendered from a close base (see TOP_FAMILY) are labelled so nobody mistakes them for bespoke.
const templateLabel = (part: PiecePart) => (t: string) =>
  part === 'top' && TOP_FAMILY[t as keyof typeof TOP_FAMILY] !== t ? `${humanise(t)} (preview)` : humanise(t);

export function ParamControls({
  part,
  params,
  onChange,
  onTemplate,
}: {
  part: PiecePart;
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>, coalesceKey?: string) => void;
  onTemplate: (template: string) => void;
}) {
  const fields = FIELDS[part] as unknown as LooseFieldSet;
  return (
    <div className="flex flex-col gap-4">
      <Select label="Silhouette" value={String(params.template)} options={TEMPLATES[part]} onChange={onTemplate} format={templateLabel(part)} />
      {fields.sliders.map((f) => (
        <Slider
          key={f.key}
          label={f.label}
          unit={f.unit}
          min={f.min}
          max={f.max}
          step={f.step}
          value={Number(params[f.key])}
          onChange={(v) => onChange({ [f.key]: v }, `${part}.${f.key}`)}
        />
      ))}
      <div className="flex flex-col gap-2.5">
        {fields.selects.map((f) => (
          <Select key={f.key} label={f.label} value={String(params[f.key])} options={f.options} onChange={(v) => onChange({ [f.key]: v })} />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {fields.toggles.map((f) => (
          <Toggle key={f.key} label={f.label} checked={Boolean(params[f.key])} onChange={(v) => onChange({ [f.key]: v })} />
        ))}
      </div>
    </div>
  );
}
