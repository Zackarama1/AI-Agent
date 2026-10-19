// Builds the browser-only preview into dist/preview: index.html (page + inline
// CSS) and app.js. Usage: node scripts/preview/build.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwind from '@tailwindcss/postcss';
import esbuild from 'esbuild';
import postcss from 'postcss';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const out = join(root, 'dist/preview');
mkdirSync(out, { recursive: true });

const shim = (f) => join(here, 'shims', f);
const ALIASES = {
  'next/link': shim('next-link.tsx'),
  'next/navigation': shim('next-navigation.ts'),
  'next/cache': shim('next-cache.ts'),
  'next/headers': shim('next-headers.ts'),
  'server-only': shim('empty.ts'),
  'node:crypto': shim('node-crypto.ts'),
  '@/lib/data': shim('data.ts'),
  '@/lib/supabase/server': shim('supabase-server.ts'),
};

const aliasPlugin = {
  name: 'aliases',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (ALIASES[args.path]) return { path: ALIASES[args.path] };
      if (args.path.startsWith('@/')) return build.resolve('./src/' + args.path.slice(2), { resolveDir: root, kind: args.kind });
      return undefined;
    });
  },
};

await esbuild.build({
  entryPoints: [join(here, 'entry.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  jsx: 'automatic',
  outfile: join(out, 'app.js'),
  plugins: [aliasPlugin],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_SUPABASE_URL': '""',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '""',
    'process.env.NEXT_PUBLIC_GS_PREVIEW': '"1"',
    'process.env': '{}',
  },
  legalComments: 'none',
  logLevel: 'warning',
});

const globals = readFileSync(join(root, 'src/app/globals.css'), 'utf8');
const css = await postcss([tailwind({ base: root })]).process(globals, { from: join(root, 'src/app/globals.css') });

writeFileSync(
  join(out, 'index.html'),
  `<title>Goldiesol Studio</title>
<meta name="description" content="Goldiesol Studio preview">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Manrope:wght@400;500;600;700&display=swap">
<style>
:root { --font-cormorant: 'Cormorant Garamond', Georgia, serif; --font-manrope: 'Manrope', system-ui, sans-serif; }
${css.css}
</style>
<div id="studio"></div>
<script src="app.js"></script>
`,
);
console.log(`Wrote ${out}`);
