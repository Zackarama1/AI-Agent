// Runs the real migration + generated seed against in-process Postgres (PGlite),
// with minimal stand-ins for the Supabase `auth` and `storage` schemas.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { vector } from '@electric-sql/pglite/vector';
import { beforeAll, describe, expect, it } from 'vitest';
import { seed } from '@/lib/seed';
import { buildSeedSql } from '@/lib/seed/sql';

const SUPABASE_STUBS = `
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
`;

const FOUNDER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: PGlite;

async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

beforeAll(async () => {
  db = new PGlite({ extensions: { vector, pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  const dir = join(__dirname, '../../supabase/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  await db.exec(buildSeedSql());
  await db.exec(`grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;`);
  // First sign-up becomes owner of the seeded Goldiesol team; a later uninvited one gets nothing.
  await db.exec(`insert into auth.users (id, email) values ('${FOUNDER}', 'founder@example.com');`);
  await db.exec(`insert into auth.users (id, email) values ('${STRANGER}', 'stranger@example.com');`);
}, 60000);

describe('foundation migration + seed', () => {
  it('loads every seeded row', async () => {
    for (const [table, rows] of Object.entries(seed)) {
      const { rows: [r] } = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
      expect(r.n, table).toBe(rows.length);
    }
  });

  it('makes the first user owner of the seeded team', async () => {
    const { rows } = await db.query<{ user_id: string; role: string }>('select user_id, role from public.team_members');
    expect(rows).toEqual([{ user_id: FOUNDER, role: 'owner' }]);
  });

  it('scopes reads to team members', async () => {
    const founderSees = await asUser(FOUNDER, () => db.query('select id from public.designs'));
    const strangerSees = await asUser(STRANGER, () => db.query('select id from public.designs'));
    expect(founderSees.rows.length).toBe(1);
    expect(strangerSees.rows.length).toBe(0);
  });

  it('defaults team_id on insert and blocks hard deletes of designs', async () => {
    await asUser(FOUNDER, async () => {
      const { rows: [d] } = await db.query<{ id: string; team_id: string }>(
        `insert into public.designs (name, category) values ('Test Piece', 'bikini') returning id, team_id`,
      );
      expect(d.team_id).toBe('00000000-0000-4000-8000-000000000001');
      const del = await db.query(`delete from public.designs where id = $1`, [d.id]);
      expect(del.affectedRows).toBe(0);
    });
  });

  it('bumps shape usage only within the caller\'s team', async () => {
    const { rows: [shape] } = await db.query<{ id: string; times_used: number }>(`select id, times_used from public.shapes where custom_name = 'Goldie Lace Tri'`);
    await asUser(STRANGER, () => db.query('select public.increment_shape_use($1)', [[shape.id]]));
    await asUser(FOUNDER, () => db.query('select public.increment_shape_use($1)', [[shape.id]]));
    const { rows: [after] } = await db.query<{ times_used: number }>('select times_used from public.shapes where id = $1', [shape.id]);
    expect(after.times_used).toBe(shape.times_used + 1);
  });

  it('allows deleting non-archival rows like shapes', async () => {
    await asUser(FOUNDER, async () => {
      await db.query(`insert into public.shapes (kind, base_template, custom_name, params) values ('top','triangle','Temp Tri','{}')`);
      const del = await db.query(`delete from public.shapes where custom_name = 'Temp Tri'`);
      expect(del.affectedRows).toBe(1);
    });
  });
});
