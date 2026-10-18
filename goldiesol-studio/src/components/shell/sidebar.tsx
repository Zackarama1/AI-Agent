'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Wordmark } from '@/components/brand/wordmark';
import { cn } from '@/lib/utils';
import { isActive, NAV_ITEMS } from './nav-items';
import { ThemeToggle } from './theme-toggle';

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Studio">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
              active ? 'bg-rose/45 font-semibold text-ink' : 'text-mist hover:bg-blush hover:text-ink',
            )}
          >
            <Icon className={cn('size-[18px]', active ? 'text-gold-deep' : '')} strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/70 px-4 py-6 backdrop-blur lg:flex">
      <Link href="/" className="mb-8 px-2">
        <Wordmark />
      </Link>
      <NavLinks />
      <div className="mt-auto flex flex-col gap-3 px-2">
        <div className="gs-divider" />
        <div className="flex items-center justify-between">
          {footer}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ footer }: { footer?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-ivory/90 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/">
          <Wordmark subtitle={false} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full p-2 text-ink hover:bg-blush"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line px-4 pb-4 pt-2">
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="mt-3 flex items-center justify-between px-3">
            {footer}
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
