'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getRepository } from '@/lib/data';
import { newCanvas } from '@/lib/garment/defaults';
import { describeChanges } from '@/lib/garment/diff';
import { renderGarmentSvg } from '@/lib/garment/render';
import { parseCanvas } from '@/lib/garment/schema';
import type { BottomParams, CanvasState, TopParams } from '@/lib/garment/types';
import { DESIGN_STATUSES } from '@/lib/types';

const newDesignInput = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(['bikini', 'one_piece', 'monokini', 'tankini', 'cover_up']),
  topShapeId: z.string().max(80).optional(),
  bottomShapeId: z.string().max(80).optional(),
});

export async function createDesignAction(input: z.input<typeof newDesignInput>) {
  const { name, category, topShapeId, bottomShapeId } = newDesignInput.parse(input);
  const repo = await getRepository();
  const shapes = await repo.listShapes();
  const top = category === 'bikini' || category === 'tankini' ? shapes.find((s) => s.id === topShapeId && s.kind === 'top') : undefined;
  const bottom = category === 'bikini' || category === 'tankini' ? shapes.find((s) => s.id === bottomShapeId && s.kind === 'bottom') : undefined;

  const canvas = newCanvas(category, top?.params as TopParams | undefined, bottom?.params as BottomParams | undefined);
  if (canvas.top && top) canvas.top.shapeId = top.id;
  if (canvas.bottom && bottom) canvas.bottom.shapeId = bottom.id;

  const design = await repo.createDesign({
    name,
    category,
    canvas,
    top_shape_id: top?.id ?? null,
    bottom_shape_id: bottom?.id ?? null,
  });
  await repo.saveVersion(design.id, {
    canvas,
    change_summary: [top && `Started from ${top.custom_name}`, bottom && `${bottom.custom_name}`].filter(Boolean).join(' + ') || 'First version.',
    svg_snapshot: renderGarmentSvg(canvas, { idPrefix: 'snap' }),
  });
  await repo.recordShapeUse([top?.id, bottom?.id].filter((x): x is string => Boolean(x)));
  revalidatePath('/designs');
  revalidatePath('/');
  redirect(`/designs/${design.id}`);
}

export interface SavedVersion {
  id: string;
  version_number: number;
  change_summary: string | null;
  created_at: string;
}

// Autosave: every save is a new version (§2). Identical canvases are not re-saved.
export async function saveDesignVersionAction(designId: string, rawCanvas: unknown): Promise<SavedVersion> {
  const canvas: CanvasState = parseCanvas(rawCanvas);
  const repo = await getRepository();
  const detail = await repo.getDesign(z.string().max(80).parse(designId));
  if (!detail) throw new Error('Design not found');
  const current = detail.versions.find((v) => v.id === detail.design.current_version_id) ?? detail.versions[0] ?? null;
  if (current && JSON.stringify(current.canvas) === JSON.stringify(canvas)) {
    return { id: current.id, version_number: current.version_number, change_summary: current.change_summary, created_at: current.created_at };
  }
  const version = await repo.saveVersion(designId, {
    canvas,
    change_summary: describeChanges(
      current?.canvas ?? null,
      canvas,
      Object.fromEntries((await repo.listColours()).map((c) => [c.id, c.name])),
    ),
    svg_snapshot: renderGarmentSvg(canvas, { idPrefix: 'snap' }),
  });
  const shapePatch = {
    top_shape_id: canvas.top?.shapeId ?? null,
    bottom_shape_id: canvas.bottom?.shapeId ?? null,
  };
  if (shapePatch.top_shape_id !== detail.design.top_shape_id || shapePatch.bottom_shape_id !== detail.design.bottom_shape_id) {
    await repo.updateDesign(designId, shapePatch);
  }
  revalidatePath('/designs');
  return { id: version.id, version_number: version.version_number, change_summary: version.change_summary, created_at: version.created_at };
}

const designPatch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  status: z.enum(DESIGN_STATUSES).optional(),
  collection_id: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});

export async function updateDesignAction(designId: string, patch: z.input<typeof designPatch>) {
  const repo = await getRepository();
  await repo.updateDesign(z.string().max(80).parse(designId), designPatch.parse(patch));
  revalidatePath('/designs');
  revalidatePath('/collections', 'layout');
  revalidatePath('/');
}

const idSchema = z.string().min(1).max(80);

export async function getVersionAction(designId: string, versionId: string) {
  const version = await (await getRepository()).getVersion(idSchema.parse(designId), idSchema.parse(versionId));
  if (!version) throw new Error('Version not found');
  return { id: version.id, version_number: version.version_number, change_summary: version.change_summary, canvas: version.canvas };
}

// Restoring never rewrites history: the old canvas is saved again as the newest version.
export async function restoreVersionAction(designId: string, versionId: string): Promise<{ version: SavedVersion; canvas: CanvasState }> {
  const repo = await getRepository();
  const old = await repo.getVersion(idSchema.parse(designId), idSchema.parse(versionId));
  if (!old) throw new Error('Version not found');
  const version = await repo.saveVersion(designId, {
    canvas: old.canvas,
    change_summary: `Restored v${old.version_number}.`,
    svg_snapshot: renderGarmentSvg(old.canvas, { idPrefix: 'snap' }),
  });
  revalidatePath('/designs');
  return {
    version: { id: version.id, version_number: version.version_number, change_summary: version.change_summary, created_at: version.created_at },
    canvas: old.canvas,
  };
}

// Duplicate-as-new, or branch from any version (§11). The new design starts its own history.
export async function duplicateDesignAction(designId: string, versionId?: string): Promise<{ id: string }> {
  const repo = await getRepository();
  const detail = await repo.getDesign(idSchema.parse(designId));
  if (!detail) throw new Error('Design not found');
  const source = versionId
    ? detail.versions.find((v) => v.id === versionId)
    : (detail.versions.find((v) => v.id === detail.design.current_version_id) ?? detail.versions[0]);
  if (!source) throw new Error('Version not found');
  const { design } = detail;
  const copy = await repo.createDesign({
    name: `${design.name} — ${versionId ? `branch from v${source.version_number}` : 'copy'}`.slice(0, 120),
    category: design.category ?? source.canvas.category,
    canvas: source.canvas,
    top_shape_id: design.top_shape_id,
    bottom_shape_id: design.bottom_shape_id,
    collection_id: design.collection_id,
  });
  await repo.saveVersion(copy.id, {
    canvas: source.canvas,
    change_summary: `${versionId ? 'Branched' : 'Duplicated'} from ${design.name} v${source.version_number}.`,
    svg_snapshot: renderGarmentSvg(source.canvas, { idPrefix: 'snap' }),
  });
  if (design.tags.length) await repo.updateDesign(copy.id, { tags: design.tags });
  revalidatePath('/designs');
  revalidatePath('/');
  return { id: copy.id };
}
