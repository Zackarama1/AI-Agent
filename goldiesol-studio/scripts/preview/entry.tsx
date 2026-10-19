// Browser-only build of Goldiesol Studio for a shareable preview link. It runs
// the real page components against the in-memory demo repository; there is no
// server, so work lives only in this tab.
import { useEffect, useState, useSyncExternalStore, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import EditorPage from '@/app/(editor)/designs/[id]/page';
import NotFound from '@/app/not-found';
import CollectionPage from '@/app/(studio)/collections/[id]/page';
import CollectionsPage from '@/app/(studio)/collections/page';
import ColoursPage from '@/app/(studio)/colours/page';
import ComparePage from '@/app/(studio)/designs/compare/page';
import ModelPage from '@/app/(studio)/designs/[id]/model/page';
import TechPackPage from '@/app/(studio)/designs/[id]/techpack/page';
import NewDesignPage from '@/app/(studio)/designs/new/page';
import DesignsPage from '@/app/(studio)/designs/page';
import InsightsPage from '@/app/(studio)/insights/page';
import MaterialsPage from '@/app/(studio)/materials/page';
import HomePage from '@/app/(studio)/page';
import SettingsPage from '@/app/(studio)/settings/page';
import NewShapePage from '@/app/(studio)/shapes/new/page';
import ShapesPage from '@/app/(studio)/shapes/page';
import SupplierPage from '@/app/(studio)/suppliers/[id]/page';
import SuppliersPage from '@/app/(studio)/suppliers/page';
import { AppShell } from '@/components/shell/app-shell';
import { NOT_FOUND, REDIRECT, router } from './router';

type Page = (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => ReactElement | Promise<ReactElement>;

// Page components take differently-typed params; the router passes { id } when the path has one.
const page = (p: unknown) => p as Page;

// Order matters: static segments before dynamic ones, as in Next.js.
const ROUTES: [RegExp, Page, { shell: boolean }][] = [
  [/^\/$/, page(HomePage), { shell: true }],
  [/^\/designs$/, page(DesignsPage), { shell: true }],
  [/^\/designs\/new$/, page(NewDesignPage), { shell: true }],
  [/^\/designs\/compare$/, page(ComparePage), { shell: true }],
  [/^\/designs\/([^/]+)\/model$/, page(ModelPage), { shell: true }],
  [/^\/designs\/([^/]+)\/techpack$/, page(TechPackPage), { shell: true }],
  [/^\/designs\/([^/]+)$/, page(EditorPage), { shell: false }],
  [/^\/shapes$/, page(ShapesPage), { shell: true }],
  [/^\/shapes\/new$/, page(NewShapePage), { shell: true }],
  [/^\/materials$/, page(MaterialsPage), { shell: true }],
  [/^\/colours$/, page(ColoursPage), { shell: true }],
  [/^\/insights$/, page(InsightsPage), { shell: true }],
  [/^\/suppliers$/, page(SuppliersPage), { shell: true }],
  [/^\/suppliers\/([^/]+)$/, page(SupplierPage), { shell: true }],
  [/^\/collections$/, page(CollectionsPage), { shell: true }],
  [/^\/collections\/([^/]+)$/, page(CollectionPage), { shell: true }],
  [/^\/settings$/, page(SettingsPage), { shell: true }],
];

async function resolve(href: string): Promise<ReactElement> {
  const [pathname, query = ''] = href.split('?');
  const searchParams = Object.fromEntries(new URLSearchParams(query));
  for (const [pattern, Page, { shell }] of ROUTES) {
    const m = pathname.match(pattern);
    if (!m) continue;
    try {
      const el = await Page({ params: Promise.resolve<Record<string, string>>(m[1] ? { id: m[1] } : {}), searchParams: Promise.resolve(searchParams) });
      return shell ? <AppShell>{el}</AppShell> : el;
    } catch (e) {
      if ((e as { digest?: string }).digest === NOT_FOUND) return <NotFound />;
      throw e;
    }
  }
  return <NotFound />;
}

function App() {
  const revision = useSyncExternalStore(router.subscribe, () => router.revision);
  const [page, setPage] = useState<ReactElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    resolve(router.path).then(
      (el) => live && (setPage(el), setError(null)),
      (e) => live && setError(String(e?.message ?? e)),
    );
    return () => {
      live = false;
    };
  }, [revision]);

  if (error) return <p style={{ padding: 24 }}>Something went wrong: {error}</p>;
  return page;
}

// redirect() inside an action navigates, then throws to stop the action, as in Next.js.
window.addEventListener('unhandledrejection', (e) => {
  if (String((e.reason as { digest?: string })?.digest ?? '').startsWith(REDIRECT)) e.preventDefault();
});

const start = location.hash.replace(/^#/, '');
if (/^[a-z-]+$/.test(start)) router.navigate(`/${start}`);
createRoot(document.getElementById('studio')!).render(<App />);
