import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide', {
  variants: {
    variant: {
      default: 'border border-line bg-blush text-ink',
      gold: 'border border-champagne/60 bg-champagne/15 text-gold-deep',
      rose: 'bg-rose/60 text-ink',
      muted: 'border border-line text-mist',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
