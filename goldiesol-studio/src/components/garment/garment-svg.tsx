import { renderGarmentSvg, type RenderOptions } from '@/lib/garment/render';
import type { CanvasState } from '@/lib/garment/types';
import { cn } from '@/lib/utils';

// Renders the parametric engine's SVG. Every string that reaches the markup is
// validated or escaped inside renderGarmentSvg.
export function GarmentSvg({ canvas, className, ...opts }: RenderOptions & { canvas: CanvasState; className?: string }) {
  return (
    <div
      className={cn('[&>svg]:h-full [&>svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: renderGarmentSvg(canvas, opts) }}
    />
  );
}
