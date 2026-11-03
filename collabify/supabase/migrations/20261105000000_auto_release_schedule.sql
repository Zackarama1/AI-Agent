-- Daily auto-release schedule. Called once by scripts/go-live.mjs (service role) with the project's
-- function URL and the CRON_SECRET it generated; safe to call again (it replaces the job).
create function public.schedule_auto_release(p_url text, p_secret text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  execute 'create extension if not exists pg_cron';
  execute 'create extension if not exists pg_net with schema extensions';
  execute format(
    $job$select cron.schedule('collabify-auto-release', '17 3 * * *', %L)$job$,
    format(
      'select net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb)',
      p_url, json_build_object('x-cron-secret', p_secret, 'Content-Type', 'application/json')::text
    )
  );
end $$;
revoke execute on function public.schedule_auto_release(text, text) from public, anon, authenticated;
