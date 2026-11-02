-- Revisions, cancellations, dispute details, paid featured listings and subscriptions.

-- ---------- Contracts ----------
alter type public.contract_status add value if not exists 'cancelled';

alter table public.contracts
  add column revision_count integer not null default 0,
  add column issue_reason text,
  add column issue_raised_by uuid references public.profiles(id),
  add column cancelled_at timestamptz,
  add column stripe_refund_id text;

-- One live contract per project; a cancelled (unpaid) hire frees the project up again.
alter table public.contracts drop constraint contracts_project_id_key;
create unique index contracts_one_live_per_project on public.contracts (project_id) where cancelled_at is null;

-- ---------- Applications ----------
alter table public.applications add column auto_declined boolean not null default false;

-- Students can withdraw an application that hasn't led to a hire.
create policy "students withdraw" on public.applications for delete to authenticated
  using (student_id = auth.uid() and status in ('applied', 'shortlisted'));
grant delete on public.applications to authenticated;

-- ---------- Featured listings (paid, 7 days) ----------
drop policy "business posts projects" on public.projects;
drop index public.projects_open_idx;
alter table public.projects add column featured_until timestamptz;
update public.projects set featured_until = now() + interval '7 days' where featured;
alter table public.projects drop column featured;
create index projects_open_idx on public.projects (status, featured_until desc nulls last, created_at desc);
create policy "business posts projects" on public.projects for insert to authenticated with check (
  business_id = auth.uid() and status = 'open'
  and exists (select 1 from businesses b where b.id = auth.uid())
);

-- ---------- Subscriptions ----------
alter table public.businesses add column stripe_subscription_id text;

-- ---------- Functions ----------

-- Hiring now remembers which applicants were declined automatically, so a cancelled hire can restore them.
create or replace function public.hire_student(p_application_id uuid) returns public.contracts
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
  update applications set status = 'declined', auto_declined = true
    where project_id = v_project.id and id <> v_app.id and status <> 'declined';
  update projects set status = 'in_progress', featured_until = null where id = v_project.id;
  return v_contract;
end $$;

create or replace function public.raise_issue(p_contract_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Tell us a little more'; end if;
  update contracts set status = 'disputed', auto_release_at = null, issue_reason = trim(p_reason), issue_raised_by = auth.uid()
  where id = p_contract_id and auth.uid() in (business_id, student_id) and status in ('funded', 'delivered');
  if not found then raise exception 'You can only raise an issue while payment is held'; end if;
  insert into messages (contract_id, sender_id, body) values (p_contract_id, auth.uid(), 'Reported a problem: ' || trim(p_reason));
end $$;

-- Business sends a delivery back: payment stays held and the auto-release clock stops.
create function public.request_changes(p_contract_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare v_contract contracts;
begin
  if char_length(trim(coalesce(p_note, ''))) < 10 then raise exception 'Tell them what to change'; end if;
  select * into v_contract from contracts where id = p_contract_id for update;
  if not found or v_contract.business_id <> auth.uid() then raise exception 'Not your contract'; end if;
  if v_contract.status <> 'delivered' then raise exception 'You can ask for changes after a delivery'; end if;
  update contracts set status = 'funded', auto_release_at = null, revision_count = revision_count + 1 where id = p_contract_id;
  update projects set status = 'in_progress' where id = v_contract.project_id;
  insert into messages (contract_id, sender_id, body) values (p_contract_id, auth.uid(), 'Changes requested: ' || trim(p_note));
end $$;

-- Business cancels a hire before paying. The project reopens, the student goes back to the shortlist
-- and auto-declined applicants come back.
create function public.cancel_contract(p_contract_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_contract contracts;
begin
  select * into v_contract from contracts where id = p_contract_id for update;
  if not found or v_contract.business_id <> auth.uid() then raise exception 'Not your contract'; end if;
  if v_contract.status <> 'awaiting_funding' then raise exception 'Paid projects can''t be cancelled. Report a problem instead.'; end if;
  update contracts set status = 'cancelled', cancelled_at = now() where id = p_contract_id;
  update projects set status = 'open' where id = v_contract.project_id;
  update applications set status = 'shortlisted' where project_id = v_contract.project_id and student_id = v_contract.student_id;
  update applications set status = 'applied', auto_declined = false where project_id = v_contract.project_id and auto_declined;
end $$;

create function public.cancel_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update projects set status = 'cancelled', featured_until = null
  where id = p_project_id and business_id = auth.uid() and status = 'open';
  if not found then raise exception 'Only open projects can be cancelled'; end if;
  update applications set status = 'declined' where project_id = p_project_id and status <> 'declined';
end $$;

-- Paid features are granted only by the Stripe webhook (service role).
create function public.extend_featured(p_project_id uuid, p_days integer) returns void
language sql security definer set search_path = public as $$
  update projects set featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => p_days)
  where id = p_project_id;
$$;
revoke execute on function public.extend_featured(uuid, integer) from public, anon, authenticated;

-- Metrics ignore cancelled (never paid) hires.
create or replace function public.admin_metrics() returns json
language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select json_build_object(
    'openProjects', (select count(*) from projects where status = 'open'),
    'fillRate', coalesce((select count(*)::numeric from projects p where exists (select 1 from contracts c where c.project_id = p.id and c.cancelled_at is null))
                 / nullif((select count(*) from projects where status <> 'cancelled'), 0), 0),
    'medianHoursToMatch', (select round(percentile_cont(0.5) within group (order by extract(epoch from c.created_at - p.created_at) / 3600)::numeric)
                           from contracts c join projects p on p.id = c.project_id where c.cancelled_at is null),
    'repeatClientRate', coalesce((select count(*)::numeric from (select business_id from contracts where cancelled_at is null group by business_id having count(*) > 1) x)
                         / nullif((select count(distinct business_id) from contracts where cancelled_at is null), 0), 0),
    'gmvPence', (select coalesce(sum(amount_pence), 0) from contracts where status in ('funded', 'delivered', 'released', 'disputed')),
    'feeRevenuePence', (select coalesce(sum(fee_pence), 0) from contracts where status in ('funded', 'delivered', 'released', 'disputed'))
  ) into result;
  return result;
end $$;
