// Scheduled daily: release payment for projects delivered more than 7 days ago.
// Call with header `x-cron-secret: $CRON_SECRET` (see README for the pg_cron schedule).
import { adminClient, env, json } from '../_shared/http.ts';
import { releaseContract } from '../_shared/release.ts';

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return new Response('Forbidden', { status: 403 });
  const db = adminClient();
  const { data: due } = await db.from('contracts').select('*').eq('status', 'delivered').lte('auto_release_at', new Date().toISOString());
  const results = [];
  for (const c of due ?? []) {
    try {
      results.push({ id: c.id, transfer: await releaseContract(db, c) });
    } catch (e) {
      results.push({ id: c.id, error: (e as Error).message });
    }
  }
  return json({ released: results.filter((r) => 'transfer' in r).length, results });
});
