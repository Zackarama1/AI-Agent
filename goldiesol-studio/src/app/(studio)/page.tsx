import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/brand/empty-state';
import { PageHeader, SectionTitle } from '@/components/brand/page-header';
import { DesignCard } from '@/components/designs/design-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRepository } from '@/lib/data';
import { humanise } from '@/lib/utils';

export default async function StudioHome() {
  const repo = await getRepository();
  const [designs, shapes, notes, suppliers] = await Promise.all([
    repo.listDesigns(),
    repo.listShapes(),
    repo.listOpenNotes(),
    repo.listSuppliers(),
  ]);
  const active = designs.filter((d) => d.status !== 'archived').slice(0, 6);
  const awaitingReply = suppliers.filter((s) => s.stage === 'contacted');

  return (
    <>
      <PageHeader
        eyebrow="Goldiesol Studio"
        title="Welcome back to the atelier"
        description="Feminine, delicate, intricate — every piece starts here."
        action={
          <Button asChild variant="primary" size="lg">
            <Link href="/designs/new"><Plus /> New design</Link>
          </Button>
        }
      />

      <section className="mb-12">
        <SectionTitle aside={<Link href="/designs" className="text-sm text-mist hover:text-ink">All designs <ArrowRight className="inline size-3.5" /></Link>}>
          Continue designing
        </SectionTitle>
        {active.length ? (
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {active.map((d) => (
              <div key={d.id} className="w-64 shrink-0 snap-start sm:w-auto">
                <DesignCard design={d} shapes={shapes} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Your first Goldiesol piece starts here.">
            Tell the Design Partner what you&rsquo;re dreaming of and we&rsquo;ll sketch it together.
          </EmptyState>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <p className="gs-label">Trend pulse</p>
            <CardTitle>What&rsquo;s rising</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-mist">
            No trend data connected yet. Trend signals arrive with Insights — we never show numbers we can&rsquo;t source.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="gs-label">Open notes</p>
            <CardTitle>Change requests</CardTitle>
          </CardHeader>
          <CardContent>
            {notes.length ? (
              <ul className="flex flex-col gap-3 text-sm">
                {notes.slice(0, 4).map((n) => (
                  <li key={n.id}>
                    <Link href={`/designs/${n.design_id}`} className="hover:text-gold-deep">
                      <span className="gs-label block">{n.design_name} · {humanise(n.type)}</span>
                      <span className="line-clamp-2">{n.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mist">Nothing waiting on you.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="gs-label">Suppliers</p>
            <CardTitle>Awaiting reply</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-mist">
            {awaitingReply.length ? (
              <ul className="flex flex-col gap-2 text-ink">
                {awaitingReply.map((s) => (
                  <li key={s.id}><Link href={`/suppliers/${s.id}`} className="hover:text-gold-deep">{s.name}</Link></li>
                ))}
              </ul>
            ) : (
              <>
                No outreach in flight. {suppliers.length} suppliers are in{' '}
                <Link href="/suppliers" className="text-ink underline decoration-champagne underline-offset-4">research</Link>.
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="gs-label">Tech packs</p>
            <CardTitle>Recently sent</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-mist">No tech packs yet — they&rsquo;re generated from any design.</CardContent>
        </Card>
      </div>
    </>
  );
}
