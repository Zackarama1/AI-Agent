import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/brand/page-header';
import { Library } from '@/components/designs/library';
import { Button } from '@/components/ui/button';
import { getRepository } from '@/lib/data';

export const metadata = { title: 'Designs' };
export const dynamic = 'force-dynamic';

export default async function DesignLibrary() {
  const repo = await getRepository();
  const [designs, collections, shapes, colours] = await Promise.all([
    repo.listDesigns(),
    repo.listCollections(),
    repo.listShapes(),
    repo.listColours(),
  ]);

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
      <Library
        designs={designs}
        collections={collections.filter((c) => !c.archived).map(({ id, name }) => ({ id, name }))}
        shapes={shapes.map(({ id, custom_name, kind }) => ({ id, custom_name, kind }))}
        colours={colours.map(({ id, name, hex, palette }) => ({ id, name, hex, palette }))}
      />
    </>
  );
}
