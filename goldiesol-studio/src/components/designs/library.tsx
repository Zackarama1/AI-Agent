'use client';

import { Columns3, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { updateDesignAction } from '@/app/actions/designs';
import { EmptyState } from '@/components/brand/empty-state';
import { StatusPill } from '@/components/brand/status-pill';
import { Button } from '@/components/ui/button';
import type { DesignSummary } from '@/lib/data';
import { EMBELLISHMENT_TYPES } from '@/lib/garment/types';
import { EMPTY_FILTERS, filterDesigns, MAX_COMPARE, type LibraryFilters } from '@/lib/library';
import { DESIGN_STATUSES, type DesignStatus } from '@/lib/types';
import { cn, formatDate, humanise } from '@/lib/utils';
import { DesignActions } from './design-actions';
import { DesignCard, DesignThumb } from './design-card';

type View = 'grid' | 'list' | 'board';
const VIEW_KEY = 'gs-library-view';

interface Props {
  designs: DesignSummary[];
  collections: { id: string; name: string }[];
  shapes: { id: string; custom_name: string; kind: string }[];
  colours: { id: string; name: string; hex: string; palette: string }[];
}

function FilterSelect({ label, value, onChange, children, disabled }: { label: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="gs-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn('h-9 rounded-xl disabled:opacity-50 border bg-surface px-2.5 text-sm', value ? 'border-champagne' : 'border-line')}
      >
        {children}
      </select>
    </label>
  );
}

function CompareToggle({ checked, disabled, onChange, name }: { checked: boolean; disabled: boolean; onChange: () => void; name: string }) {
  return (
    <label className={cn('flex items-center gap-1.5 text-xs text-mist', disabled && !checked && 'opacity-40')}>
      <input type="checkbox" checked={checked} disabled={disabled && !checked} onChange={onChange} aria-label={`Compare ${name}`} className="accent-[var(--gs-gold-deep)]" />
      Compare
    </label>
  );
}

function BoardStatus({ id, status }: { id: string; status: DesignStatus }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <select
      aria-label="Move to status"
      value={status}
      onChange={(e) => start(async () => {
        await updateDesignAction(id, { status: e.target.value as DesignStatus });
        router.refresh();
      })}
      className="h-7 w-full rounded-lg border border-line bg-surface px-1.5 text-xs"
    >
      {DESIGN_STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
    </select>
  );
}

export function Library({ designs, collections, shapes, colours }: Props) {
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [view, setView] = useState<View>('grid');
  const [compare, setCompare] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false); // phones only; always shown from sm up

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'grid' || v === 'list' || v === 'board') setView(v);
    } catch {
      // per-viewer convenience only
    }
  }, []);
  const chooseView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore
    }
  };

  const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const visible = useMemo(() => filterDesigns(designs, filters, colours), [designs, filters, colours]);
  const active = Object.entries(filters).filter(([k, v]) => v && v !== EMPTY_FILTERS[k as keyof LibraryFilters]).length;
  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < MAX_COMPARE ? [...c, id] : c));

  const actions = (d: DesignSummary) => (
    <div className="flex items-center justify-between">
      <CompareToggle name={d.name} checked={compare.includes(d.id)} disabled={compare.length >= MAX_COMPARE} onChange={() => toggleCompare(d.id)} />
      <DesignActions id={d.id} name={d.name} status={d.status} collectionId={d.collection_id} collections={collections} />
    </div>
  );

  const palettes = [...new Set(colours.map((c) => c.palette))];
  const boardStatuses = filters.status ? [filters.status as DesignStatus] : DESIGN_STATUSES.filter((s) => s !== 'archived');

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-gs)] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search designs</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist" />
            <input
              value={filters.q}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Search names and tags"
              className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm"
            />
          </label>
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm sm:hidden"
          >
            <SlidersHorizontal className="size-4" /> Filters{active > 0 && ` (${active})`}
          </button>
          <div role="radiogroup" aria-label="View" className="inline-flex rounded-full border border-line p-0.5">
            {([['grid', LayoutGrid, 'Grid'], ['list', List, 'List'], ['board', Columns3, 'Board']] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                aria-label={`${label} view`}
                onClick={() => chooseView(v)}
                className={cn('rounded-full px-3 py-1.5', view === v ? 'bg-ink text-ivory' : 'text-mist hover:text-ink')}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
        <div className={cn('grid-cols-2 gap-3 sm:grid sm:grid-cols-4 lg:grid-cols-8', filtersOpen ? 'grid' : 'hidden')}>
          <FilterSelect label="Category" value={filters.category} onChange={(v) => set('category', v)}>
            <option value="">All</option>
            {['bikini', 'one_piece', 'monokini', 'tankini', 'cover_up'].map((c) => <option key={c} value={c}>{humanise(c)}</option>)}
          </FilterSelect>
          <FilterSelect label="Status" value={filters.status} onChange={(v) => set('status', v)}>
            <option value="">Active</option>
            {DESIGN_STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
          </FilterSelect>
          <FilterSelect label="Collection" value={filters.collectionId} onChange={(v) => set('collectionId', v)}>
            <option value="">All</option>
            <option value="none">No collection</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Colour" value={filters.colourId} onChange={(v) => set('colourId', v)}>
            <option value="">Any</option>
            {palettes.map((p) => (
              <optgroup key={p} label={p}>
                {colours.filter((c) => c.palette === p).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </FilterSelect>
          <FilterSelect label="Detail" value={filters.detail} onChange={(v) => set('detail', v as LibraryFilters['detail'])}>
            <option value="">Any</option>
            {EMBELLISHMENT_TYPES.map((t) => <option key={t} value={t}>{humanise(t)}</option>)}
          </FilterSelect>
          <FilterSelect label="Shape" value={filters.shapeId} onChange={(v) => set('shapeId', v)}>
            <option value="">Any</option>
            {shapes.map((s) => <option key={s.id} value={s.id}>{s.custom_name}</option>)}
          </FilterSelect>
          <FilterSelect label="Supplier" value="" onChange={() => undefined} disabled>
            <option value="">Links in phase 8</option>
          </FilterSelect>
          <FilterSelect label="Edited" value={filters.editedWithinDays} onChange={(v) => set('editedWithinDays', Number(v))}>
            <option value={0}>Any time</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </FilterSelect>
        </div>
        <div className="flex items-center justify-between text-xs text-mist">
          <span role="status">{visible.length} {visible.length === 1 ? 'design' : 'designs'}</span>
          {active > 0 && (
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="flex items-center gap-1 hover:text-ink">
              <X className="size-3.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={designs.length ? 'Nothing matches those filters' : 'Your first Goldiesol piece starts here.'}>
          {designs.length ? 'Try clearing a filter or two.' : null}
        </EmptyState>
      ) : view === 'grid' ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((d) => <DesignCard key={d.id} design={d} selected={compare.includes(d.id)} footer={actions(d)} />)}
        </div>
      ) : view === 'list' ? (
        <div className="overflow-x-auto rounded-[var(--radius-gs)] border border-line bg-surface">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {['', 'Design', 'Status', 'Collection', 'Versions', 'Edited', ''].map((h, i) => <th key={i} className="gs-label px-3 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr key={d.id} className={cn('border-b border-line last:border-0', compare.includes(d.id) && 'bg-blush')}>
                  <td className="w-20 px-3 py-2"><DesignThumb design={d} className="size-14 overflow-hidden rounded-lg" /></td>
                  <td className="px-3 py-2">
                    <Link href={`/designs/${d.id}`} className="font-display text-lg hover:text-gold-deep">{d.name}</Link>
                    <span className="block text-xs text-mist">{d.category && humanise(d.category)}</span>
                  </td>
                  <td className="px-3 py-2"><StatusPill status={d.status} /></td>
                  <td className="px-3 py-2 text-mist">{d.collection_name ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">v{d.version_count}</td>
                  <td className="px-3 py-2 text-mist">{formatDate(d.updated_at)}</td>
                  <td className="px-3 py-2"><div className="w-44">{actions(d)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {boardStatuses.map((status) => {
            const column = visible.filter((d) => d.status === status);
            return (
              <section key={status} className="flex w-60 shrink-0 flex-col gap-3 rounded-[var(--radius-gs)] bg-blush/70 p-3" aria-label={humanise(status)}>
                <h3 className="gs-label flex justify-between">{humanise(status)} <span>{column.length}</span></h3>
                {column.map((d) => (
                  <div key={d.id} className="rounded-xl border border-line bg-surface p-2.5">
                    <Link href={`/designs/${d.id}`} className="block">
                      <DesignThumb design={d} className="mb-2 aspect-[4/3] overflow-hidden rounded-lg" />
                      <span className="font-display text-base leading-tight hover:text-gold-deep">{d.name}</span>
                    </Link>
                    <div className="mt-2"><BoardStatus id={d.id} status={d.status} /></div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {compare.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-[min(560px,calc(100%-2rem))] items-center justify-between gap-3 rounded-full border border-line bg-surface px-4 py-2 shadow-soft" role="region" aria-label="Compare">
          <span className="text-sm">{compare.length} of {MAX_COMPARE} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCompare([])}>Clear</Button>
            <Button asChild variant="primary" size="sm" className={cn(compare.length < 2 && 'pointer-events-none opacity-40')}>
              <Link href={`/designs/compare?ids=${compare.join(',')}`} aria-disabled={compare.length < 2}>Compare side by side</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
