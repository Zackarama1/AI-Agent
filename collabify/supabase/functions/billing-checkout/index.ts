// Paid extras, sold on the web through Stripe:
//   kind=plan     → subscription Checkout for Startup Pro / Scale, or the billing portal to change/cancel
//   kind=featured → £19 one-off Checkout to feature a project for 7 days
import { adminClient, env, HttpError, json, requireUser, serve } from '../_shared/http.ts';
import { allowedAppUrl, stripeReturnUrl } from '../_shared/returns.ts';
import { stripe } from '../_shared/stripe.ts';

const FEATURED_PENCE = 1900;
const PRICE_ENV: Record<string, string> = { pro: 'STRIPE_PRICE_PRO', scale: 'STRIPE_PRICE_SCALE' };

serve(async (req) => {
  const user = await requireUser(req);
  const db = adminClient();
  const { data: business } = await db.from('businesses').select('*').eq('id', user.id).single();
  if (!business) throw new HttpError(403, 'Only businesses can buy plans and features');
  const body = await req.json();
  const app = allowedAppUrl(body.returnUrl);

  let customer = business.stripe_customer_id as string | null;
  if (!customer) {
    const c = await stripe<{ id: string }>('POST', '/customers', {
      email: user.email, name: business.company_name, metadata: { business_id: business.id },
    }, `customer-${business.id}`);
    customer = c.id;
    await db.from('businesses').update({ stripe_customer_id: customer }).eq('id', business.id);
  }

  if (body.kind === 'featured') {
    const { data: p } = await db.from('projects').select('id, title, status, business_id').eq('id', body.projectId).single();
    if (!p || p.business_id !== business.id) throw new HttpError(404, 'Project not found');
    if (p.status !== 'open') throw new HttpError(409, 'Only open projects can be featured');
    const session = await stripe<{ url: string }>('POST', '/checkout/sessions', {
      mode: 'payment',
      customer,
      line_items: [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: FEATURED_PENCE, product_data: { name: `Featured listing (7 days): ${p.title}` } } }],
      metadata: { kind: 'featured', project_id: p.id, business_id: business.id },
      success_url: stripeReturnUrl(app, { project: p.id, featured: '1' }),
      cancel_url: stripeReturnUrl(app, { project: p.id }),
    });
    return json({ url: session.url });
  }

  if (body.kind === 'plan') {
    // Existing subscribers (and anyone going back to Free) manage their plan in the billing portal.
    if (business.stripe_subscription_id || body.plan === 'free') {
      const portal = await stripe<{ url: string }>('POST', '/billing_portal/sessions', {
        customer,
        return_url: stripeReturnUrl(app),
        configuration: Deno.env.get('STRIPE_PORTAL_CONFIG') || undefined,
      });
      return json({ url: portal.url });
    }
    const priceEnv = PRICE_ENV[body.plan];
    if (!priceEnv) throw new HttpError(400, 'Unknown plan');
    const session = await stripe<{ url: string }>('POST', '/checkout/sessions', {
      mode: 'subscription',
      customer,
      line_items: [{ quantity: 1, price: env(priceEnv) }],
      subscription_data: { metadata: { business_id: business.id, plan: body.plan } },
      metadata: { kind: 'plan', business_id: business.id, plan: body.plan },
      success_url: stripeReturnUrl(app, { plan: body.plan }),
      cancel_url: stripeReturnUrl(app),
    });
    return json({ url: session.url });
  }

  throw new HttpError(400, 'Unknown request');
});
