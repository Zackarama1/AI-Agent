import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Editor } from '@/components/editor/editor';
import { getRepository } from '@/lib/data';
import { newCanvas } from '@/lib/garment/defaults';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const detail = await (await getRepository()).getDesign(id);
  return { title: detail?.design.name ?? 'Design' };
}

export default async function DesignEditorPage({ params }: Params) {
  const { id } = await params;
  const repo = await getRepository();
  const [detail, shapes, colours, materials, collections] = await Promise.all([
    repo.getDesign(id),
    repo.listShapes(),
    repo.listColours(),
    repo.listMaterials(),
    repo.listCollections(),
  ]);
  if (!detail) notFound();
  const { design, versions, notes } = detail;
  const current = versions.find((v) => v.id === design.current_version_id) ?? versions[0];

  // The editor's store is created once from these props, so a re-render after
  // autosave (server actions refresh the route) never resets work in progress.
  return (
    <Editor
      design={design}
      canvas={current?.canvas ?? newCanvas(design.category ?? 'bikini')}
      versions={versions.map(({ id, version_number, change_summary, created_at }) => ({ id, version_number, change_summary, created_at }))}
      notes={notes}
      collections={collections.filter((c) => !c.archived || c.id === design.collection_id).map(({ id, name }) => ({ id, name }))}
      library={{ shapes, colours, materials, colourHex: Object.fromEntries(colours.map((c) => [c.id, c.hex])) }}
    />
  );
}
