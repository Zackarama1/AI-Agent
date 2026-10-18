'use client';

import { Star } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { createDesignAction } from '@/app/actions/designs';
import { GarmentSvg } from '@/components/garment/garment-svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shapeCanvas } from '@/lib/garment/preview';
import type { CanvasState } from '@/lib/garment/types';
import type { Shape } from '@/lib/types';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'bikini', label: 'Bikini' },
  { value: 'one_piece', label: 'One-piece' },
  { value: 'monokini', label: 'Monokini' },
] as const;
type Category = (typeof CATEGORIES)[number]['value'];

const preview = (shape: Shape): CanvasState => shapeCanvas(shape.kind, shape.params);

function ShapePicker({ title, shapes, value, onChange }: { title: string; shapes: Shape[]; value?: string; onChange: (id: string) => void }) {
  const previews = useMemo(() => new Map(shapes.map((s) => [s.id, preview(s)])), [shapes]);
  return (
    <fieldset className="mb-8">
      <legend className="mb-3 font-display text-2xl">{title}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label={title}>
        {shapes.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={value === s.id}
            onClick={() => onChange(s.id)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl border bg-surface p-3 text-center transition-colors hover:border-champagne',
              value === s.id ? 'border-gold-deep ring-2 ring-champagne/50' : 'border-line',
            )}
          >
            <GarmentSvg canvas={previews.get(s.id)!} idPrefix={`np-${s.id.slice(0, 6)}`} padCm={2} className="h-20 w-full" />
            <span className="font-display text-lg leading-tight">{s.custom_name}</span>
            {s.is_favourite && <span className="gs-label flex items-center gap-1 text-gold-deep"><Star className="size-3 fill-champagne" />Favourite</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function NewDesignForm({ tops, bottoms }: { tops: Shape[]; bottoms: Shape[] }) {
  const [category, setCategory] = useState<Category>('bikini');
  const [topId, setTopId] = useState(tops[0]?.id);
  const [bottomId, setBottomId] = useState(bottoms[0]?.id);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        await createDesignAction({ name: name.trim() || 'Untitled piece', category, topShapeId: topId, bottomShapeId: bottomId });
      } catch (err) {
        // redirect() throws to navigate — let it through.
        if (err && typeof err === 'object' && 'digest' in err && String(err.digest).startsWith('NEXT_REDIRECT')) throw err;
        setError('We couldn’t start that design. Please try again.');
      }
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="mb-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Piece">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={category === c.value}
            onClick={() => setCategory(c.value)}
            className={cn('rounded-full border px-4 py-2 text-sm', category === c.value ? 'border-ink bg-ink text-ivory' : 'border-line bg-surface hover:border-champagne')}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === 'bikini' && (
        <>
          <ShapePicker title="Top" shapes={tops} value={topId} onChange={setTopId} />
          <ShapePicker title="Bottom" shapes={bottoms} value={bottomId} onChange={setBottomId} />
        </>
      )}
      {category !== 'bikini' && (
        <p className="mb-8 text-sm text-mist">We&rsquo;ll start from a {category === 'monokini' ? 'monokini' : 'scoop-back maillot'} — choose the silhouette in the editor.</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="gs-label">Name this piece</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riviera Pearl Tri" maxLength={120} />
        </label>
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? 'Opening the atelier…' : 'Start designing'}
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-[#9B1B30]" role="alert">{error}</p>}
    </form>
  );
}
