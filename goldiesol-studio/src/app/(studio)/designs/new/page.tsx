import Link from 'next/link';
import { GarmentGlyph } from '@/components/brand/garment-glyph';
import { ComingInPhase } from '@/components/brand/coming-soon';
import { PageHeader, SectionTitle } from '@/components/brand/page-header';
import { getRepository } from '@/lib/data';

export const metadata = { title: 'New design' };

export default async function NewDesign() {
  const repo = await getRepository();
  const [tops, bottoms] = await Promise.all([repo.listShapes('top'), repo.listShapes('bottom')]);

  return (
    <>
      <PageHeader eyebrow="New design" title="Which top and bottom are we building today?" />
      {[['Tops', tops], ['Bottoms', bottoms]].map(([label, list]) => (
        <section key={label as string} className="mb-10">
          <SectionTitle>{label as string}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(list as typeof tops).map((s) => (
              <Link
                key={s.id}
                href="/shapes"
                className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center hover:border-champagne"
              >
                <GarmentGlyph kind={s.kind} template={s.base_template} />
                <span className="font-display text-lg leading-tight">{s.custom_name}</span>
                {s.is_favourite && <span className="gs-label text-gold-deep">Favourite</span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
      <ComingInPhase phase={4} title="The Design Brief interview">
        Your Design Partner will ask a few questions — who she is, where she&rsquo;s wearing it, the feeling, the
        signature detail — then sketch two or three directions to choose from. The editor itself opens in phase 2.
      </ComingInPhase>
    </>
  );
}
