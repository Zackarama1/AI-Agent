-- Goldiesol Studio — Phase 1 foundation schema
-- Team-scoped RLS on every table. Nothing user-authored is ever hard-deleted:
-- designs, versions, notes and tech packs have no DELETE policy (archive only).

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','designer','viewer')) default 'designer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (team_id, user_id)
);

-- Emails allowed to join a team on sign-up (Goldiesol Studio is internal).
create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','designer','viewer')) default 'designer',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (team_id, email)
);

-- security definer so RLS policies can call it without recursing into team_members' own policy
create or replace function public.is_team_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = t and user_id = auth.uid());
$$;

-- The caller's team. Used as the column default so inserts don't have to pass team_id.
create or replace function public.current_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select team_id from public.team_members where user_id = auth.uid() order by created_at limit 1;
$$;

-- On sign-up: the very first user becomes owner of the Goldiesol team;
-- anyone after that must have a pending invite, otherwise they get no team (and see nothing).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  goldiesol_team uuid;
  invite record;
begin
  select id into goldiesol_team from public.teams order by created_at limit 1;
  if goldiesol_team is null then
    insert into public.teams (name) values ('Goldiesol') returning id into goldiesol_team;
  end if;

  if not exists (select 1 from public.team_members) then
    insert into public.team_members (team_id, user_id, role) values (goldiesol_team, new.id, 'owner');
    return new;
  end if;

  for invite in
    select * from public.team_invites where lower(email) = lower(new.email) and accepted_at is null
  loop
    insert into public.team_members (team_id, user_id, role) values (invite.team_id, new.id, invite.role)
      on conflict do nothing;
    update public.team_invites set accepted_at = now() where id = invite.id;
  end loop;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Domain tables (ordered so foreign keys resolve)
-- ---------------------------------------------------------------------------

create table public.brand_dna (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  mission text,
  aesthetic_keywords text[] not null default '{}',
  never_do text[] not null default '{}',
  target_customer text,
  price_positioning text,
  reference_brands text[] not null default '{}',   -- benchmarks for positioning, never designs to copy
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  name text not null,
  season text,
  description text,
  cover_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  kind text not null check (kind in ('factory','platform')) default 'factory',
  name text not null,
  country text,
  city text,
  lat numeric,
  lng numeric,
  website text,
  specialties text[] not null default '{}',
  moq_per_style int,
  moq_per_order int,
  sample_moq int,
  sample_lead_days int,
  bulk_lead_days int,
  price_tier text check (price_tier in ('$','$$','$$$')),
  certifications text[] not null default '{}',
  stage text not null check (stage in ('researching','contacted','replied','call_booked','sampling','quoted','approved','rejected')) default 'researching',
  rating int check (rating between 1 and 5),
  notes text,
  source_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.shapes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  kind text not null check (kind in ('top','bottom','one_piece','cover_up')),
  base_template text not null,
  custom_name text not null,
  params jsonb not null,
  thumbnail_url text,
  is_favourite boolean not null default false,
  times_used int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  unique (team_id, custom_name)
);

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  name text not null,
  status text not null check (status in ('idea','in_design','review','approved','sampling','production','archived')) default 'idea',
  category text check (category in ('bikini','one_piece','monokini','tankini','cover_up')),
  collection_id uuid references public.collections(id),
  top_shape_id uuid references public.shapes(id),
  bottom_shape_id uuid references public.shapes(id),
  brief jsonb,
  current_version_id uuid,
  tags text[] not null default '{}',
  score jsonb,
  embedding vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.design_versions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  design_id uuid not null references public.designs(id) on delete cascade,
  version_number int not null,
  canvas jsonb not null,
  svg_snapshot text,
  png_url text,
  change_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  unique (design_id, version_number)
);

alter table public.designs
  add constraint designs_current_version_fk
  foreign key (current_version_id) references public.design_versions(id) deferrable initially deferred;

