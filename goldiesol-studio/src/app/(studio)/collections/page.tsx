import { EmptyState } from '@/components/brand/empty-state';
import { LaceWatermark } from '@/components/brand/lace';
import { PageHeader } from '@/components/brand/page-header';
import { Card } from '@/components/ui/card';
import { getRepository } from '@/lib/data';

export const metadata = { title: 'Collections' };
export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const collections = await (await getRepository()).listCollections();
  return (
    <>
      <PageHeader eyebrow="Library" title="Collections" description="Group designs into drops and seasons." />
      {collections.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="relative flex h-36 items-end bg-gradient-to-br from-blush via-rose/40 to-champagne/40 p-5">
                <LaceWatermark />
                <p className="gs-label relative text-gold-deep">{c.season}</p>
              </div>
              <div className="p-5">
                <h3 className="font-display text-2xl">{c.name}</h3>
                <p className="mt-1 text-sm text-mist">{c.description}</p>
                <p className="gs-label mt-4">{c.design_count} {c.design_count === 1 ? 'design' : 'designs'}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Your first collection starts here." />
      )}
    </>
  );
}
