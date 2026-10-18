import { cn } from '@/lib/utils';

// Small sun with a halo ring — the Goldiesol glyph.
export function SunGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-6 text-champagne', className)}>
      <circle cx="16" cy="16" r="5" fill="currentColor" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return (
          <line
            key={i}
            x1={16 + Math.cos(a) * 11.5}
            y1={16 + Math.sin(a) * 11.5}
            x2={16 + Math.cos(a) * 14}
            y2={16 + Math.sin(a) * 14}
            stroke="currentColor"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export function Wordmark({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <SunGlyph />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-semibold tracking-[0.32em] text-ink">GOLDIESOL</span>
        {subtitle && <span className="mt-1 text-[9px] font-semibold tracking-[0.42em] text-mist">STUDIO</span>}
      </span>
    </span>
  );
}
