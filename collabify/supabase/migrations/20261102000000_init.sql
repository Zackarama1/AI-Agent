-- Collabify initial schema.
-- Product rules enforced here (see CLAUDE.md):
--   * fees charged to the business on top: free 12%, pro 8%, scale 5%; students keep 100%
--   * budget_pence >= estimated_hours * 1271 (minimum £12.71/hour)
--   * students sign up with a .ac.uk email
--   * contract status changes driven by Stripe happen only via Edge Functions (service role)
--   * reviews are blind until both sides have submitted
-- RLS is enabled on every table. Writes that cross ownership go through security-definer functions.

-- ---------- Types ----------
create type public.user_role as enum ('student', 'business', 'admin');
create type public.plan as enum ('free', 'pro', 'scale');
create type public.project_status as enum ('open', 'in_progress', 'delivered', 'completed', 'cancelled');
create type public.application_status as enum ('applied', 'shortlisted', 'hired', 'declined');
create type public.contract_status as enum ('awaiting_funding', 'funded', 'delivered', 'released', 'refunded', 'disputed');
create type public.right_to_work_status as enum ('unknown', 'confirmed', 'restricted');

-- ---------- Tables ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  full_name text not null check (char_length(full_name) between 2 and 80),
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key references public.profiles(id) on delete cascade,
  university text not null default '',
  course text not null default '',
  year text not null default '',
  skills text[] not null default '{}',
  bio text not null default '' check (char_length(bio) <= 2000),
  portfolio_url text not null default ''
);

create table public.student_private (
  id uuid primary key references public.students(id) on delete cascade,
  university_email text not null check (university_email ~* '^[^@\s]+@([a-z0-9-]+\.)+ac\.uk$'),
  stripe_account_id text,
  payouts_enabled boolean not null default false,
  right_to_work_status public.right_to_work_status not null default 'unknown',
  verified_at timestamptz
);

create table public.businesses (
  id uuid primary key references public.profiles(id) on delete cascade,
  company_name text not null check (char_length(company_name) between 1 and 120),
  website text not null default '',
  plan public.plan not null default 'free',
  stripe_customer_id text
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 120),
  category text not null,
  brief text not null check (char_length(brief) between 30 and 6000),
  budget_pence integer not null check (budget_pence > 0),
  estimated_hours numeric(6, 1) not null check (estimated_hours > 0),
  duration_days integer not null default 14 check (duration_days between 1 and 180),
  skills text[] not null default '{}',
  status public.project_status not null default 'open',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  constraint minimum_hourly_rate check (budget_pence >= estimated_hours * 1271)
);
create index projects_open_idx on public.projects (status, featured desc, created_at desc);
create index projects_business_idx on public.projects (business_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  pitch text not null check (char_length(pitch) between 20 and 3000),
  status public.application_status not null default 'applied',
  created_at timestamptz not null default now(),
  unique (project_id, student_id)
);
create index applications_student_idx on public.applications (student_id);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id),
  business_id uuid not null references public.businesses(id),
  student_id uuid not null references public.students(id),
  amount_pence integer not null check (amount_pence > 0),
  fee_rate numeric(4, 3) not null,
  fee_pence integer not null,
  total_pence integer not null,
  status public.contract_status not null default 'awaiting_funding',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_transfer_id text,
  funded_at timestamptz,
  delivered_at timestamptz,
  released_at timestamptz,
  auto_release_at timestamptz,
  created_at timestamptz not null default now(),
  check (total_pence = amount_pence + fee_pence)
);
create index contracts_business_idx on public.contracts (business_id);
create index contracts_student_idx on public.contracts (student_id);
create index contracts_auto_release_idx on public.contracts (auto_release_at) where status = 'delivered';

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  message text not null default '',
  file_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  reviewee_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1500),
  created_at timestamptz not null default now(),
  unique (contract_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index messages_contract_idx on public.messages (contract_id, created_at);

-- ---------- Helpers (security definer, fixed search_path) ----------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function public.is_contract_party(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from contracts where id = cid and auth.uid() in (business_id, student_id));
$$;

create function public.contract_fully_reviewed(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(distinct reviewer_id) from reviews where contract_id = cid) >= 2;
$$;

create function public.owns_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = pid and business_id = auth.uid());
$$;

