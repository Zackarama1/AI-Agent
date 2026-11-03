// Business pays the project price + service fee via Stripe Checkout. The money is held on the
// platform balance until release ("separate charges and transfers").
import { adminClient, HttpError, json, requireUser, serve } from '../_shared/http.ts';
import { allowedAppUrl, stripeReturnUrl } from '../_shared/returns.ts';
import { stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const { contractId, returnUrl: appUrl } = await req.json();
  const app = allowedAppUrl(appUrl);
  const db = adminClient();
  const { data: c } = await db.from('contracts').select('*, project:projects(title)').eq('id', contractId).single();
  if (!c || c.business_id !== user.id) throw new HttpError(404, 'Contract not found');
  if (c.status !== 'awaiting_funding') throw new HttpError(409, 'This project is already paid for');

  const session = await stripe<{ id: string; url: string }>('POST', '/checkout/sessions', {
    mode: 'payment',
    customer_email: user.email,
    line_items: [
      { quantity: 1, price_data: { currency: 'gbp', unit_amount: c.amount_pence, product_data: { name: c.project?.title ?? 'Collabify project' } } },
      { quantity: 1, price_data: { currency: 'gbp', unit_amount: c.fee_pence, product_data: { name: `Collabify service fee (${Math.round(Number(c.fee_rate) * 100)}%)` } } },
    ],
    payment_intent_data: { transfer_group: `contract_${c.id}`, metadata: { contract_id: c.id } },
    metadata: { contract_id: c.id },
    success_url: stripeReturnUrl(app, { contract: c.id, paid: '1' }),
    cancel_url: stripeReturnUrl(app, { contract: c.id }),
  }, `checkout-${c.id}-${c.total_pence}`);

  await db.from('contracts').update({ stripe_checkout_session_id: session.id }).eq('id', c.id);
  return json({ url: session.url });
});
