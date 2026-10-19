import { isSupabaseConfigured } from '@/lib/env';
import { MobileNav, Sidebar } from './sidebar';
import { UserMenu } from './user-menu';

export function AppShell({ children }: { children: React.ReactNode }) {
  const demo = !isSupabaseConfigured();
  const footer = <UserMenu demo={demo} />;
  return (
    <div className="flex min-h-dvh">
      <Sidebar footer={footer} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav footer={footer} />
        {demo && (
          <div className="border-b border-line bg-blush px-4 py-2 text-center text-xs text-mist" role="status">
            {process.env.NEXT_PUBLIC_GS_PREVIEW ? (
              <>
                <span className="gs-label mr-2 text-gold-deep">Preview</span>
                Your changes stay until you reload this page.
              </>
            ) : (
              <>
                <span className="gs-label mr-2 text-gold-deep">Demo mode</span>
                Running on Goldiesol seed data — connect Supabase in <code>.env.local</code> to save your work.
              </>
            )}
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-12">{children}</main>
      </div>
    </div>
  );
}
