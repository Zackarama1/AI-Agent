import Link from 'next/link';
import { LaceWatermark } from '@/components/brand/lace';
import { Wordmark } from '@/components/brand/wordmark';
import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/lib/env';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = '/', error } = await searchParams;
  const demo = !isSupabaseConfigured();

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-blush px-4">
      <LaceWatermark />
      <div className="relative w-full max-w-sm rounded-[20px] border border-line bg-surface p-8 shadow-soft">
        <Wordmark className="mb-8" />
        <h1 className="font-display text-3xl">Welcome to the atelier</h1>
        <p className="mb-6 mt-1 text-sm text-mist">Sign in with your Goldiesol email — no password needed.</p>
        {error && <p className="mb-4 text-sm text-[#9B1B30]" role="alert">That sign-in link has expired. Request a new one.</p>}
        {demo ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-mist">The studio is running in demo mode on seed data, so no sign-in is needed.</p>
            <Button asChild variant="primary" size="lg"><Link href="/">Enter the studio</Link></Button>
          </div>
        ) : (
          <LoginForm next={next} />
        )}
      </div>
    </div>
  );
}
