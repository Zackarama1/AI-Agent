// Stripe events → contract, payout, plan and featured-listing state.
// Deploy with --no-verify-jwt (Stripe signs requests instead).
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient, env } from '../_shared/http.ts';
import { afterUnexpectedPayment } from '../_shared/payments.ts';
import { stripe, verifyStripeSignature } from '../_shared/stripe.ts';

const FEATURED_DAYS = 7;

type Subscription = { id: string; status: string; customer: string; items: { data: { price: { id: string } }[] } };

/** Map an active subscription's price to a plan; anything else means Free. */
export function planFor(sub: Subscription) {
  if (!['active', 'trialing', 'past_due'].includes(sub.status)) return 'free';
  const price = sub.items.data[0]?.price.id;
  if (price === Deno.env.get('STRIPE_PRICE_SCALE')) return 'scale';
  if (price === Deno.env.get('STRIPE_PRICE_PRO')) return 'pro';
  return 'free';
}

async function onContractPaid(db: SupabaseClient, session: { payment_intent: string; metadata?: Record<string, string> }) {
  const contractId = session.metadata?.contract_id;
  const pi = await stripe<{ id: string; latest_charge: string }>('GET', `/payment_intents/${session.payment_intent}`);
  const { data } = await db.from('contracts')
    .update({ status: 'funded', funded_at: new Date().toISOString(), stripe_payment_intent_id: pi.id, stripe_charge_id: pi.latest_charge })
    .eq('id', contractId).eq('status', 'awaiting_funding').select('id');
  if (data?.length) return;
  // Not awaiting payment any more. Stripe retries events, so a repeat of this same payment is a no-op;
  // only refund when the hire was cancelled while checkout was open (or a second checkout was paid).
  const { data: c } = await db.from('contracts').select('status, stripe_payment_intent_id').eq('id', contractId).maybeSingle();
  if (afterUnexpectedPayment(c, pi.id) === 'refund') {
    await stripe('POST', '/refunds', { payment_intent: pi.id, metadata: { contract_id: contractId, reason: 'contract_not_awaiting_payment' } }, `orphan-refund-${pi.id}`);
  }
}

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await verifyStripeSignature(raw, req.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET')))) {
    return new Response('Invalid signature', { status: 400 });
  }
  const event = JSON.parse(raw);
  const obj = event.data.object;
  const db = adminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      if (obj.payment_status !== 'paid') break;
      if (obj.metadata?.contract_id) await onContractPaid(db, obj);
      else if (obj.metadata?.kind === 'featured') {
        await db.rpc('extend_featured', { p_project_id: obj.metadata.project_id, p_days: FEATURED_DAYS });
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = obj as Subscription;
      const plan = event.type === 'customer.subscription.deleted' ? 'free' : planFor(sub);
      await db.from('businesses')
        .update({ plan, stripe_subscription_id: plan === 'free' ? null : sub.id })
        .eq('stripe_customer_id', sub.customer);
      break;
    }
    case 'account.updated': {
      await db.from('student_private').update({ payouts_enabled: Boolean(obj.payouts_enabled) }).eq('stripe_account_id', obj.id);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
