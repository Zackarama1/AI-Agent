import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, SectionTitle } from '@/components/brand/page-header';
import { GarmentSvg } from '@/components/garment/garment-svg';
import { ShapeCardActions } from '@/components/shapes/shape-card-actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getRepository } from '@/lib/data';
import { shapeCanvas } from '@/lib/garment/preview';
import type { Shape, ShapeKind } from '@/lib/types';
import { humanise } from '@/lib/utils';

export const metadata = { title: 'Shapes' };
export const dynamic = 'force-dynamic';

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
  one_piece: [['necklineDepthCm', 'Neckline', 'cm'], ['backScoopDepthCm', 'Back scoop', 'cm'], ['legCutAngleDeg', 'Leg cut', '°']],
};

function ShapeCard({ shape }: { shape: Shape }) {
  const params = shape.params as unknown as Record<string, unknown>;
  return (
    <Card className="flex gap-4 p-4" data-testid="shape-card">
      <GarmentSvg canvas={shapeCanvas(shape.kind, shape.params)} idPrefix={`sc-${shape.id.slice(0, 8)}`} padCm={2} className="size-24 shrink-0 rounded-xl bg-blush" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl leading-tight">{shape.custom_name}</h3>
          <ShapeCardActions id={shape.id} name={shape.custom_name} favourite={shape.is_favourite} />
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
        description="The silhouettes you love, saved with their own names. Measurements are for base size M."
        action={<Button asChild variant="primary"><Link href="/shapes/new"><Plus /> Create new shape</Link></Button>}
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
