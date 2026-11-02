// Stripe events → contract and payout status. Deploy with --no-verify-jwt (Stripe signs instead).
import { adminClient, env } from '../_shared/http.ts';
import { stripe, verifyStripeSignature } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await verifyStripeSignature(raw, req.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET')))) {
    return new Response('Invalid signature', { status: 400 });
  }
  const event = JSON.parse(raw);
  const db = adminClient();

  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    const session = event.data.object;
    const contractId = session.metadata?.contract_id;
    const pi = await stripe<{ id: string; latest_charge: string }>('GET', `/payment_intents/${session.payment_intent}`);
    await db.from('contracts')
      .update({ status: 'funded', funded_at: new Date().toISOString(), stripe_payment_intent_id: pi.id, stripe_charge_id: pi.latest_charge })
      .eq('id', contractId).eq('status', 'awaiting_funding');
  }

  if (event.type === 'account.updated') {
    const account = event.data.object;
    await db.from('student_private')
      .update({ payouts_enabled: Boolean(account.payouts_enabled) })
      .eq('stripe_account_id', account.id);
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
