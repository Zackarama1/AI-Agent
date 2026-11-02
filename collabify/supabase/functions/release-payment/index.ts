// Business approves a delivered project → pay the student 100% of the price.
import { adminClient, HttpError, json, requireUser, serve } from '../_shared/http.ts';
import { releaseContract } from '../_shared/release.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const { contractId } = await req.json();
  const db = adminClient();
  const { data: c } = await db.from('contracts').select('*').eq('id', contractId).single();
  if (!c || c.business_id !== user.id) throw new HttpError(404, 'Contract not found');
  if (c.status !== 'delivered') throw new HttpError(409, 'There’s nothing to approve yet');
  try {
    await releaseContract(db, c);
  } catch (e) {
    throw new HttpError(409, (e as Error).message);
  }
  return json({ ok: true });
});
