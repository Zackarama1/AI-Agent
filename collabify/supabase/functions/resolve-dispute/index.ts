// Admin settles a reported problem: pay the student, or refund the business in full.
import { adminClient, HttpError, json, requireUser, serve } from '../_shared/http.ts';
import { refundContract, releaseContract } from '../_shared/release.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const db = adminClient();
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new HttpError(403, 'Admins only');

  const { contractId, outcome } = await req.json();
  if (!['release', 'refund'].includes(outcome)) throw new HttpError(400, 'Choose release or refund');
  const { data: c } = await db.from('contracts').select('*').eq('id', contractId).single();
  if (!c) throw new HttpError(404, 'Contract not found');
  if (c.status !== 'disputed') throw new HttpError(409, 'This project isn’t under review');

  try {
    if (outcome === 'release') await releaseContract(db, c, ['disputed']);
    else await refundContract(db, c);
  } catch (e) {
    throw new HttpError(409, (e as Error).message);
  }
  await db.from('messages').insert({
    contract_id: c.id,
    sender_id: user.id,
    body: outcome === 'release' ? 'Collabify reviewed this project and released the payment to the student.' : 'Collabify reviewed this project and refunded the payment in full.',
  });
  return json({ ok: true });
});
