'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getRepository } from '@/lib/data';
import type { DesignNote } from '@/lib/types';

const id = z.string().min(1).max(80);

const noteInput = z.object({
  designId: id,
  // ai_feedback is written by the AI Partner (phase 4), never typed by hand.
  type: z.enum(['note', 'feedback', 'change_request', 'supplier_feedback']),
  body: z.string().trim().min(1).max(4000),
  anchor: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      view: z.enum(['front', 'back', 'side']),
      part: z.enum(['top', 'bottom', 'one_piece']).optional(),
    })
    .nullable()
    .optional(),
});

export async function addNoteAction(input: z.input<typeof noteInput>): Promise<DesignNote> {
  const { designId, type, body, anchor } = noteInput.parse(input);
  const repo = await getRepository();
  const detail = await repo.getDesign(designId);
  if (!detail) throw new Error('Design not found');
  const note = await repo.addNote({
    design_id: designId,
    version_id: detail.design.current_version_id,
    type,
    body,
    anchor: anchor ?? null,
  });
  revalidatePath('/');
  return note;
}

export async function setNoteResolvedAction(noteId: string, resolved: boolean): Promise<DesignNote> {
  const note = await (await getRepository()).updateNote(id.parse(noteId), { resolved: z.boolean().parse(resolved) });
  revalidatePath('/');
  return note;
}
