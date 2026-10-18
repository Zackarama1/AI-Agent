import { notFound } from 'next/navigation';
import { ComingInPhase } from '@/components/brand/coming-soon';
import { PageHeader } from '@/components/brand/page-header';
import { getRepository } from '@/lib/data';

export default async function TechPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await (await getRepository()).getDesign(id);
  if (!detail) notFound();
  return (
    <>
      <PageHeader eyebrow={detail.design.name} title="Tech Pack" />
      <ComingInPhase phase={7} title="A tech pack any factory can follow">
        Flat sketches, bill of materials, graded points of measure, construction and embellishment specs — exported as
        PDF and XLSX.
      </ComingInPhase>
    </>
  );
}
