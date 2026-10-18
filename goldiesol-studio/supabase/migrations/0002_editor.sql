-- Phase 2: editor support.

-- Atomic "times used" bump for the Shape Library (favourites sort by it).
-- security invoker: RLS still limits it to the caller's team's shapes.
create or replace function public.increment_shape_use(shape_ids uuid[])
returns void language sql security invoker set search_path = public as $$
  update public.shapes set times_used = times_used + 1 where id = any(shape_ids);
$$;

grant execute on function public.increment_shape_use(uuid[]) to authenticated;
