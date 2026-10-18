import Link from 'next/link';
import { LaceWatermark } from '@/components/brand/lace';
import { StatusPill } from '@/components/brand/status-pill';
import { GarmentSvg } from '@/components/garment/garment-svg';
import type { DesignSummary } from '@/lib/data';
import { cn, formatDate, humanise } from '@/lib/utils';

export function DesignThumb({ design, className }: { design: Pick<DesignSummary, 'id' | 'thumbnail_canvas'>; className?: string }) {
  return (
    <div className={cn('relative bg-blush', className)}>
      <LaceWatermark />
      {design.thumbnail_canvas && (
        <GarmentSvg canvas={design.thumbnail_canvas} idPrefix={`dc-${design.id.slice(0, 8)}`} padCm={3} className="relative h-full w-full p-3" />
      )}
    </div>
  );
}

// `footer` holds interactive controls, kept outside the link so they don't nest inside it.
export function DesignCard({ design, footer, selected }: { design: DesignSummary; footer?: React.ReactNode; selected?: boolean }) {
  return (
    <div
      className={cn(
        // z-index keeps an open actions menu above neighbouring cards (the hover lift creates a stacking context)
        'group relative rounded-[var(--radius-gs)] border bg-surface shadow-soft transition hover:z-10 hover:-translate-y-0.5 hover:border-champagne focus-within:z-20',
        selected ? 'border-gold-deep ring-2 ring-champagne/50' : 'border-line',
      )}
      data-testid="design-card"
    >
      <Link href={`/designs/${design.id}`} className="block">
        <DesignThumb design={design} className="aspect-[4/3] overflow-hidden rounded-t-[calc(var(--radius-gs)-1px)]" />
        <div className="flex flex-col gap-2 p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-xl leading-tight group-hover:text-gold-deep">{design.name}</h3>
            <StatusPill status={design.status} />
          </div>
          <p className="text-xs text-mist">
            {[design.category && humanise(design.category), design.collection_name, `v${design.version_count}`].filter(Boolean).join(' · ')}
          </p>
          <p className="text-[11px] text-mist">Edited {formatDate(design.updated_at)}</p>
        </div>
      </Link>
      {footer ? <div className="px-4 pb-3">{footer}</div> : <div className="pb-2" />}
    </div>
  );
}
