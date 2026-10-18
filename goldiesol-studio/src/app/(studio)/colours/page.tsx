import { PageHeader, SectionTitle } from '@/components/brand/page-header';
import { getRepository } from '@/lib/data';
import type { Colour } from '@/lib/types';

export const metadata = { title: 'Colours' };

export default async function ColoursPage() {
  const colours = await (await getRepository()).listColours();
  const palettes = colours.reduce<Map<string, Colour[]>>((acc, c) => {
    acc.set(c.palette, [...(acc.get(c.palette) ?? []), c]);
    return acc;
  }, new Map());

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Colours"
        description={
          <>
            Goldiesol palettes. Pantone references are added by the team from a licensed Pantone source — we never
            guess them. Physical lab dips must always be approved.
          </>
        }
      />
      {[...palettes].map(([palette, list]) => (
        <section key={palette} className="mb-10">
          <SectionTitle>{palette}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {list.map((c) => (
              <figure key={c.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="aspect-[4/3] border-b border-line" style={{ background: c.hex }} />
                <figcaption className="p-3">
                  <p className="text-sm font-medium leading-tight">{c.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] uppercase text-mist">{c.hex}</p>
                  <p className="mt-0.5 text-[11px] text-mist">
                    {c.pantone_code ? `Pantone ${c.pantone_code} ${c.pantone_system ?? ''}` : 'Pantone — not set'}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
