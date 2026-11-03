#!/usr/bin/env node
/**
 * Collabify go-live: sets up a real Supabase project and Stripe (test mode) from scratch,
 * and points the app at them. Safe to run again: it reuses what already exists.
 *
 *   SUPABASE_ACCESS_TOKEN=...  STRIPE_SECRET_KEY=sk_test_...  node scripts/go-live.mjs
 *
 * Optional: SUPABASE_PROJECT_REF (use an existing project), SUPABASE_ORG_ID, ANTHROPIC_API_KEY,
 * SUPABASE_REGION (default eu-west-2, London).
 *
 * Writes:
 *   .env        EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY for the app (safe to ship)
 *   .env.local  generated secrets (database password, webhook secret, cron secret): keep private
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = ['--yes', 'supabase@2.121.0'];
const LOCAL = join(ROOT, '.env.local');
const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'account.updated',
];
const PLANS = [
  { key: 'collabify_pro_monthly', name: 'Collabify Startup Pro', pence: 2900, env: 'STRIPE_PRICE_PRO' },
  { key: 'collabify_scale_monthly', name: 'Collabify Scale', pence: 9900, env: 'STRIPE_PRICE_SCALE' },
];

// ---------- helpers ----------
const step = (s) => console.log(`\n▸ ${s}`);
const fail = (s) => {
  console.error(`\n✖ ${s}`);
  process.exit(1);
};

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
}
function writeEnvFile(path, values, header) {
  writeFileSync(path, `${header}\n${Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n')}\n`, { mode: 0o600 });
}

function supabase(args, { json = false, input } = {}) {
  const out = execFileSync('npx', [...CLI, ...args, ...(json ? ['--output-format', 'json'] : [])], {
    cwd: ROOT, encoding: 'utf8', input, stdio: [input ? 'pipe' : 'inherit', 'pipe', 'inherit'],
  });
  return json ? JSON.parse(out) : out;
}

async function stripe(method, path, params) {
  const body = params ? new URLSearchParams(flatten(params)).toString() : undefined;
  const url = `https://api.stripe.com/v1${path}${method === 'GET' && body ? `?${body}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body,
  });
  const json = await res.json();
  if (!res.ok) fail(`Stripe ${path}: ${json.error?.message ?? res.status}`);
  return json;
}
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? flatten(item, `${key}[${i}]`, out) : (out[`${key}[${i}]`] = String(item))));
    else if (typeof v === 'object') flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

/** Pick a key from `supabase projects api-keys` output, whichever format the CLI returns. */
function pickKey(keys, kinds) {
  const list = Array.isArray(keys) ? keys : keys.keys ?? Object.values(keys);
  for (const kind of kinds) {
    const hit = list.find((k) => [k.name, k.type, k.id].some((v) => typeof v === 'string' && v.toLowerCase() === kind));
    if (hit?.api_key) return hit.api_key;
  }
  return null;
}

// ---------- 0. inputs ----------
const local = readEnvFile(LOCAL);
if (!process.env.SUPABASE_ACCESS_TOKEN) fail('Set SUPABASE_ACCESS_TOKEN (supabase.com → Account → Access Tokens).');
if (!process.env.STRIPE_SECRET_KEY) fail('Set STRIPE_SECRET_KEY (Stripe dashboard → Developers → API keys, test mode).');
if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') && !process.argv.includes('--live')) {
  fail('STRIPE_SECRET_KEY is not a test key. Use test mode first, or pass --live when you really mean it.');
}

// ---------- 1. Supabase project ----------
let ref = process.env.SUPABASE_PROJECT_REF || local.SUPABASE_PROJECT_REF;
const dbPassword = local.SUPABASE_DB_PASSWORD || randomBytes(18).toString('base64url');
if (!ref) {
  step('Creating Supabase project "collabify" (London)…');
  const orgs = supabase(['orgs', 'list'], { json: true });
  const orgId = process.env.SUPABASE_ORG_ID || (Array.isArray(orgs) ? orgs[0]?.id : undefined);
  if (!orgId) fail('No Supabase organisation found. Create one at supabase.com, or set SUPABASE_ORG_ID.');
  const project = supabase(['projects', 'create', 'collabify', '--org-id', orgId, '--db-password', dbPassword, '--region', process.env.SUPABASE_REGION || 'eu-west-2'], { json: true });
  ref = project.ref ?? project.id;
  if (!ref) fail(`Could not read the new project's ref from: ${JSON.stringify(project)}`);
  console.log(`  project ref: ${ref} (it can take a couple of minutes to finish provisioning)`);
}
Object.assign(local, { SUPABASE_PROJECT_REF: ref, SUPABASE_DB_PASSWORD: dbPassword });
writeEnvFile(LOCAL, local, '# Generated by scripts/go-live.mjs. Private: never commit or share.');
const projectUrl = `https://${ref}.supabase.co`;

step('Linking and applying database migrations…');
for (let attempt = 1; ; attempt++) {
  try {
    supabase(['link', '--project-ref', ref, '--password', dbPassword]);
    break;
  } catch (e) {
    if (attempt >= 10) throw e;
    console.log('  project still starting, retrying in 30s…');
    await new Promise((r) => setTimeout(r, 30000));
  }
}
supabase(['db', 'push', '--linked', '--password', dbPassword]);

