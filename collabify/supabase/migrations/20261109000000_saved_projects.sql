-- Students bookmark projects to come back to.
create table public.saved_projects (
  student_id uuid not null references public.students(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, project_id)
);
alter table public.saved_projects enable row level security;
revoke all on public.saved_projects from anon, authenticated;
grant select, insert, delete on public.saved_projects to authenticated;
create policy "own saved projects" on public.saved_projects for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- Opening a conversation clears its message notifications.
create function public.mark_conversation_read(p_contract_id uuid) returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now()
  where user_id = auth.uid() and kind = 'message' and link = '/chat/' || p_contract_id and read_at is null;
$$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
