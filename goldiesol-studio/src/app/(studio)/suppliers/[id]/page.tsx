import { ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/brand/page-header';
import { VerifiedBadge } from '@/components/brand/unverified';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRepository } from '@/lib/data';
import { humanise } from '@/lib/utils';

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await (await getRepository()).getSupplier(id);
  if (!found) notFound();
  const { supplier: s, contacts } = found;

  const terms: [string, string | number | null][] = [
    ['MOQ per style', s.moq_per_style],
    ['MOQ per order', s.moq_per_order],
    ['Sample MOQ', s.sample_moq],
    ['Sample lead time', s.sample_lead_days && `${s.sample_lead_days} days`],
    ['Bulk lead time', s.bulk_lead_days && `${s.bulk_lead_days} days`],
    ['Price tier', s.price_tier],
  ];

  return (
    <>
      <PageHeader
        eyebrow={s.kind === 'platform' ? 'Sourcing platform' : [s.city, s.country].filter(Boolean).join(', ') || 'Supplier'}
        title={s.name}
        description={
          <span className="flex flex-wrap gap-2">
            <Badge>{humanise(s.stage)}</Badge>
            <VerifiedBadge verified={s.verified} />
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {s.notes && <p>{s.notes}</p>}
            {s.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{s.specialties.map((sp) => <Badge key={sp} variant="muted">{humanise(sp)}</Badge>)}</div>
            )}
            {s.certifications.length > 0 && (
              <p><span className="gs-label mr-2">Certifications</span>{s.certifications.join(' · ')}</p>
            )}
            {(s.website || s.source_url) && (
              <p className="flex flex-wrap gap-4">
                {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-champagne underline-offset-4">Website <ExternalLink className="size-3" /></a>}
                {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-mist underline decoration-line underline-offset-4">Source of terms <ExternalLink className="size-3" /></a>}
              </p>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          {s.kind === 'factory' && (
            <Card>
              <CardHeader><CardTitle>Published terms</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                  {terms.map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-mist">{label}</dt>
                      <dd className="text-right">{value ?? 'Ask'}</dd>
                    </div>
                  ))}
                </dl>
                {!s.verified && <p className="mt-4 text-xs text-mist">Not yet confirmed with the supplier.</p>}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {contacts.length ? (
                <ul className="flex flex-col gap-2">
                  {contacts.map((c) => (
                    <li key={c.id}><span className="font-medium">{c.name}</span>{c.role && <span className="text-mist"> · {c.role}</span>}{c.email && <span className="block text-xs text-mist">{c.email}</span>}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-mist">No contacts yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
