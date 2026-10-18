import { Badge } from '@/components/ui/badge';

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? <Badge variant="gold">Terms verified</Badge> : <Badge variant="rose">Terms unverified</Badge>;
}
