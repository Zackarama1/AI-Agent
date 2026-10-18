'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getRepository } from '@/lib/data';

const id = z.string().min(1).max(80);
const fields = z.object({
  name: z.string().trim().min(1).max(80),
  season: z.string().trim().max(40).optional().transform((v) => v || null),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
});

export async function createCollectionAction(input: z.input<typeof fields>): Promise<{ id: string }> {
  const c = await (await getRepository()).createCollection(fields.parse(input));
  revalidatePath('/collections');
  return { id: c.id };
}

export async function updateCollectionAction(collectionId: string, input: z.input<typeof fields> & { archived?: boolean }) {
  const { archived, ...rest } = input;
  await (await getRepository()).updateCollection(id.parse(collectionId), {
    ...fields.parse(rest),
    ...(archived !== undefined && { archived: z.boolean().parse(archived) }),
  });
  revalidatePath('/collections', 'layout');
}

export async function setCollectionArchivedAction(collectionId: string, archived: boolean) {
  await (await getRepository()).updateCollection(id.parse(collectionId), { archived: z.boolean().parse(archived) });
  revalidatePath('/collections', 'layout');
}

// Add or remove designs from a collection.
export async function assignDesignsAction(collectionId: string | null, designIds: string[]) {
  const repo = await getRepository();
  const target = collectionId === null ? null : id.parse(collectionId);
  for (const designId of z.array(id).max(200).parse(designIds)) await repo.updateDesign(designId, { collection_id: target });
  revalidatePath('/collections', 'layout');
  revalidatePath('/designs');
}
