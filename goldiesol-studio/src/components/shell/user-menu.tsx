import { LogOut } from 'lucide-react';
import { signOut } from '@/app/login/actions';

export function UserMenu({ demo }: { demo: boolean }) {
  if (demo) return <span className="text-xs text-mist">Demo studio</span>;
  return (
    <form action={signOut}>
      <button type="submit" className="flex items-center gap-2 text-xs text-mist hover:text-ink">
        <LogOut className="size-3.5" /> Sign out
      </button>
    </form>
  );
}
