// Deliver one notification to the recipient's phones via the Expo push service.
// Called by the notification_push database trigger (pg_net) with x-push-secret. Deploy with --no-verify-jwt.
import { adminClient, env, json } from '../_shared/http.ts';
import { pushMessages, tokensToForget, type PushTicket } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== env('PUSH_SECRET')) return new Response('Forbidden', { status: 403 });
  const { notification_id } = await req.json();
  const db = adminClient();
  const { data: n } = await db.from('notifications').select('*').eq('id', notification_id).single();
  if (!n) return json({ sent: 0 });
  const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', n.user_id);
  const to = (tokens ?? []).map((t) => t.token as string);
  if (!to.length) return json({ sent: 0 });

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(pushMessages(n, to)),
  });
  const result = await res.json();
  const tickets: PushTicket[] = result.data ?? [];
  const dead = tokensToForget(to, tickets);
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  return json({ sent: to.length - dead.length, removed: dead.length });
});
