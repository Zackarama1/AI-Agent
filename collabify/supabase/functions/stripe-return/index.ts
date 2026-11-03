// Bounce from Stripe's https return URL back into the app. Deploy with --no-verify-jwt.
import { allowedAppUrl } from '../_shared/returns.ts';

Deno.serve((req) => {
  try {
    const to = allowedAppUrl(new URL(req.url).searchParams.get('to'));
    return new Response(null, { status: 302, headers: { Location: to } });
  } catch {
    return new Response('Invalid return link', { status: 400 });
  }
});
