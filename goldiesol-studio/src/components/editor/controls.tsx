'use client';

import { useId } from 'react';
import { cn, humanise } from '@/lib/utils';

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="gs-label">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-mist">{hint}</span>}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.5,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs text-mist">{label}</label>
        <span className="flex items-center gap-1 text-xs tabular-nums">
          <input
            type="number"
            aria-label={`${label} value`}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => e.target.value !== '' && onChange(clamp(Number(e.target.value)))}
            className="w-14 rounded-md border border-line bg-surface px-1.5 py-0.5 text-right"
          />
          {unit && <span className="w-5 text-mist">{unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[var(--gs-gold-deep)]"
      />
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  format = humanise,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-xs text-mist">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 max-w-[60%] rounded-lg border border-line bg-surface px-2 text-xs text-ink"
      >
        {options.map((o) => (
          <option key={o} value={o}>{format(o)}</option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-mist">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-5 w-9 rounded-full border transition-colors', checked ? 'border-gold-deep bg-champagne' : 'border-line bg-blush')}
      >
        <span className={cn('absolute top-0.5 size-3.5 rounded-full bg-surface shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs transition-colors',
            value === o.value ? 'bg-ink text-ivory' : 'text-mist hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Swatch({ hex, name, selected, onClick }: { hex: string; name: string; selected?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={selected}
      onClick={onClick}
      className={cn('size-7 rounded-full border border-line shadow-sm transition-transform hover:scale-110', selected && 'ring-2 ring-champagne ring-offset-2 ring-offset-surface')}
      style={{ background: hex }}
    />
  );
}

export function PanelSection({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-4 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg leading-none">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
