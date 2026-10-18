'use client';

import { Archive, ArchiveRestore, Pencil, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { assignDesignsAction, setCollectionArchivedAction } from '@/app/actions/collections';
import { DesignCard } from '@/components/designs/design-card';
import { Button } from '@/components/ui/button';
import type { CollectionSummary, DesignSummary } from '@/lib/data';
import { CollectionForm } from './collection-form';

export function CollectionHeaderActions({ collection }: { collection: CollectionSummary }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}><Pencil /> Edit</Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => start(async () => {
            await setCollectionArchivedAction(collection.id, !collection.archived);
            router.refresh();
          })}
        >
          {collection.archived ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
        </Button>
      </div>
      {editing && (
        <div className="w-full rounded-[var(--radius-gs)] border border-line bg-surface p-4 text-left sm:w-[520px]">
          <CollectionForm
            id={collection.id}
            initial={{ name: collection.name, season: collection.season ?? '', description: collection.description ?? '' }}
            onDone={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}

export function CollectionDesigns({ collectionId, inCollection, others }: { collectionId: string; inCollection: DesignSummary[]; others: DesignSummary[] }) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const assign = (target: string | null, ids: string[]) =>
    start(async () => {
      await assignDesignsAction(target, ids);
      setChosen([]);
      setPicking(false);
      router.refresh();
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant={inCollection.length ? 'outline' : 'primary'} onClick={() => setPicking((p) => !p)}>
          {picking ? 'Close' : 'Add designs'}
        </Button>
      </div>
      {picking && (
        <div className="mb-8 rounded-[var(--radius-gs)] border border-line bg-surface p-4">
          {others.length ? (
            <>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((d) => (
                  <li key={d.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:bg-blush">
                      <input
                        type="checkbox"
                        className="accent-[var(--gs-gold-deep)]"
                        checked={chosen.includes(d.id)}
                        onChange={() => setChosen((c) => (c.includes(d.id) ? c.filter((x) => x !== d.id) : [...c, d.id]))}
                      />
                      <span className="font-display text-lg">{d.name}</span>
                      {d.collection_name && <span className="text-xs text-mist">· in {d.collection_name}</span>}
                    </label>
                  </li>
                ))}
              </ul>
              <Button className="mt-4" variant="primary" disabled={!chosen.length || pending} onClick={() => assign(collectionId, chosen)}>
                Add {chosen.length || ''} to this collection
              </Button>
            </>
          ) : (
            <p className="text-sm text-mist">Every active design is already in this collection.</p>
          )}
        </div>
      )}
      {inCollection.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {inCollection.map((d) => (
            <DesignCard
              key={d.id}
              design={d}
              footer={
                <button type="button" onClick={() => assign(null, [d.id])} disabled={pending} className="flex items-center gap-1 text-xs text-mist hover:text-ink">
                  <X className="size-3.5" /> Remove from collection
                </button>
              }
            />
          ))}
        </div>
      ) : (
        !picking && <p className="text-sm text-mist">No designs in this collection yet.</p>
      )}
    </>
  );
}
