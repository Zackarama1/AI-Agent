// Delete the caller's account (App Store requirement).
// Blocked while money is held; otherwise cancels any subscription, anonymises the profile
// (completed contracts and reviews stay for the other party and financial records) and deletes the login.
import { adminClient, HttpError, json, requireUser, serve } from '../_shared/http.ts';
import { stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const db = adminClient();

  const { data: blocker } = await db.rpc('account_deletion_blocker', { p_user_id: user.id });
  if (blocker) throw new HttpError(409, blocker as string);

  const { data: business } = await db.from('businesses').select('stripe_subscription_id').eq('id', user.id).maybeSingle();
  if (business?.stripe_subscription_id) {
    await stripe('DELETE', `/subscriptions/${business.stripe_subscription_id}`);
  }

  const { error } = await db.rpc('anonymise_user', { p_user_id: user.id });
  if (error) throw new HttpError(409, error.message);
  const { error: authError } = await db.auth.admin.deleteUser(user.id, true);
  if (authError) throw authError;
  return json({ ok: true });
});
