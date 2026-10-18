import { createHash } from 'node:crypto';

// Deterministic UUIDs so seed rows can reference each other and `supabase/seed.sql`
// is stable across regenerations. Formatted as RFC 4122 v5-style (SHA-1 based).
export function seedId(key: string): string {
  const h = createHash('sha1').update(`goldiesol-seed:${key}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export const SEED_TEAM_ID = '00000000-0000-4000-8000-000000000001';
export const SEED_TIME = '2026-10-01T09:00:00.000Z';

export const rowMeta = (key: string) => ({ id: seedId(key), created_at: SEED_TIME, updated_at: SEED_TIME });
