import crypto from 'node:crypto';

/**
 * Stripe Connect escrow provider ("separate charges and transfers").
 *
 *  fund    -> PaymentIntent on the platform account with transfer_group = contract id.
 *             The client confirms it with Stripe.js using the returned clientSecret;
 *             the `payment_intent.succeeded` webhook marks the contract funded.
 *  release -> Transfer of the payout (amount minus commission) to the student's
 *             connected Express account. The commission stays on the platform balance.
 *  refund  -> Refund of the PaymentIntent back to the entrepreneur.
 */
export function createStripeProvider(secretKey, currency) {
  async function stripe(method, path, params) {
    const body = params ? new URLSearchParams(flatten(params)).toString() : undefined;
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Stripe: ${json.error?.message || res.statusText}`);
    return json;
  }

  return {
    name: 'stripe',
    async fund({ contract }) {
      const pi = await stripe('POST', '/payment_intents', {
        amount: contract.amount_pence,
        currency,
        transfer_group: `contract_${contract.id}`,
        metadata: { contract_id: contract.id },
        automatic_payment_methods: { enabled: true },
      });
      return { ref: pi.id, funded: false, clientSecret: pi.client_secret };
    },
    async release({ contract, student }) {
      if (!student.stripe_account_id) throw new Error('Student has not connected a payout account');
      const tr = await stripe('POST', '/transfers', {
        amount: contract.payout_pence,
        currency,
        destination: student.stripe_account_id,
        transfer_group: `contract_${contract.id}`,
      });
      return { ref: tr.id };
    },
    async refund({ contract }) {
      const re = await stripe('POST', '/refunds', { payment_intent: contract.provider_ref });
      return { ref: re.id };
    },
    async createConnectedAccount({ user }) {
      const acct = await stripe('POST', '/accounts', { type: 'express', email: user.email, country: 'GB' });
      return acct.id;
    },
    async onboardingLink({ accountId, appUrl }) {
      const link = await stripe('POST', '/account_links', {
        account: accountId,
        refresh_url: `${appUrl}/payments`,
        return_url: `${appUrl}/payments`,
        type: 'account_onboarding',
      });
      return link.url;
    },
  };
}

/** Verify a Stripe-Signature header (v1 scheme) against the raw request body. */
export function verifyStripeSignature(rawBody, header, secret, toleranceSeconds = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const given = Buffer.from(parts.v1 || '', 'hex');
  const want = Buffer.from(expected, 'hex');
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}
