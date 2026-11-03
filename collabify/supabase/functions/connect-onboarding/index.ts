// Create (or reuse) the student's Stripe Express account and return an onboarding link.
import { adminClient, HttpError, json, requireUser, serve } from '../_shared/http.ts';
import { allowedAppUrl, stripeReturnUrl } from '../_shared/returns.ts';
import { stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const { returnUrl: appUrl } = await req.json();
  const app = allowedAppUrl(appUrl);
  const db = adminClient();
  const { data: priv } = await db.from('student_private').select('stripe_account_id, university_email').eq('id', user.id).single();
  if (!priv) throw new HttpError(403, 'Only students can set up payouts');

  let accountId = priv.stripe_account_id as string | null;
  if (!accountId) {
    const account = await stripe<{ id: string }>('POST', '/accounts', {
      type: 'express',
      country: 'GB',
      email: user.email,
      business_type: 'individual',
      capabilities: { transfers: { requested: true } },
      metadata: { user_id: user.id },
    }, `account-${user.id}`);
    accountId = account.id;
    await db.from('student_private').update({ stripe_account_id: accountId }).eq('id', user.id);
  }

  const returnUrl = stripeReturnUrl(app, { payouts: '1' });
  const link = await stripe<{ url: string }>('POST', '/account_links', {
    account: accountId,
    type: 'account_onboarding',
    refresh_url: returnUrl,
    return_url: returnUrl,
  });
  return json({ url: link.url });
});
