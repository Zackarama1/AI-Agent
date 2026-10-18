import { Plus } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/brand/empty-state';
import { PageHeader } from '@/components/brand/page-header';
import { DesignCard } from '@/components/designs/design-card';
import { Button } from '@/components/ui/button';
import { getRepository } from '@/lib/data';

export const metadata = { title: 'Designs' };
export const dynamic = 'force-dynamic';

export default async function DesignLibrary() {
  const repo = await getRepository();
  const designs = await repo.listDesigns();

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Designs"
        description="Every Goldiesol piece, with its full version history. Nothing is ever deleted — only archived."
        action={
          <Button asChild variant="primary">
            <Link href="/designs/new"><Plus /> New design</Link>
          </Button>
        }
      />
      {designs.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => <DesignCard key={d.id} design={d}/>)}
        </div>
      ) : (
        <EmptyState title="Your first Goldiesol piece starts here." />
      )}
    </>
  );
}
