-- Account deletion (required by the App Store).
-- People can delete their account unless money is currently held for one of their projects.
-- Completed contracts, payments and reviews are kept for the other party and for financial records,
-- but the person's name and profile details are removed and their login is deleted.

alter table public.profiles add column deleted_at timestamptz;

-- Why this user can't be deleted right now, or null if they can.
create function public.account_deletion_blocker(p_user_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (
      select 1 from contracts
      where p_user_id in (business_id, student_id) and status in ('funded', 'delivered', 'disputed')
    ) then 'You have a project with payment held. Finish it, or report a problem, before deleting your account.'
  end;
$$;

create function public.anonymise_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_blocker text := account_deletion_blocker(p_user_id);
begin
  if v_blocker is not null then raise exception '%', v_blocker; end if;

  -- Unpaid hires on either side are cancelled; the project reopens for a business that's staying.
  update projects p set status = 'open'
  from contracts c
  where c.project_id = p.id and c.status = 'awaiting_funding' and c.student_id = p_user_id;
  update applications a set status = 'applied', auto_declined = false
  from contracts c
  where c.status = 'awaiting_funding' and c.student_id = p_user_id and a.project_id = c.project_id and a.auto_declined;
  update contracts set status = 'cancelled', cancelled_at = now()
  where status = 'awaiting_funding' and p_user_id in (business_id, student_id);

  -- Business: close open projects.
  update applications set status = 'declined'
  where project_id in (select id from projects where business_id = p_user_id and status in ('open', 'in_progress')) and status <> 'hired';
  update projects set status = 'cancelled', featured_until = null
  where business_id = p_user_id and status in ('open', 'in_progress');
  update businesses set company_name = 'Deleted business', website = '', stripe_subscription_id = null, plan = 'free'
  where id = p_user_id;

  -- Student: withdraw open applications and remove profile details and the university email.
  delete from applications where student_id = p_user_id and status in ('applied', 'shortlisted');
  update students set university = '', course = '', year = '', skills = '{}', bio = '', portfolio_url = '' where id = p_user_id;
  delete from student_private where id = p_user_id;

  update profiles set full_name = 'Deleted user', deleted_at = now() where id = p_user_id;
end $$;

-- Only the delete-account Edge Function (service role) may call these.
revoke execute on function public.anonymise_user(uuid) from public, anon, authenticated;
revoke execute on function public.account_deletion_blocker(uuid) from public, anon, authenticated;
