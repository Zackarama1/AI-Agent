-- Notifications: an activity feed per user, filled by triggers on the events that matter,
-- and (once configured by go-live) pushed to phones through the send-push Edge Function.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Supabase grants full privileges on new tables by default: take them back, then allow only what's needed.
revoke all on public.notifications from anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default '',
  created_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "own push tokens" on public.push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.push_tokens from anon, authenticated;
grant select, insert, delete on public.push_tokens to authenticated;

alter publication supabase_realtime add table public.notifications;

-- ---------- helpers ----------
create function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, title, body, link)
  select p_user, p_kind, p_title, coalesce(p_body, ''), coalesce(p_link, '')
  where p_user is not null and exists (select 1 from profiles where id = p_user and deleted_at is null);
$$;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

create function public.gbp(p_pence integer) returns text
language sql immutable as $$
  select '£' || case when p_pence % 100 = 0 then to_char(p_pence / 100, 'FM999,999,990') else to_char(p_pence / 100.0, 'FM999,999,990.00') end;
$$;

-- ---------- applications ----------
create function public.on_application_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_project projects;
  v_student text;
begin
  select * into v_project from projects where id = new.project_id;
  select full_name into v_student from profiles where id = new.student_id;
  if tg_op = 'INSERT' then
    if new.status = 'shortlisted' then -- added by the Collabify team
      perform notify(v_project.business_id, 'recommended', 'We found you a match', v_student || ' looks like a strong fit for ' || v_project.title || '.', '/project/' || v_project.id);
      perform notify(new.student_id, 'shortlisted', 'You''re on a shortlist', 'The Collabify team recommended you for ' || v_project.title || '.', '/project/' || v_project.id);
    else
      perform notify(v_project.business_id, 'application', 'New applicant', v_student || ' applied to ' || v_project.title || '.', '/project/' || v_project.id);
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'shortlisted' and old.status = 'applied' then
      perform notify(new.student_id, 'shortlisted', 'You''re on the shortlist', v_project.title || ' · ' || gbp(v_project.budget_pence), '/project/' || v_project.id);
    elsif new.status = 'declined' and new.auto_declined then
      perform notify(new.student_id, 'filled', 'Project filled', v_project.title || ' went to another student. Keep applying!', '/project/' || v_project.id);
    elsif new.status = 'declined' and old.status in ('applied', 'shortlisted') and v_project.status = 'cancelled' then
      perform notify(new.student_id, 'closed', 'Project closed', v_project.title || ' was closed by the business.', '/project/' || v_project.id);
    elsif new.status = 'declined' and old.status in ('applied', 'shortlisted') then
      perform notify(new.student_id, 'declined', 'Not this time', 'Your application to ' || v_project.title || ' wasn''t selected.', '/project/' || v_project.id);
    end if;
  end if;
  return new;
end $$;
create trigger application_notifications after insert or update of status on public.applications
  for each row execute function public.on_application_change();

-- ---------- contracts ----------
create function public.on_contract_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_company text;
  v_student text;
  v_link text := '/contract/' || new.id;
  v_admin uuid;
begin
  select title into v_title from projects where id = new.project_id;
  select company_name into v_company from businesses where id = new.business_id;
  select full_name into v_student from profiles where id = new.student_id;

  if tg_op = 'INSERT' then
    perform notify(new.student_id, 'hired', 'You''re hired!', v_company || ' hired you for ' || v_title || '. Start once payment is held.', v_link);
    return new;
  end if;
  if new.status is not distinct from old.status then return new; end if;

  case new.status
    when 'funded' then
      if old.status = 'delivered' then
        perform notify(new.student_id, 'changes', 'Changes requested', v_company || ' asked for changes to ' || v_title || '. Payment is still held for you.', v_link);
      else
        perform notify(new.student_id, 'funded', 'Payment held: start work', gbp(new.amount_pence) || ' is held for ' || v_title || '.', v_link);
      end if;
    when 'delivered' then
      perform notify(new.business_id, 'delivered', 'Work delivered', v_student || ' delivered ' || v_title || '. It''s paid automatically in 7 days unless you ask for changes.', v_link);
    when 'released' then
      perform notify(new.student_id, 'paid', 'You''ve been paid ' || gbp(new.amount_pence), v_title || ' is complete. Leave ' || v_company || ' a review.', v_link);
      perform notify(new.business_id, 'completed', 'Project complete', v_title || ' is done. Leave ' || v_student || ' a review.', v_link);
    when 'disputed' then
      perform notify(case when new.issue_raised_by = new.student_id then new.business_id else new.student_id end,
        'problem', 'A problem was reported', 'On ' || v_title || '. The payment stays held while we help.', v_link);
      for v_admin in select id from profiles where role = 'admin' and deleted_at is null loop
        perform notify(v_admin, 'problem', 'Problem to resolve', v_title || ' · ' || gbp(new.amount_pence), v_link);
      end loop;
    when 'refunded' then
      perform notify(new.business_id, 'refunded', 'Refunded', 'You''ve been refunded ' || gbp(new.total_pence) || ' for ' || v_title || '.', v_link);
      perform notify(new.student_id, 'refunded', 'Project closed', v_title || ' was closed and the business refunded.', v_link);
    when 'cancelled' then
      perform notify(new.student_id, 'cancelled', 'Hire cancelled', v_company || ' cancelled the hire for ' || v_title || ' before paying.', '/project/' || new.project_id);
    else null;
  end case;
  return new;
