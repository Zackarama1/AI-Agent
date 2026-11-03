import { env, HttpError } from './http.ts';

/**
 * Stripe Checkout and Connect only accept https return URLs, so they come back through the
 * `stripe-return` function, which redirects to the app (collabify://… or exp://… in Expo Go).
 * App URLs are checked against APP_SCHEMES so the redirect can't be used to send people elsewhere.
 */
export function allowedAppUrl(url: unknown): string {
  const schemes = (Deno.env.get('APP_SCHEMES') ?? 'collabify://,exp://,exps://').split(',').map((s) => s.trim()).filter(Boolean);
  if (typeof url !== 'string' || !schemes.some((s) => url.startsWith(s))) throw new HttpError(400, 'Invalid return URL');
  return url;
}

/** https URL Stripe should send the user to; lands back in the app at `appUrl` with extra params. */
export function stripeReturnUrl(appUrl: string, params: Record<string, string> = {}) {
  const target = new URL(appUrl);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return `${env('SUPABASE_URL')}/functions/v1/stripe-return?to=${encodeURIComponent(target.toString())}`;
}
