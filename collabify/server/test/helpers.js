import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

export async function startTestServer() {
  const db = openDatabase(':memory:');
  const emails = [];
  const app = createApp(db, { rateLimits: false, sendEmail: async (m) => emails.push(m) });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, emails, base, close: () => new Promise((r) => server.close(r)) };
}

/** A tiny cookie-keeping client per user. */
export function client(base) {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b),
  };
}

export const FAKE_KEY = 'x'.repeat(40);