create table public.design_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  design_id uuid not null references public.designs(id) on delete cascade,
  version_id uuid references public.design_versions(id),
  type text not null check (type in ('note','feedback','change_request','ai_feedback','supplier_feedback')),
  body text not null,
  anchor jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  type text not null check (type in ('main_fabric','lining','lace','mesh','trim','elastic','hardware','bead','thread','padding','label')),
  name text not null,
  composition text,
  weight_gsm int,
  supplier_id uuid references public.suppliers(id),
  swatch_url text,
  colourways text[] not null default '{}',
  price_per_unit numeric,
  unit text,
  chlorine_resistant boolean,
  uv_rating text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.colours (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  name text not null,
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  pantone_code text,          -- entered by the team from their own licensed Pantone source (§9.3)
  pantone_system text check (pantone_system in ('TCX','TPG')),
  palette text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.size_chart (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  size_label text not null,
  sort_order int not null default 0,
  bust_cm numeric,
  underbust_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  torso_cm numeric,
  cup text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text,
  role text,
  email text,
  whatsapp text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.outreach_log (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  supplier_id uuid references public.suppliers(id),
  design_id uuid references public.designs(id),
  channel text,
  direction text check (direction in ('outbound','inbound')),
  subject text,
  body text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  supplier_id uuid references public.suppliers(id),
  design_id uuid references public.designs(id),
  unit_price numeric,
  currency text,
  moq int,
  lead_days int,
  sample_cost numeric,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.tech_packs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  design_id uuid references public.designs(id),
  version_id uuid references public.design_versions(id),
  data jsonb,
  pdf_url text,
  sent_to_supplier_id uuid references public.suppliers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.taste_profile (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  statement text not null,
  evidence_design_ids uuid[] not null default '{}',
  confidence numeric check (confidence between 0 and 1),
  source text check (source in ('explicit','observed')),
  active boolean not null default true,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

create table public.trend_signals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default public.current_team_id() references public.teams(id),
  source text,
  region text,
  keyword text,
  category text,
  metric text,
  value numeric,
  direction text check (direction in ('rising','falling','stable')),
  captured_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index designs_team_status_idx on public.designs (team_id, status);
create index designs_collection_idx on public.designs (collection_id);
create index designs_updated_idx on public.designs (team_id, updated_at desc);
create index designs_embedding_idx on public.designs using hnsw (embedding vector_cosine_ops);
create index design_versions_design_idx on public.design_versions (design_id, version_number desc);
create index design_notes_design_idx on public.design_notes (design_id);
create index shapes_team_kind_idx on public.shapes (team_id, kind, times_used desc);
create index materials_team_type_idx on public.materials (team_id, type);
create index suppliers_team_stage_idx on public.suppliers (team_id, stage);
create index trend_signals_lookup_idx on public.trend_signals (team_id, region, category, captured_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers + RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  domain_tables text[] := array[
    'brand_dna','collections','suppliers','shapes','designs','design_versions','design_notes',
    'materials','colours','size_chart','supplier_contacts','outreach_log','quotes','tech_packs',
    'taste_profile','trend_signals'
  ];
  -- archive-only tables: no delete policy
  no_delete text[] := array['designs','design_versions','design_notes','tech_packs','collections','outreach_log'];
begin
  foreach t in array domain_tables || array['teams','team_members','team_invites'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array domain_tables loop
    execute format('create policy %I on public.%I for select using (public.is_team_member(team_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (public.is_team_member(team_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id))', t || '_update', t);
    if not (t = any(no_delete)) then
      execute format('create policy %I on public.%I for delete using (public.is_team_member(team_id))', t || '_delete', t);
    end if;
  end loop;
end $$;

create policy teams_select on public.teams for select using (public.is_team_member(id));
create policy team_members_select on public.team_members for select using (public.is_team_member(team_id));
create policy team_invites_select on public.team_invites for select using (public.is_team_member(team_id));
create policy team_invites_insert on public.team_invites for insert with check (
  exists (select 1 from public.team_members m where m.team_id = team_invites.team_id and m.user_id = auth.uid() and m.role = 'owner')
);

-- ---------------------------------------------------------------------------
-- Storage buckets (private; objects are keyed "<team_id>/...")
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('design-renders','design-renders',false),
  ('swatches','swatches',false),
  ('inspiration','inspiration',false),
  ('techpacks','techpacks',false),
  ('model-renders','model-renders',false)
on conflict (id) do nothing;

create policy "team members read studio files" on storage.objects for select using (
  bucket_id in ('design-renders','swatches','inspiration','techpacks','model-renders')
  and public.is_team_member(((storage.foldername(name))[1])::uuid)
);
create policy "team members write studio files" on storage.objects for insert with check (
  bucket_id in ('design-renders','swatches','inspiration','techpacks','model-renders')
  and public.is_team_member(((storage.foldername(name))[1])::uuid)
);
create policy "team members update studio files" on storage.objects for update using (
  bucket_id in ('design-renders','swatches','inspiration','techpacks','model-renders')
  and public.is_team_member(((storage.foldername(name))[1])::uuid)
);