end $$;
create trigger contract_notifications after insert or update of status on public.contracts
  for each row execute function public.on_contract_change();

-- ---------- messages ----------
create function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_contract contracts;
  v_sender text;
begin
  select * into v_contract from contracts where id = new.contract_id;
  select full_name into v_sender from profiles where id = new.sender_id;
  -- System-style messages (changes requested, problems) already have their own notification.
  if new.body like 'Changes requested: %' or new.body like 'Reported a problem: %' or new.body like 'Collabify reviewed this project%' then
    return new;
  end if;
  perform notify(case when new.sender_id = v_contract.student_id then v_contract.business_id else v_contract.student_id end,
    'message', v_sender, left(new.body, 120), '/chat/' || new.contract_id);
  return new;
end $$;
create trigger message_notifications after insert on public.messages
  for each row execute function public.on_message();

-- ---------- reviews ----------
create function public.on_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  select p.title into v_title from contracts c join projects p on p.id = c.project_id where c.id = new.contract_id;
  if contract_fully_reviewed(new.contract_id) then
    perform notify(new.reviewer_id, 'reviews', 'Reviews are in', 'See what was said about ' || v_title || '.', '/contract/' || new.contract_id);
    perform notify(new.reviewee_id, 'reviews', 'Reviews are in', 'See what was said about ' || v_title || '.', '/contract/' || new.contract_id);
  else
    perform notify(new.reviewee_id, 'review_waiting', 'You''ve got a review', 'Leave yours for ' || v_title || ' to see it.', '/contract/' || new.contract_id);
  end if;
  return new;
end $$;
create trigger review_notifications after insert on public.reviews
  for each row execute function public.on_review();

-- ---------- push delivery ----------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.settings (key text primary key, value text not null);

-- Called once by scripts/go-live.mjs with the send-push function URL and a shared secret.
create function public.configure_push(p_url text, p_secret text) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'net') then
    execute 'create extension if not exists pg_net with schema extensions';
  end if;
  insert into private.settings values ('push_url', p_url), ('push_secret', p_secret)
  on conflict (key) do update set value = excluded.value;
end $$;
revoke execute on function public.configure_push(text, text) from public, anon, authenticated;

create function public.on_notification_push() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_url text := (select value from private.settings where key = 'push_url');
  v_secret text := (select value from private.settings where key = 'push_secret');
begin
  if v_url is null or not exists (select 1 from push_tokens where user_id = new.user_id) then return new; end if;
  execute 'select net.http_post(url := $1, headers := $2::jsonb, body := $3::jsonb)'
    using v_url, json_build_object('x-push-secret', v_secret, 'Content-Type', 'application/json')::text,
          json_build_object('notification_id', new.id)::text;
  return new;
end $$;
create trigger notification_push after insert on public.notifications
  for each row execute function public.on_notification_push();

-- ---------- hardening ----------
-- TRUNCATE bypasses row-level security; app users never need it (nor REFERENCES/TRIGGER).
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
-- New tables start with no write access for app users; each migration grants exactly what it needs.
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;

-- A phone's push token belongs to whoever signed in on it most recently.
create function public.claim_push_token(p_token text, p_platform text) returns void
language sql security definer set search_path = public as $$
  insert into push_tokens (token, user_id, platform) values (p_token, auth.uid(), coalesce(p_platform, ''))
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, created_at = now();
$$;
revoke execute on function public.claim_push_token(text, text) from public, anon;
