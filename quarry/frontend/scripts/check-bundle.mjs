// Fails the build if anything resembling a credential ended up in the shipped bundle.
// The browser never talks to data providers directly, so no key should ever be here.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{10,}/,
  /(?:api[_-]?key|apikey|token|secret)["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
  /APCA-API-(?:KEY-ID|SECRET-KEY)/,
];
// Exact values of any provider keys present in the build environment.
const KEY_ENV = /(_API_KEY|_API_KEY_ID|_SECRET_KEY|_API_TOKEN)$/;
const literals = Object.entries(process.env)
  .filter(([k, v]) => KEY_ENV.test(k) && v && v.length >= 8)
  .map(([, v]) => v);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css|html|json|webmanifest)$/.test(name)) files.push(p);
  }
};
walk(DIST);

const hits = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  for (const re of PATTERNS) if (re.test(text)) hits.push(`${f}: matches ${re}`);
  for (const v of literals)
    if (text.includes(v)) hits.push(`${f}: contains a configured key value`);
}
if (hits.length) {
  console.error("Possible secrets in the frontend bundle:\n" + hits.join("\n"));
  process.exit(1);
}
console.log(`check-bundle: ${files.length} files clean`);
