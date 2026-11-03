-- Richer, more accurate listings.
-- Companies describe themselves (industry, size, location, about); their track record is computed
-- from real contracts, never typed in. Projects state deliverables, level, and where the work happens.

alter table public.businesses
  add column industry text not null default '' check (char_length(industry) <= 60),
  add column company_size text not null default '' check (company_size in ('', 'Just me', '2–10', '11–50', '51–200', '200+')),
  add column location text not null default '' check (char_length(location) <= 80),
  add column about text not null default '' check (char_length(about) <= 600);

alter table public.projects
  add column deliverables text[] not null default '{}' check (cardinality(deliverables) <= 8),
  add column level text not null default 'intermediate' check (level in ('beginner', 'intermediate', 'advanced')),
  add column work_mode text not null default 'remote' check (work_mode in ('remote', 'hybrid', 'in_person')),
  add column city text not null default '' check (char_length(city) <= 60),
  add constraint city_when_not_remote check (work_mode = 'remote' or char_length(city) > 0);

grant update (industry, company_size, location, about) on public.businesses to authenticated;
grant insert (deliverables, level, work_mode, city) on public.projects to authenticated;
grant update (deliverables, level, work_mode, city) on public.projects to authenticated;

-- Public track record for a company, from contracts (which are otherwise private to the two parties).
create function public.business_stats(p_business_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'projectsPosted', (select count(*) from projects where business_id = p_business_id and status <> 'cancelled'),
    'studentsHired', (select count(distinct student_id) from contracts where business_id = p_business_id and cancelled_at is null),
    'paidProjects', (select count(*) from contracts where business_id = p_business_id and status = 'released'),
    'openProjects', (select count(*) from projects where business_id = p_business_id and status = 'open'),
    'memberSince', (select created_at from profiles where id = p_business_id)
  );
$$;

-- Onboarding now captures the company profile up front.
drop function public.complete_onboarding(public.user_role, text, text, text, text, text[], text, text);
create function public.complete_onboarding(
  p_role public.user_role, p_full_name text,
  p_university text default '', p_course text default '', p_year text default '', p_skills text[] default '{}',
  p_company_name text default '', p_website text default '',
  p_industry text default '', p_company_size text default '', p_location text default '', p_about text default ''
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
    insert into student_private (id, university_email, verified_at) values (auth.uid(), v_email, now());
  else
    if coalesce(trim(p_company_name), '') = '' then raise exception 'Company name is required'; end if;
    insert into businesses (id, company_name, website, industry, company_size, location, about)
    values (auth.uid(), trim(p_company_name), coalesce(p_website, ''), coalesce(trim(p_industry), ''), coalesce(p_company_size, ''),
            coalesce(trim(p_location), ''), coalesce(trim(p_about), ''));
  end if;
  return v_profile;
end $$;
revoke execute on function public.complete_onboarding(public.user_role, text, text, text, text, text[], text, text, text, text, text, text) from anon;
