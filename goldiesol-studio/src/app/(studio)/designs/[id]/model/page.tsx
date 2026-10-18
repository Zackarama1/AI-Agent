import { notFound } from 'next/navigation';
import { ComingInPhase } from '@/components/brand/coming-soon';
import { PageHeader } from '@/components/brand/page-header';
import { getRepository } from '@/lib/data';

export default async function ModelModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await (await getRepository()).getDesign(id);
  if (!detail) notFound();
  return (
    <>
      <PageHeader eyebrow={detail.design.name} title="Model Mode" />
      <ComingInPhase phase={6} title="See it across every size">
        Parametric avatars from the size chart, XS to XL, with the design graded and overlaid — side by side.
      </ComingInPhase>
    </>
  );
}
