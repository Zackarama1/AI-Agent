import Link from 'next/link';
import { PageHeader, SectionTitle } from '@/components/brand/page-header';
import { VerifiedBadge } from '@/components/brand/unverified';
import { Badge } from '@/components/ui/badge';
import { getRepository } from '@/lib/data';
import type { Supplier } from '@/lib/types';
import { humanise } from '@/lib/utils';

export const metadata = { title: 'Suppliers' };

const moq = (s: Supplier) =>
  s.moq_per_style ? `MOQ ${s.moq_per_style}/style` : s.moq_per_order ? `MOQ ${s.moq_per_order}/order` : 'MOQ — ask';

function SupplierRow({ s }: { s: Supplier }) {
  return (
    <li>
      <Link href={`/suppliers/${s.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-blush sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">{s.name}</p>
          <p className="text-xs text-mist">
            {[s.city, s.country].filter(Boolean).join(', ') || 'Online'}
            {s.kind === 'factory' && ` · ${moq(s)}`}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {s.specialties.slice(0, 4).map((sp) => <Badge key={sp} variant="muted">{humanise(sp)}</Badge>)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge>{humanise(s.stage)}</Badge>
          <VerifiedBadge verified={s.verified} />
        </div>
      </Link>
    </li>
  );
}

export default async function SuppliersPage() {
  const suppliers = await (await getRepository()).listSuppliers();
  const factories = suppliers.filter((s) => s.kind === 'factory');
  const platforms = suppliers.filter((s) => s.kind === 'platform');

  return (
    <>
      <PageHeader
        eyebrow="Sourcing"
        title="Suppliers"
        description="Factories, embellishment partners and sourcing platforms. Seeded terms come from public listings — confirm every one directly before relying on it."
      />
      {[['Factories & ateliers', factories], ['Sourcing platforms', platforms]].map(([title, list]) => (
        <section key={title as string} className="mb-10">
          <SectionTitle>{title as string}</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-gs)] border border-line bg-surface">
            {(list as Supplier[]).map((s) => <SupplierRow key={s.id} s={s} />)}
          </ul>
        </section>
      ))}
      <p className="text-xs text-mist">Map view, pipeline board and outreach builder arrive in build phase 8.</p>
    </>
  );
}