-- Student has applied to, or been hired on, this project.
create function public.linked_to_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from applications where project_id = pid and student_id = auth.uid())
      or exists (select 1 from contracts where project_id = pid and student_id = auth.uid());
$$;

create function public.project_is_open(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = pid and status = 'open');
$$;

create function public.fee_rate_for(p public.plan) returns numeric
language sql immutable as $$
  select case p when 'scale' then 0.05 when 'pro' then 0.08 else 0.12 end;
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.student_private enable row level security;
alter table public.businesses enable row level security;
alter table public.projects enable row level security;
alter table public.applications enable row level security;
alter table public.contracts enable row level security;
alter table public.deliveries enable row level security;
alter table public.reviews enable row level security;
alter table public.messages enable row level security;

-- Public directory data: any signed-in user can read names, student profiles and company names.
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "students readable" on public.students for select to authenticated using (true);
create policy "businesses readable" on public.businesses for select to authenticated using (true);

-- Own-row edits (column grants below limit which columns).
create policy "student edits self" on public.students for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "business edits self" on public.businesses for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "student reads own private" on public.student_private for select to authenticated using (id = auth.uid() or public.is_admin());

create policy "projects visible" on public.projects for select to authenticated using (
  status = 'open' or business_id = auth.uid() or public.is_admin() or public.linked_to_project(id)
);
create policy "business posts projects" on public.projects for insert to authenticated with check (
  business_id = auth.uid() and status = 'open' and featured = false
  and exists (select 1 from businesses b where b.id = auth.uid())
);
create policy "business edits open projects" on public.projects for update to authenticated
  using (business_id = auth.uid() and status = 'open') with check (business_id = auth.uid());

create policy "applications visible" on public.applications for select to authenticated using (
  student_id = auth.uid() or public.is_admin() or public.owns_project(project_id)
);
create policy "students apply" on public.applications for insert to authenticated with check (
  student_id = auth.uid() and status = 'applied'
  and exists (select 1 from student_private sp where sp.id = auth.uid() and sp.verified_at is not null)
  and public.project_is_open(project_id)
);

create policy "contracts visible to parties" on public.contracts for select to authenticated
  using (auth.uid() in (business_id, student_id) or public.is_admin());

create policy "deliveries visible to parties" on public.deliveries for select to authenticated
  using (public.is_contract_party(contract_id) or public.is_admin());

-- Blind reviews: you see your own review; you see others' only once both sides have reviewed.
create policy "reviews blind" on public.reviews for select to authenticated
  using (reviewer_id = auth.uid() or public.contract_fully_reviewed(contract_id) or public.is_admin());

create policy "messages visible to parties" on public.messages for select to authenticated
  using (public.is_contract_party(contract_id) or public.is_admin());
create policy "parties send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_contract_party(contract_id));

-- Column-level privileges: clients may only touch these columns directly.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant insert (project_id, student_id, pitch) on public.applications to authenticated;
grant insert (business_id, title, category, brief, budget_pence, estimated_hours, duration_days, skills) on public.projects to authenticated;
grant update (title, category, brief, duration_days, skills) on public.projects to authenticated;
grant update (university, course, year, skills, bio, portfolio_url) on public.students to authenticated;
grant update (company_name, website) on public.businesses to authenticated;
grant insert (contract_id, sender_id, body) on public.messages to authenticated;

-- ---------- RPCs ----------

