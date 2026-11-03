-- Businesses invite well-matched students to apply to an open project.
create table public.project_invites (
  project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, student_id)
);
create index project_invites_student_idx on public.project_invites (student_id);

alter table public.project_invites enable row level security;
revoke all on public.project_invites from anon, authenticated;
grant select, insert on public.project_invites to authenticated;

create policy "see own invites" on public.project_invites for select to authenticated
  using (student_id = auth.uid() or public.owns_project(project_id) or public.is_admin());
create policy "business invites to open projects" on public.project_invites for insert to authenticated
  with check (
    public.owns_project(project_id) and public.project_is_open(project_id)
    and exists (select 1 from profiles where id = student_id and role = 'student' and deleted_at is null)
  );

create function public.on_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_project projects;
begin
  select * into v_project from projects where id = new.project_id;
  perform notify(new.student_id, 'invited', 'You''re invited to apply',
    (select company_name from businesses where id = v_project.business_id) || ' would like you to apply for ' || v_project.title || ' · ' || gbp(v_project.budget_pence) || '.',
    '/project/' || v_project.id);
  return new;
end $$;
create trigger invite_notifications after insert on public.project_invites
  for each row execute function public.on_invite();
