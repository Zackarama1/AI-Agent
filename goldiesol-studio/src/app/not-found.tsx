import Link from 'next/link';
import { EmptyState } from '@/components/brand/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4">
      <EmptyState
        className="w-full"
        title="This piece isn't in the atelier"
        action={<Button asChild variant="primary"><Link href="/">Back to the studio</Link></Button>}
      >
        It may have moved, or the link is incomplete.
      </EmptyState>
    </main>
  );
}