-- Called after email-code sign-in. Students must have signed in with a .ac.uk address.
create function public.complete_onboarding(
  p_role public.user_role, p_full_name text,
  p_university text default '', p_course text default '', p_year text default '', p_skills text[] default '{}',
  p_company_name text default '', p_website text default ''
) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_profile profiles;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from profiles where id = auth.uid()) then raise exception 'Already onboarded'; end if;
  if p_role = 'admin' then raise exception 'Not allowed'; end if;

  insert into profiles (id, role, full_name) values (auth.uid(), p_role, trim(p_full_name)) returning * into v_profile;
  if p_role = 'student' then
    if v_email !~ '^[^@\s]+@([a-z0-9-]+\.)+ac\.uk$' then
      raise exception 'Students must sign up with a .ac.uk email';
    end if;
    insert into students (id, university, course, year, skills) values (auth.uid(), p_university, p_course, p_year, p_skills);
    -- The one-time code was delivered to this address, which proves the student controls it.
    insert into student_private (id, university_email, verified_at) values (auth.uid(), v_email, now());
  else
    if coalesce(trim(p_company_name), '') = '' then raise exception 'Company name is required'; end if;
    insert into businesses (id, company_name, website) values (auth.uid(), trim(p_company_name), coalesce(p_website, ''));
  end if;
  return v_profile;
end $$;

