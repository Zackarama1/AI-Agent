import { Star } from 'lucide-react';
import { GarmentGlyph } from '@/components/brand/garment-glyph';
import { PageHeader, SectionTitle } from '@/components/brand/page-header';
import { Card } from '@/components/ui/card';
import { getRepository } from '@/lib/data';
import type { Shape, ShapeKind } from '@/lib/types';
import { humanise } from '@/lib/utils';

export const metadata = { title: 'Shapes' };

const GROUPS: [ShapeKind, string][] = [
  ['top', 'Tops'],
  ['bottom', 'Bottoms'],
  ['one_piece', 'One-pieces'],
  ['cover_up', 'Cover-ups'],
];

// The headline measurements per kind, in the order a pattern-maker reads them.
const KEY_PARAMS: Record<string, [key: string, label: string, unit: string][]> = {
  top: [['cupHeightCm', 'Cup height', 'cm'], ['cupWidthCm', 'Cup width', 'cm'], ['strapWidthMm', 'Strap', 'mm']],
  bottom: [['riseFrontCm', 'Front rise', 'cm'], ['riseBackCm', 'Back rise', 'cm'], ['legCutAngleDeg', 'Leg cut', '°']],
};

function ShapeCard({ shape }: { shape: Shape }) {
  const params = shape.params as Record<string, unknown>;
  return (
    <Card className="flex gap-4 p-4">
      <div className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-blush">
        <GarmentGlyph kind={shape.kind} template={shape.base_template} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl leading-tight">{shape.custom_name}</h3>
          {shape.is_favourite && <Star className="size-4 shrink-0 fill-champagne text-champagne" aria-label="Favourite" />}
        </div>
        <p className="gs-label mt-1">{humanise(shape.base_template)} · used {shape.times_used}×</p>
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {(KEY_PARAMS[shape.kind] ?? []).map(([k, label, unit]) =>
            params[k] !== undefined ? (
              <div key={k}>
                <dt className="inline text-mist">{label} </dt>
                <dd className="inline tabular-nums">{String(params[k])}{unit}</dd>
              </div>
            ) : null,
          )}
        </dl>
        {shape.notes && <p className="mt-2 text-xs text-mist">{shape.notes}</p>}
      </div>
    </Card>
  );
}

export default async function ShapesPage() {
  const shapes = await (await getRepository()).listShapes();
  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Shapes"
        description="The silhouettes you love, saved with their own names. Measurements are for base size M; the editor (phase 2) lets you create and tune new ones."
      />
      {GROUPS.map(([kind, label]) => {
        const list = shapes.filter((s) => s.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="mb-10">
            <SectionTitle>{label}</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">{list.map((s) => <ShapeCard key={s.id} shape={s} />)}</div>
          </section>
        );
      })}
    </>
  );
}
