import { allowedAppUrl } from './returns.ts';

const throws = (fn: () => unknown, m: string) => {
  try { fn(); } catch { return; }
  throw new Error(`expected rejection: ${m}`);
};

Deno.test('return URLs must go back to the app', () => {
  if (allowedAppUrl('collabify://stripe-return') !== 'collabify://stripe-return') throw new Error('app scheme rejected');
  allowedAppUrl('exp://192.168.1.10:8081/--/stripe-return');
  throws(() => allowedAppUrl('https://evil.example/phish'), 'https');
  throws(() => allowedAppUrl('javascript:alert(1)'), 'javascript');
  throws(() => allowedAppUrl(undefined), 'missing');
});
