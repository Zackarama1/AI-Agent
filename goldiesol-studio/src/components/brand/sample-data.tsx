import { Badge } from '@/components/ui/badge';

// §13: anything not backed by a live provider is labelled.
export function SampleDataBadge({ children = 'Sample data' }: { children?: React.ReactNode }) {
  return <Badge variant="gold">{children}</Badge>;
}
