'use client';

import { Pencil, Star } from 'lucide-react';
import { useState, useTransition } from 'react';
import { updateShapeAction } from '@/app/actions/shapes';
import { cn } from '@/lib/utils';

export function ShapeCardActions({ id, name, favourite }: { id: string; name: string; favourite: boolean }) {
  const [fav, setFav] = useState(favourite);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rename = () =>
    start(async () => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === name) return setEditing(false);
      const res = await updateShapeAction(id, { customName: trimmed });
      if (res.ok) {
        setEditing(false);
        setError(null);
      } else setError(res.error ?? 'Could not rename.');
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-0.5">
        <button
          type="button"
          aria-label={fav ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
          aria-pressed={fav}
          disabled={pending}
          onClick={() => {
            const next = !fav;
            setFav(next);
            start(async () => {
              await updateShapeAction(id, { isFavourite: next });
            });
          }}
          className="rounded-full p-1.5 hover:bg-blush"
        >
          <Star className={cn('size-4', fav ? 'fill-champagne text-champagne' : 'text-mist')} />
        </button>
        <button type="button" aria-label={`Rename ${name}`} onClick={() => setEditing((e) => !e)} className="rounded-full p-1.5 text-mist hover:bg-blush hover:text-ink">
          <Pencil className="size-4" />
        </button>
      </div>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            rename();
          }}
          className="flex gap-1"
        >
          <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} aria-label="New name" autoFocus className="h-7 w-36 rounded-md border border-line bg-surface px-2 text-xs" />
          <button type="submit" className="rounded-md bg-ink px-2 text-xs text-ivory">Save</button>
        </form>
      )}
      {error && <p className="text-[11px] text-[#9B1B30]" role="alert">{error}</p>}
    </div>
  );
}
