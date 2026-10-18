'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getRepository } from '@/lib/data';
import { DuplicateShapeNameError } from '@/lib/data/repository';
import { bottomParamsSchema, onePieceParamsSchema, topParamsSchema } from '@/lib/garment/schema';
import type { Shape } from '@/lib/types';

const shapeInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('top'), customName: z.string().trim().min(1).max(60), params: topParamsSchema, notes: z.string().max(500).optional() }),
  z.object({ kind: z.literal('bottom'), customName: z.string().trim().min(1).max(60), params: bottomParamsSchema, notes: z.string().max(500).optional() }),
  z.object({ kind: z.literal('one_piece'), customName: z.string().trim().min(1).max(60), params: onePieceParamsSchema, notes: z.string().max(500).optional() }),
]);

export type ShapeResult = { ok: true; shape: Shape } | { ok: false; error: string };

// "Save as shape" — any top/bottom/one-piece configuration under a custom name (§5.4).
export async function saveShapeAction(input: z.input<typeof shapeInput>): Promise<ShapeResult> {
  const parsed = shapeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Those measurements are outside what we can make.' };
  const { kind, customName, params, notes } = parsed.data;
  try {
    const shape = await (await getRepository()).createShape({
      kind,
      custom_name: customName,
      base_template: params.template,
      params: params as Shape['params'],
      notes: notes ?? null,
    });
    revalidatePath('/shapes');
    revalidatePath('/designs/new');
    return { ok: true, shape };
  } catch (e) {
    if (e instanceof DuplicateShapeNameError) return { ok: false, error: e.message };
    throw e;
  }
}

const shapePatch = z.object({
  customName: z.string().trim().min(1).max(60).optional(),
  isFavourite: z.boolean().optional(),
});

export async function updateShapeAction(id: string, patch: z.input<typeof shapePatch>): Promise<{ ok: boolean; error?: string }> {
  const { customName, isFavourite } = shapePatch.parse(patch);
  try {
    await (await getRepository()).updateShape(z.string().max(80).parse(id), {
      ...(customName !== undefined && { custom_name: customName }),
      ...(isFavourite !== undefined && { is_favourite: isFavourite }),
    });
  } catch (e) {
    if (e instanceof DuplicateShapeNameError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath('/shapes');
  revalidatePath('/designs/new');
  return { ok: true };
}