create function public.set_application_status(p_application_id uuid, p_status public.application_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('shortlisted', 'declined') then raise exception 'Use hire_student to hire'; end if;
  update applications a set status = p_status
  from projects p
  where a.id = p_application_id and p.id = a.project_id and p.business_id = auth.uid()
    and p.status = 'open' and a.status <> 'hired';
  if not found then raise exception 'Application not found'; end if;
end $$;

-- Hiring creates the contract with the fee for the business's current plan.
create function public.hire_student(p_application_id uuid) returns public.contracts
language plpgsql security definer set search_path = public as $$
declare
  v_app applications;
  v_project projects;
  v_plan plan;
  v_rate numeric;
  v_fee integer;
  v_contract contracts;
begin
  select * into v_app from applications where id = p_application_id;
  if not found then raise exception 'Application not found'; end if;
  select * into v_project from projects where id = v_app.project_id for update;
  if v_project.business_id <> auth.uid() then raise exception 'Not your project'; end if;
  if v_project.status <> 'open' then raise exception 'You have already hired for this project'; end if;
  if v_app.status = 'declined' then raise exception 'You declined this applicant'; end if;

  select plan into v_plan from businesses where id = v_project.business_id;
  v_rate := fee_rate_for(v_plan);
  v_fee := round(v_project.budget_pence * v_rate);

  insert into contracts (project_id, business_id, student_id, amount_pence, fee_rate, fee_pence, total_pence)
  values (v_project.id, v_project.business_id, v_app.student_id, v_project.budget_pence, v_rate, v_fee, v_project.budget_pence + v_fee)
  returning * into v_contract;

  update applications set status = 'hired' where id = v_app.id;
  update applications set status = 'declined' where project_id = v_project.id and id <> v_app.id and status <> 'declined';
  update projects set status = 'in_progress' where id = v_project.id;
  return v_contract;
end $$;

create function public.deliver_contract(p_contract_id uuid, p_message text, p_file_paths text[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_contract contracts;
begin
  select * into v_contract from contracts where id = p_contract_id for update;
  if not found or v_contract.student_id <> auth.uid() then raise exception 'Not your contract'; end if;
  if v_contract.status <> 'funded' then raise exception 'You can deliver once payment is held'; end if;
  if char_length(trim(coalesce(p_message, ''))) < 5 and coalesce(array_length(p_file_paths, 1), 0) = 0 then
    raise exception 'Add a message or a file';
  end if;
  insert into deliveries (contract_id, message, file_paths) values (p_contract_id, trim(coalesce(p_message, '')), coalesce(p_file_paths, '{}'));
  update contracts set status = 'delivered', delivered_at = now(), auto_release_at = now() + interval '7 days' where id = p_contract_id;
  update projects set status = 'delivered' where id = v_contract.project_id;
end $$;

create function public.raise_issue(p_contract_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Tell us a little more'; end if;
  update contracts set status = 'disputed', auto_release_at = null
  where id = p_contract_id and auth.uid() in (business_id, student_id) and status in ('funded', 'delivered');
  if not found then raise exception 'You can only raise an issue while payment is held'; end if;
  insert into messages (contract_id, sender_id, body) values (p_contract_id, auth.uid(), 'Reported a problem: ' || trim(p_reason));
end $$;

create function public.submit_review(p_contract_id uuid, p_rating smallint, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare v_contract contracts;
begin
  select * into v_contract from contracts where id = p_contract_id;
  if not found or auth.uid() not in (v_contract.business_id, v_contract.student_id) then raise exception 'Not your contract'; end if;
  if v_contract.status <> 'released' then raise exception 'You can review once the project is complete'; end if;
  insert into reviews (contract_id, reviewer_id, reviewee_id, rating, comment)
  values (p_contract_id, auth.uid(),
          case when auth.uid() = v_contract.student_id then v_contract.business_id else v_contract.student_id end,
          p_rating, trim(coalesce(p_comment, '')));
exception when unique_violation then
  raise exception 'You have already reviewed this project';
end $$;

-- Ratings only count fully revealed (both-sides) reviews.
create function public.user_rating(p_user_id uuid) returns table (average numeric, count bigint)
language sql stable security definer set search_path = public as $$
  select round(avg(r.rating)::numeric, 1), count(*)
  from reviews r where r.reviewee_id = p_user_id and contract_fully_reviewed(r.contract_id);
$$;

create function public.completed_count(p_student_id uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from contracts where student_id = p_student_id and status = 'released';
$$;

create function public.applicant_count(p_project_id uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from applications where project_id = p_project_id and status <> 'declined';
$$;

-- Admin hand-matching: add a student to a project's shortlist.
create function public.admin_shortlist(p_project_id uuid, p_student_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  insert into applications (project_id, student_id, pitch, status)
  values (p_project_id, p_student_id, 'Recommended by the Collabify team as a strong match for this project.', 'shortlisted');
exception when unique_violation then
  raise exception 'Already on this project';
end $$;

-- Admin metrics: fill rate, time to match, repeat clients, value booked, fee revenue.
create function public.admin_metrics() returns json
language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select json_build_object(
    'openProjects', (select count(*) from projects where status = 'open'),
    'fillRate', coalesce((select count(*)::numeric from projects p where exists (select 1 from contracts c where c.project_id = p.id))
                 / nullif((select count(*) from projects where status <> 'cancelled'), 0), 0),
    'medianHoursToMatch', (select round(percentile_cont(0.5) within group (order by extract(epoch from c.created_at - p.created_at) / 3600)::numeric)
                           from contracts c join projects p on p.id = c.project_id),
    'repeatClientRate', coalesce((select count(*)::numeric from (select business_id from contracts group by business_id having count(*) > 1) x)
                         / nullif((select count(distinct business_id) from contracts), 0), 0),
    'gmvPence', (select coalesce(sum(amount_pence), 0) from contracts where status in ('funded', 'delivered', 'released', 'disputed')),
    'feeRevenuePence', (select coalesce(sum(fee_pence), 0) from contracts where status in ('funded', 'delivered', 'released', 'disputed'))
  ) into result;
  return result;
end $$;

revoke execute on all functions in schema public from anon;

-- ---------- Storage: deliveries bucket (private) ----------
-- Files live at deliveries/<contract_id>/<filename>.
insert into storage.buckets (id, name, public) values ('deliveries', 'deliveries', false) on conflict do nothing;

create policy "parties read deliveries" on storage.objects for select to authenticated using (
  bucket_id = 'deliveries' and public.is_contract_party(((storage.foldername(name))[1])::uuid)
);
create policy "student uploads deliveries" on storage.objects for insert to authenticated with check (
  bucket_id = 'deliveries' and exists (
    select 1 from public.contracts c
    where c.id = ((storage.foldername(name))[1])::uuid and c.student_id = auth.uid() and c.status = 'funded'
  )
);

-- ---------- Realtime for chat ----------
alter publication supabase_realtime add table public.messages;
