import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LaceWatermark } from './lace';
import { SunGlyph } from './wordmark';

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center overflow-hidden rounded-[var(--radius-gs)] border border-dashed border-line bg-blush/60 px-6 py-14 text-center',
        className,
      )}
    >
      <LaceWatermark />
      <SunGlyph className="relative size-9" />
      <h3 className="relative mt-4 font-display text-2xl">{title}</h3>
      {children && <div className="relative mt-2 max-w-md text-sm text-mist">{children}</div>}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}
