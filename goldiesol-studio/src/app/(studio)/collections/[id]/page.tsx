import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/brand/page-header';
import { CollectionDesigns, CollectionHeaderActions } from '@/components/collections/collection-manager';
import { getRepository } from '@/lib/data';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return { title: (await (await getRepository()).getCollection(id))?.name ?? 'Collection' };
}

export default async function CollectionPage({ params }: Params) {
  const { id } = await params;
  const repo = await getRepository();
  const [collection, designs] = await Promise.all([repo.getCollection(id), repo.listDesigns()]);
  if (!collection) notFound();
  const active = designs.filter((d) => d.status !== 'archived');

  return (
    <>
      <PageHeader
        eyebrow={collection.season ?? 'Collection'}
        title={collection.name}
        description={collection.archived ? `${collection.description ?? ''} (Archived)` : collection.description ?? undefined}
        action={<CollectionHeaderActions collection={collection} />}
      />
      <CollectionDesigns
        collectionId={collection.id}
        inCollection={designs.filter((d) => d.collection_id === collection.id)}
        others={active.filter((d) => d.collection_id !== collection.id)}
      />
    </>
  );
}
