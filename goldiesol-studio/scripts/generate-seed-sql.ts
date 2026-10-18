// Regenerates supabase/seed.sql from the TypeScript seed in src/lib/seed.
// Usage: npm run db:seed-sql
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSeedSql } from '../src/lib/seed/sql';

const out = join(__dirname, '..', 'supabase', 'seed.sql');
writeFileSync(out, buildSeedSql());
console.log(`Wrote ${out}`);
