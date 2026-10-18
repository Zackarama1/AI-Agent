'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCollectionAction, updateCollectionAction } from '@/app/actions/collections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Values = { name: string; season: string; description: string };

export function CollectionForm({ id, initial, onDone }: { id?: string; initial?: Partial<Values>; onDone?: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ name: '', season: '', description: '', ...initial });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!values.name.trim()) return setError('Give the collection a name.');
        start(async () => {
          if (id) {
            await updateCollectionAction(id, values);
            router.refresh();
            onDone?.();
          } else {
            const created = await createCollectionAction(values);
            router.push(`/collections/${created.id}`);
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="gs-label">Name</span>
          <Input value={values.name} onChange={set('name')} maxLength={80} placeholder="e.g. Resort 27" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="gs-label">Season / drop</span>
          <Input value={values.season} onChange={set('season')} maxLength={40} placeholder="e.g. Resort 27" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="gs-label">Story</span>
        <textarea value={values.description} onChange={set('description')} maxLength={1000} rows={2} className="rounded-xl border border-line bg-surface p-3 text-sm" placeholder="What ties these pieces together?" />
      </label>
      {error && <p className="text-sm text-[#9B1B30]" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>{id ? 'Save changes' : 'Create collection'}</Button>
        {onDone && <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  );
}

export function NewCollection() {
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="primary" onClick={() => setOpen(true)}>New collection</Button>;
  return (
    <div className="w-full rounded-[var(--radius-gs)] border border-line bg-surface p-4 sm:w-[520px]">
      <CollectionForm onDone={() => setOpen(false)} />
    </div>
  );
}
