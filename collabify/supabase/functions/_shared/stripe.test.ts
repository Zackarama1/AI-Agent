import { verifyStripeSignature } from './stripe.ts';

async function sign(body: string, secret: string, t: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const assert = (c: boolean, m: string) => { if (!c) throw new Error(m); };

Deno.test('accepts a valid Stripe signature', async () => {
  const t = Math.floor(Date.now() / 1000);
  const body = '{"type":"checkout.session.completed"}';
  assert(await verifyStripeSignature(body, `t=${t},v1=${await sign(body, 'whsec_test', t)}`, 'whsec_test'), 'valid rejected');
});

Deno.test('rejects tampered body, wrong secret, stale timestamp, missing header', async () => {
  const t = Math.floor(Date.now() / 1000);
  const body = '{"amount":100}';
  const sig = await sign(body, 'whsec_test', t);
  assert(!(await verifyStripeSignature('{"amount":999}', `t=${t},v1=${sig}`, 'whsec_test')), 'tampered accepted');
  assert(!(await verifyStripeSignature(body, `t=${t},v1=${sig}`, 'whsec_other')), 'wrong secret accepted');
  const old = t - 3600;
  assert(!(await verifyStripeSignature(body, `t=${old},v1=${await sign(body, 'whsec_test', old)}`, 'whsec_test')), 'stale accepted');
  assert(!(await verifyStripeSignature(body, null, 'whsec_test')), 'missing header accepted');
});
