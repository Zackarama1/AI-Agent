import Link from 'next/link';
import { LaceWatermark } from '@/components/brand/lace';
import { StatusPill } from '@/components/brand/status-pill';
import { GarmentSvg } from '@/components/garment/garment-svg';
import type { DesignSummary } from '@/lib/data';
import { formatDate, humanise } from '@/lib/utils';

export function DesignCard({ design }: { design: DesignSummary }) {

  return (
    <Link
      href={`/designs/${design.id}`}
      className="group block overflow-hidden rounded-[var(--radius-gs)] border border-line bg-surface shadow-soft transition hover:-translate-y-0.5 hover:border-champagne"
    >
      <div className="relative aspect-[4/3] bg-blush">
        <LaceWatermark />
        {design.thumbnail_canvas && (
          <GarmentSvg canvas={design.thumbnail_canvas} idPrefix={`dc-${design.id.slice(0, 8)}`} padCm={3} className="relative h-full w-full p-3" />
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
