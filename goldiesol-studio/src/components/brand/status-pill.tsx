import { Badge } from '@/components/ui/badge';
import type { DesignStatus } from '@/lib/types';
import { humanise } from '@/lib/utils';

const variant: Record<DesignStatus, 'default' | 'gold' | 'rose' | 'muted'> = {
  idea: 'muted',
  in_design: 'rose',
  review: 'gold',
  approved: 'gold',
  sampling: 'default',
  production: 'default',
  archived: 'muted',
};

export function StatusPill({ status }: { status: DesignStatus }) {
  return <Badge variant={variant[status]}>{humanise(status)}</Badge>;
}
