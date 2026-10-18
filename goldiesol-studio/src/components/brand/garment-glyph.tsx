import type { ShapeKind } from '@/lib/types';
import { cn } from '@/lib/utils';

// Simple line silhouettes per base template. Phase 2 replaces these with the
// parametric garment engine's real renders.
const PATHS: Record<string, string> = {
  triangle: 'M14 44 L30 14 L38 44 Z M42 44 L50 14 L66 44 Z M30 14 L22 4 M50 14 L58 4 M14 44 L4 46 M66 44 L76 46',
  bandeau: 'M8 20 Q40 12 72 20 L72 40 Q40 46 8 40 Z M40 18 L40 42',
  balconette: 'M10 40 Q12 18 38 20 L40 42 L42 20 Q68 18 70 40 Z M20 22 L22 6 M60 22 L58 6',
  tie_side: 'M10 12 L70 12 Q60 28 46 44 L34 44 Q20 28 10 12 Z M10 12 L2 8 M10 12 L2 18 M70 12 L78 8 M70 12 L78 18',
  cheeky: 'M8 12 L72 12 L70 20 Q56 30 46 44 L34 44 Q24 30 10 20 Z',
  high_waist: 'M12 4 L68 4 L70 18 Q56 32 46 44 L34 44 Q24 32 10 18 Z',
  one_piece: 'M24 4 L32 18 Q40 24 48 18 L56 4 L60 30 Q62 46 50 58 L46 66 L34 66 L30 58 Q18 46 20 30 Z',
};

export function GarmentGlyph({
  template,
  kind,
  fill = 'var(--gs-blush)',
  className,
}: {
  template: string;
  kind: ShapeKind;
  fill?: string;
  className?: string;
}) {
  const d = PATHS[template] ?? (kind === 'top' ? PATHS.triangle : kind === 'bottom' ? PATHS.cheeky : PATHS.one_piece);
  return (
    <svg viewBox="0 0 80 70" aria-hidden className={cn('h-16 w-20 text-gold-deep', className)}>
      <path d={d} fill={fill} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
