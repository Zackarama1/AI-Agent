import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-mist focus:border-champagne focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}
