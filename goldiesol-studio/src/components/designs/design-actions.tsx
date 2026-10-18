'use client';

import { Archive, ArchiveRestore, Copy, FolderInput, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { duplicateDesignAction, updateDesignAction } from '@/app/actions/designs';
import type { DesignStatus } from '@/lib/types';

// Overflow menu for a design: duplicate, move to collection, archive. Nothing is ever deleted.
export function DesignActions({
  id,
  name,
  status,
  collectionId,
  collections,
}: {
  id: string;
  name: string;
  status: DesignStatus;
  collectionId: string | null;
  collections: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      setOpen(false);
      router.refresh();
    });

  const archived = status === 'archived';
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`More actions for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-1.5 text-mist hover:bg-blush hover:text-ink"
        disabled={pending}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-1.5 text-sm shadow-soft">
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-blush"
            onClick={() =>
              start(async () => {
                const copy = await duplicateDesignAction(id);
                router.push(`/designs/${copy.id}`);
              })
            }
          >
            <Copy className="size-4 text-mist" /> Duplicate as new
          </button>
          <label className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-blush">
            <FolderInput className="size-4 shrink-0 text-mist" />
            <span className="sr-only">Collection</span>
            <select
              value={collectionId ?? ''}
              onChange={(e) => run(() => updateDesignAction(id, { collection_id: e.target.value || null }))}
              className="min-w-0 flex-1 bg-transparent text-sm"
            >
              <option value="">No collection</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-blush"
            onClick={() => run(() => updateDesignAction(id, { status: archived ? 'in_design' : 'archived' }))}
          >
            {archived ? <ArchiveRestore className="size-4 text-mist" /> : <Archive className="size-4 text-mist" />}
            {archived ? 'Restore from archive' : 'Archive'}
          </button>
        </div>
      )}
    </div>
  );
}
