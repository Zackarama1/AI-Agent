#!/usr/bin/env node
/**
 * Build a single self-contained HTML preview of the app in demo mode:
 * the web export with every script and the fonts it uses inlined.
 *   node scripts/build-preview.mjs  →  preview/collabify-preview.html
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '../..');
const OUT = join(ROOT, 'dist-preview');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT], {
  cwd: ROOT, stdio: 'inherit', env: { ...process.env, PREVIEW_BUILD: '1', EXPO_OFFLINE: '1', CI: '1', EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_ANON_KEY: '' },
});

const html = readFileSync(join(OUT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const chunks = readdirSync(join(OUT, '_expo/static/js/web'));
if (chunks.length !== scripts.length) throw new Error(`Expected only ${scripts.length} bundles, found ${chunks.length}: async routes still on?`);

// Fonts the app actually loads (Inter weights from the theme, plus the Ionicons icon font).
const FONT_RE = /\/assets\/node_modules\/(@expo-google-fonts\/inter\/(400Regular|600SemiBold|700Bold|800ExtraBold)\/[^"']+\.ttf|@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/Ionicons\.[^"']+\.ttf)/g;
const IMAGE_RE = /\/assets\/[^"']+\.(png|jpg|jpeg|gif|webp)/g;
const MIME = { ttf: 'font/ttf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const dataUri = (path) => `data:${MIME[path.split('.').pop()]};base64,${readFileSync(join(OUT, path)).toString('base64')}`;
let inlined = 0;
const missing = new Set();
const js = scripts.map((src) => {
  let code = readFileSync(join(OUT, src), 'utf8');
  code = code.replace(FONT_RE, (path) => {
    inlined++;
    return dataUri(path);
  });
  code = code.replace(IMAGE_RE, (path) => {
    if (existsSync(join(OUT, path))) return dataUri(path);
    missing.add(path); // referenced by a library but not part of the export
    return path;
  });
  return code.replace(/<\/script/gi, '<\\/script');
});
if (inlined < 5) throw new Error(`Only inlined ${inlined} font references`);

const page = `<title>Collabify App Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* Layout: the real app, full screen on phones and in a phone-sized frame on larger screens. */
  :root { --page: #ecebf3; --frame: #1d1d1f; --ink: #1d1d1f; --muted: #6e6e73; --accent: #5b3df5; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --page: #0b0a12; --frame: #2c2c2e; --ink: #f5f5f7; --muted: #98989d; --accent: #7b63ff; color-scheme: dark; } }
  :root[data-theme="dark"] { --page: #0b0a12; --frame: #2c2c2e; --ink: #f5f5f7; --muted: #98989d; --accent: #7b63ff; color-scheme: dark; }
  html, body { height: 100%; }
  body { background: var(--page); color: var(--ink); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .stage { box-sizing: border-box; height: 100%; display: flex; align-items: center; justify-content: center; gap: 48px; padding-block: 24px;
    padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  .phone { width: 393px; height: min(852px, 100%); border-radius: 48px; border: 12px solid var(--frame); overflow: hidden; display: flex; flex-shrink: 0;
    box-shadow: 0 30px 80px rgb(20 10 60 / 0.25); }
  #root { display: flex; flex: 1; height: 100%; }
  .notes { max-width: 300px; display: grid; gap: 14px; }
  .notes h1 { font-size: 34px; line-height: 1.05; letter-spacing: -0.03em; margin: 0; text-wrap: balance; }
  .notes p { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.5; }
  .notes b { color: var(--ink); }
  .notes .tag { color: var(--accent); font-weight: 700; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; }
  @media (max-width: 760px) {
    .stage { padding: 0; }
    .notes { display: none; }
    .phone { width: 100%; height: 100%; border: 0; border-radius: 0; box-shadow: none; }
  }
</style>
<div class="stage">
  <aside class="notes">
    <span class="tag">Demo mode</span>
    <h1>Collabify</h1>
    <p>This is the real app running on sample data. All businesses, people and projects are fictional, and no money moves.</p>
    <p>On the welcome screen, tap <b>Student · Maya</b>, <b>Business · Brewbox</b> or <b>Admin</b>. The 6-digit code appears on screen.</p>
    <p>Try hiring Maya for the account page as Brewbox, paying, then signing in as Maya to deliver. Reloading the page resets everything.</p>
  </aside>
  <div class="phone"><div id="root"></div></div>
</div>
<script>try { history.replaceState(null, '', '/'); } catch (e) {}</script>
${js.map((code) => `<script>${code}</script>`).join('\n')}
`;
mkdirSync(join(ROOT, 'preview'), { recursive: true });
const file = join(ROOT, 'preview', 'collabify-preview.html');
writeFileSync(file, page);
if (missing.size) console.log(`Not in the export (left as-is): ${[...missing].join(', ')}`);
console.log(`Wrote ${file} (${(page.length / 1048576).toFixed(1)} MB, ${inlined} font references inlined)`);
