import Link from 'next/link';
import { GarmentGlyph } from '@/components/brand/garment-glyph';
import { LaceWatermark } from '@/components/brand/lace';
import { StatusPill } from '@/components/brand/status-pill';
import type { DesignSummary } from '@/lib/data';
import type { Shape } from '@/lib/types';
import { formatDate, humanise } from '@/lib/utils';

export function DesignCard({ design, shapes }: { design: DesignSummary; shapes: Shape[] }) {
  const top = shapes.find((s) => s.id === design.top_shape_id);
  const bottom = shapes.find((s) => s.id === design.bottom_shape_id);

  return (
    <Link
      href={`/designs/${design.id}`}
      className="group block overflow-hidden rounded-[var(--radius-gs)] border border-line bg-surface shadow-soft transition hover:-translate-y-0.5 hover:border-champagne"
    >
      <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-1 bg-blush">
        <LaceWatermark />
        {top || bottom ? (
          <>
            {top && <GarmentGlyph kind="top" template={top.base_template} className="relative h-20 w-24" />}
            {bottom && <GarmentGlyph kind="bottom" template={bottom.base_template} className="relative h-16 w-24" />}
          </>
        ) : (
          <GarmentGlyph kind="one_piece" template="one_piece" className="relative h-28 w-28" />
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl leading-tight group-hover:text-gold-deep">{design.name}</h3>
          <StatusPill status={design.status} />
        </div>
        <p className="text-xs text-mist">
          {[design.category && humanise(design.category), design.collection_name, `v${design.version_count}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="text-[11px] text-mist">Edited {formatDate(design.updated_at)}</p>
      </div>
    </Link>
  );
}
