import { EmptyState } from './empty-state';

// Placeholder for routes whose functionality lands in a later build phase (§12).
export function ComingInPhase({ phase, title, children }: { phase: number; title: string; children?: React.ReactNode }) {
  return (
    <EmptyState title={title}>
      <p>{children}</p>
      <p className="gs-label mt-4">Arrives in build phase {phase}</p>
    </EmptyState>
  );
}
