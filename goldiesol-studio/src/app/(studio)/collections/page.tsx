import Link from 'next/link';
import { NewCollection } from '@/components/collections/collection-form';
import { EmptyState } from '@/components/brand/empty-state';
import { LaceWatermark } from '@/components/brand/lace';
import { PageHeader, SectionTitle } from '@/components/brand/page-header';
import { Card } from '@/components/ui/card';
import { getRepository, type CollectionSummary } from '@/lib/data';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Collections' };
export const dynamic = 'force-dynamic';

function CollectionCard({ c }: { c: CollectionSummary }) {
  return (
    <Link href={`/collections/${c.id}`} className="group block">
      <Card className={cn('overflow-hidden transition group-hover:-translate-y-0.5 group-hover:border-champagne', c.archived && 'opacity-70')}>
        <div className="relative flex h-36 items-end bg-gradient-to-br from-blush via-rose/40 to-champagne/40 p-5">
          <LaceWatermark />
          <p className="gs-label relative text-gold-deep">{c.season}</p>
        </div>
        <div className="p-5">
          <h3 className="font-display text-2xl group-hover:text-gold-deep">{c.name}</h3>
          {c.description && <p className="mt-1 line-clamp-2 text-sm text-mist">{c.description}</p>}
          <p className="gs-label mt-4">{c.design_count} {c.design_count === 1 ? 'design' : 'designs'}{c.archived ? ' · archived' : ''}</p>
        </div>
      </Card>
    </Link>
  );
}

export default async function CollectionsPage() {
  const collections = await (await getRepository()).listCollections();
  const active = collections.filter((c) => !c.archived);
  const archived = collections.filter((c) => c.archived);
  return (
    <>
      <PageHeader eyebrow="Library" title="Collections" description="Group designs into drops and seasons." action={<NewCollection />} />
      {active.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{active.map((c) => <CollectionCard key={c.id} c={c} />)}</div>
      ) : (
        <EmptyState title="Your first collection starts here." />
      )}
      {archived.length > 0 && (
        <section className="mt-12">
          <SectionTitle>Archived</SectionTitle>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{archived.map((c) => <CollectionCard key={c.id} c={c} />)}</div>
        </section>
      )}
    </>
  );
}
