import { router } from 'expo-router';
import { ContractPill } from '@/components/domain';
import { Card, Empty, Gap, Heading, Label, Loading, Money, Muted, Pill, Row, Screen } from '@/components/ui';
import { APPLICATION_LABEL, daysUntil } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { space } from '@/theme';

export default function MyWork() {
  const { data: contracts } = useQuery((api) => api.listMyContracts());
  const { data: applications } = useQuery((api) => api.listMyApplications());
  const earned = contracts?.filter((c) => c.status === 'released').reduce((s, c) => s + c.amountPence, 0) ?? 0;
  const held = contracts?.filter((c) => ['funded', 'delivered'].includes(c.status)).reduce((s, c) => s + c.amountPence, 0) ?? 0;
  const pendingApps = applications?.filter((a) => a.status !== 'hired') ?? [];

  if (!contracts || !applications) return <Screen title="My work"><Loading /></Screen>;
  return (
    <Screen title="My work">
      <Row gap={space.md} style={{ marginBottom: space.xl }}>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <Label>Earned</Label>
          <Money pence={earned} size={28} />
        </Card>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <Label>Payment held</Label>
          <Money pence={held} size={28} />
        </Card>
      </Row>

      <Heading style={{ marginBottom: space.md }}>Projects</Heading>
      {contracts.length === 0 ? (
        <Empty icon="briefcase-outline" title="No projects yet" text="When a business hires you, it shows up here." />
      ) : (
        contracts.map((c) => (
          <Card key={c.id} onPress={() => router.push(`/contract/${c.id}`)} testID={`contract-${c.id}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <ContractPill status={c.status} />
              <Money pence={c.amountPence} />
            </Row>
            <Heading style={{ marginTop: space.md }}>{c.projectTitle}</Heading>
            <Muted>{c.companyName}</Muted>
            {c.status === 'funded' ? <Muted style={{ marginTop: space.sm }}>Payment is held. Deliver when you&apos;re ready.</Muted> : null}
            {c.status === 'delivered' && c.autoReleaseAt ? <Muted style={{ marginTop: space.sm }}>Paid automatically in {daysUntil(c.autoReleaseAt)} days if not approved sooner.</Muted> : null}
          </Card>
        ))
      )}

      <Gap />
      <Heading style={{ marginBottom: space.md }}>Applications</Heading>
      {pendingApps.length === 0 ? (
        <Muted>No open applications.</Muted>
      ) : (
        pendingApps.map((a) => (
          <Card key={a.id} onPress={() => router.push(`/project/${a.projectId}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Heading style={{ flex: 1 }} numberOfLines={1}>{a.projectTitle}</Heading>
              <Pill label={APPLICATION_LABEL[a.status]} tone={a.status === 'shortlisted' ? 'primary' : 'neutral'} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
