import { cn } from '@/lib/utils';

// Hand-built scalloped floral lace tile, used as a very faint watermark on empty states.
export function LaceWatermark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={cn('pointer-events-none absolute inset-0 h-full w-full text-gold-deep opacity-[0.07]', className)}>
      <defs>
        <pattern id="gs-lace" width="56" height="56" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="0.8">
            <path d="M0 56 Q14 42 28 56 Q42 42 56 56" />
            <path d="M0 0 Q14 14 28 0 Q42 14 56 0" />
            <circle cx="28" cy="28" r="5" />
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <ellipse key={deg} cx="28" cy="19" rx="3" ry="6" transform={`rotate(${deg} 28 28)`} />
            ))}
            <circle cx="0" cy="28" r="1.2" />
            <circle cx="56" cy="28" r="1.2" />
            <circle cx="14" cy="49" r="0.9" />
            <circle cx="42" cy="49" r="0.9" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#gs-lace)" />
    </svg>
  );
}
