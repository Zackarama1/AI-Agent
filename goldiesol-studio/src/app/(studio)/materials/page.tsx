import { PageHeader, SectionTitle } from '@/components/brand/page-header';
import { Badge } from '@/components/ui/badge';
import { getRepository } from '@/lib/data';
import { MATERIAL_TYPES, type MaterialType } from '@/lib/types';

export const metadata = { title: 'Materials' };

const LABELS: Record<MaterialType, string> = {
  main_fabric: 'Fabrics',
  lining: 'Linings',
  mesh: 'Mesh',
  lace: 'Laces',
  trim: 'Trims',
  elastic: 'Elastics',
  hardware: 'Hardware',
  bead: 'Beading',
  thread: 'Thread',
  padding: 'Padding',
  label: 'Labels',
};

export default async function MaterialsPage() {
  const materials = await (await getRepository()).listMaterials();
  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Materials"
        description="Fabrics, laces, trims, hardware and beading. Weights are typical ranges — confirm with each mill; prices fill in as quotes arrive."
      />
      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Material types">
        {MATERIAL_TYPES.filter((t) => materials.some((m) => m.type === t)).map((t) => (
          <a key={t} href={`#${t}`} className="rounded-full border border-line px-3 py-1 text-xs text-mist hover:border-champagne hover:text-ink">
            {LABELS[t]}
          </a>
        ))}
      </nav>
      {MATERIAL_TYPES.map((type) => {
        const list = materials.filter((m) => m.type === type);
        if (!list.length) return null;
        return (
          <section key={type} id={type} className="mb-10 scroll-mt-20">
            <SectionTitle>{LABELS[type]}</SectionTitle>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-gs)] border border-line bg-surface">
              {list.map((m) => (
                <li key={m.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <p className="font-medium">{m.name}</p>
                    {m.composition && <p className="text-xs text-mist">{m.composition}</p>}
                    {m.notes && <p className="mt-1 text-xs text-mist">{m.notes}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                    {m.weight_gsm && <Badge variant="muted">{m.weight_gsm} gsm</Badge>}
                    {m.chlorine_resistant && <Badge variant="gold">Chlorine resistant</Badge>}
                    {m.uv_rating && <Badge variant="muted">{m.uv_rating}</Badge>}
                    {m.colourways.map((c) => <Badge key={c} variant="muted">{c.replace(/_/g, ' ')}</Badge>)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
