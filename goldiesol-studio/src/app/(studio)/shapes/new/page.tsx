import { PageHeader } from '@/components/brand/page-header';
import { ShapeEditor } from '@/components/shapes/shape-editor';

export const metadata = { title: 'New shape' };

export default function NewShapePage() {
  return (
    <>
      <PageHeader eyebrow="Shape Library" title="Create a new shape" description="Start from a base silhouette, tune the measurements, and give it a name you'll remember." />
      <ShapeEditor />
    </>
  );
}
