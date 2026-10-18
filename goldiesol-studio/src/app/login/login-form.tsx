'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendMagicLink, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: 'idle' });

  if (state.status === 'sent') {
    return <p className="text-sm text-ink" role="status">{state.message} Open it on this device to enter the studio.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="gs-label">Email</label>
      <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@goldiesol.com" />
      {state.status === 'error' && <p className="text-sm text-[#9B1B30]" role="alert">{state.message}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-2">
        {pending ? 'Sending…' : 'Send me a sign-in link'}
      </Button>
    </form>
  );
}