step('Configuring sign-in emails (6-digit codes)…');
supabase(['config', 'push', '--project-ref', ref]);

// ---------- 2. Stripe ----------
step('Setting up Stripe products, prices, billing portal and webhook…');
const prices = {};
for (const plan of PLANS) {
  const existing = await stripe('GET', '/prices', { lookup_keys: [plan.key], active: true });
  let price = existing.data[0];
  if (!price) {
    const product = await stripe('POST', '/products', { name: plan.name });
    price = await stripe('POST', '/prices', {
      product: product.id, currency: 'gbp', unit_amount: plan.pence, recurring: { interval: 'month' }, lookup_key: plan.key,
    });
  }
  prices[plan.env] = price.id;
  console.log(`  ${plan.name}: ${price.id}`);
}

if (!local.STRIPE_PORTAL_CONFIG) {
  const products = await Promise.all(PLANS.map(async (p) => {
    const price = await stripe('GET', `/prices/${prices[p.env]}`);
    return { product: price.product, prices: [price.id] };
  }));
  const portal = await stripe('POST', '/billing_portal/configurations', {
    business_profile: { headline: 'Manage your Collabify plan' },
    features: {
      subscription_update: { enabled: true, default_allowed_updates: ['price'], products, proration_behavior: 'create_prorations' },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  });
  local.STRIPE_PORTAL_CONFIG = portal.id;
}

const webhookUrl = `${projectUrl}/functions/v1/stripe-webhook`;
const hooks = await stripe('GET', '/webhook_endpoints', { limit: 100 });
const existingHook = hooks.data.find((h) => h.url === webhookUrl);
if (!existingHook || !local.STRIPE_WEBHOOK_SECRET) {
  // Stripe only reveals a webhook's signing secret when it's created, so recreate it if we lost it.
  if (existingHook) await stripe('DELETE', `/webhook_endpoints/${existingHook.id}`);
  const hook = await stripe('POST', '/webhook_endpoints', { url: webhookUrl, enabled_events: WEBHOOK_EVENTS });
  local.STRIPE_WEBHOOK_SECRET = hook.secret;
}
local.CRON_SECRET ||= randomBytes(24).toString('base64url');
local.PUSH_SECRET ||= randomBytes(24).toString('base64url');
writeEnvFile(LOCAL, local, '# Generated by scripts/go-live.mjs. Private: never commit or share.');

// ---------- 3. Edge Functions ----------
step('Setting function secrets and deploying Edge Functions…');
const secrets = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: local.STRIPE_WEBHOOK_SECRET,
  STRIPE_PORTAL_CONFIG: local.STRIPE_PORTAL_CONFIG,
  CRON_SECRET: local.CRON_SECRET,
  PUSH_SECRET: local.PUSH_SECRET,
  ...prices,
  ...(process.env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : {}),
};
const secretsFile = join(ROOT, '.env.functions.tmp');
writeEnvFile(secretsFile, secrets, '# temporary');
try {
  supabase(['secrets', 'set', '--project-ref', ref, '--env-file', secretsFile]);
} finally {
  writeFileSync(secretsFile, '');
  execFileSync('rm', ['-f', secretsFile]);
}
supabase(['functions', 'deploy', '--project-ref', ref, '--use-api']);

// ---------- 4. App config + daily auto-release ----------
step('Fetching API keys, scheduling daily auto-release and turning on push notifications…');
const keys = supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal'], { json: true });
const anonKey = pickKey(keys, ['publishable', 'anon']);
const serviceKey = pickKey(keys, ['secret', 'service_role']);
if (!anonKey || !serviceKey) fail(`Could not find the project's API keys in: ${JSON.stringify(keys).slice(0, 300)}…`);

async function rpc(name, args) {
  const res = await fetch(`${projectUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) fail(`${name} failed: ${res.status} ${await res.text()}`);
}
await rpc('schedule_auto_release', { p_url: `${projectUrl}/functions/v1/auto-release`, p_secret: local.CRON_SECRET });
await rpc('configure_push', { p_url: `${projectUrl}/functions/v1/send-push`, p_secret: local.PUSH_SECRET });

writeEnvFile(join(ROOT, '.env'), { EXPO_PUBLIC_SUPABASE_URL: projectUrl, EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey },
  '# Public app config written by scripts/go-live.mjs (the anon key is safe to ship in the app).');

console.log(`
✔ Collabify is live on ${projectUrl} with Stripe in ${process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE'} mode.

Restart the app (npx expo start) and it will use the real back end instead of demo data.

Still to do by hand (Stripe and Supabase don't allow these through the API):
  1. Stripe dashboard → Connect → get started: choose Express accounts, country United Kingdom.
  2. Supabase → Authentication → Emails → SMTP: add your own email provider (the built-in one is rate-limited).
  3. Make yourself an admin (SQL editor): update profiles set role = 'admin' where id = '<your user id>';
  4. For push notifications on phones: run \`npx eas-cli@latest init\` once (adds the EAS project id the app needs).
`);
