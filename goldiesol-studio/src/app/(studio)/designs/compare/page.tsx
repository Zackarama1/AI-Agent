import Link from 'next/link';
import { EmptyState } from '@/components/brand/empty-state';
import { PageHeader } from '@/components/brand/page-header';
import { StatusPill } from '@/components/brand/status-pill';
import { GarmentSvg } from '@/components/garment/garment-svg';
import { Button } from '@/components/ui/button';
import { getRepository } from '@/lib/data';
import { canvasMeasurements } from '@/lib/garment/render';
import type { CanvasState, Fill } from '@/lib/garment/types';
import { MAX_COMPARE } from '@/lib/library';
import { humanise } from '@/lib/utils';

export const metadata = { title: 'Compare designs' };

function fabric(f: Fill | undefined, colourNames: Map<string, string>) {
  if (!f) return '—';
  switch (f.kind) {
    case 'solid': return (f.colourId && colourNames.get(f.colourId)) || colourNames.get(f.hex.toLowerCase()) || f.hex;
    case 'print': return `${humanise(f.print)} print`;
    case 'image': return 'Uploaded print';
    case 'lace': return `${humanise(f.texture)} lace`;
    default: return humanise(f.kind);
  }
}

const silhouette = (c: CanvasState) =>
  [c.top && humanise(c.top.params.template), c.bottom && humanise(c.bottom.params.template), c.onePiece && humanise(c.onePiece.params.template)]
    .filter(Boolean)
    .join(' + ');

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids = '' } = await searchParams;
  const repo = await getRepository();
  const wanted = [...new Set(ids.split(',').filter(Boolean))].slice(0, MAX_COMPARE);
  const [details, colours, collections, shapes] = await Promise.all([
    Promise.all(wanted.map((id) => repo.getDesign(id))),
    repo.listColours(),
    repo.listCollections(),
    repo.listShapes(),
  ]);
  // Look colours up by id, or by hex for fills that were never picked from the library.
  const colourNames = new Map(colours.flatMap((c) => [[c.id, c.name], [c.hex.toLowerCase(), c.name]] as [string, string][]));
  const items = details.flatMap((d) => {
    if (!d) return [];
    const current = d.versions.find((v) => v.id === d.design.current_version_id) ?? d.versions[0];
    return current ? [{ ...d, canvas: current.canvas, version: current.version_number }] : [];
  });

  if (items.length < 2) {
    return (
      <>
        <PageHeader eyebrow="Library" title="Compare designs" />
        <EmptyState title="Pick two to four designs to compare" action={<Button asChild variant="primary"><Link href="/designs">Back to the library</Link></Button>}>
          Tick “Compare” on the designs you want side by side.
        </EmptyState>
      </>
    );
  }

  const measures = items.map((i) => canvasMeasurements(i.canvas).flatMap((g) => g.measurements.map((m) => ({ ...m, part: g.part }))));
  const codes = [...new Map(measures.flat().map((m) => [m.code, m.name])).entries()];
  const rows: [string, (i: (typeof items)[number]) => React.ReactNode][] = [
    ['Status', (i) => <StatusPill status={i.design.status} />],
    ['Collection', (i) => collections.find((c) => c.id === i.design.collection_id)?.name ?? '—'],
    ['Version', (i) => `v${i.version} of ${i.versions.length}`],
    ['Silhouette', (i) => silhouette(i.canvas)],
    ['Saved shapes', (i) => [i.design.top_shape_id, i.design.bottom_shape_id].map((id) => shapes.find((s) => s.id === id)?.custom_name).filter(Boolean).join(' + ') || 'Custom'],
    ['Top fabric', (i) => fabric(i.canvas.top?.fill ?? i.canvas.onePiece?.fill, colourNames)],
    ['Bottom fabric', (i) => fabric(i.canvas.bottom?.fill, colourNames)],
    ['Details', (i) => i.canvas.embellishments.map((e) => humanise(e.type)).join(', ') || '—'],
    ['Hardware', (i) => i.canvas.hardware.map((h) => `${humanise(h.finish)} ${h.type}`).join(', ') || '—'],
  ];

  return (
    <>
      <PageHeader eyebrow="Library" title="Compare designs" description="Current versions, side by side. Measurements are for base size M." />
      <div className="overflow-x-auto rounded-[var(--radius-gs)] border border-line bg-surface">
        <table className="w-full min-w-[640px] table-fixed text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="w-40" />
              {items.map((i) => (
                <th key={i.design.id} className="px-3 py-4 text-left align-top font-normal">
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-blush p-1">
                    <GarmentSvg canvas={i.canvas} idPrefix={`cf-${i.design.id.slice(0, 6)}`} padCm={2} className="aspect-square" />
                    <GarmentSvg canvas={i.canvas} view="back" idPrefix={`cb-${i.design.id.slice(0, 6)}`} padCm={2} className="aspect-square" />
                  </div>
                  <Link href={`/designs/${i.design.id}`} className="mt-2 block font-display text-xl leading-tight hover:text-gold-deep">{i.design.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, cell]) => (
              <tr key={label} className="border-b border-line">
                <th className="gs-label px-3 py-2.5 text-left align-top font-semibold">{label}</th>
                {items.map((i) => <td key={i.design.id} className="px-3 py-2.5 align-top">{cell(i)}</td>)}
              </tr>
            ))}
            {codes.map(([code, name]) => (
              <tr key={code} className="border-b border-line last:border-0">
                <th className="px-3 py-2 text-left align-top text-xs font-normal text-mist">{code} · {name}</th>
                {measures.map((list, idx) => {
                  const m = list.find((x) => x.code === code);
                  return <td key={items[idx].design.id} className="px-3 py-2 tabular-nums">{m ? `${m.valueCm} cm` : '—'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
