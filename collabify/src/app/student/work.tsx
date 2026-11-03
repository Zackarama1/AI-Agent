import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CompanyLogo } from '@/components/company';
import { ContractPill } from '@/components/domain';
import { FadeIn, SkeletonCard } from '@/components/motion';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Button, Card, Empty, Heading, Label, Money, Muted, Pill, Row, Screen } from '@/components/ui';
import { contractFlow } from '@/lib/contractFlow';
import { APPLICATION_LABEL, timeAgo } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import type { Contract } from '@/lib/types';
import { space, useTheme } from '@/theme';

type Segment = 'active' | 'applications' | 'done';
const ACTIVE = new Set<Contract['status']>(['awaiting_funding', 'funded', 'delivered', 'disputed']);

function ContractCard({ c }: { c: Contract }) {
  const { colors } = useTheme();
  const flow = contractFlow(c, 'student');
  return (
    <Card onPress={() => router.push(`/contract/${c.id}`)} testID={`contract-${c.id}`} style={flow.tone === 'action' ? { borderColor: colors.primary, borderWidth: 1 } : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <ContractPill status={c.status} />
        <Money pence={c.amountPence} />
      </Row>
      <Heading style={{ marginTop: space.md }}>{c.projectTitle}</Heading>
      <Row style={{ marginTop: 4 }}>
        <CompanyLogo name={c.companyName} size={20} />
        <Muted style={{ fontSize: 14 }}>{c.companyName}</Muted>
      </Row>
      {/* Same words as the project screen, from the shared flow. */}
      {ACTIVE.has(c.status) ? <Muted style={{ marginTop: space.sm, color: flow.tone === 'action' ? colors.primary : colors.textMuted }}>{flow.tone === 'action' ? `Your move: ${flow.headline}` : flow.detail}</Muted> : null}
    </Card>
  );
}

export default function MyWork() {
  const [segment, setSegment] = useState<Segment>('active');
  const { data: all } = useQuery((api) => api.listMyContracts());
  const { data: applications } = useQuery((api) => api.listMyApplications());
  const contracts = all?.filter((c) => c.status !== 'cancelled');

  if (!contracts || !applications) return <Screen title="My work"><SkeletonCard /><SkeletonCard /></Screen>;
  const active = contracts.filter((c) => ACTIVE.has(c.status));
  const done = contracts.filter((c) => !ACTIVE.has(c.status));
  const pendingApps = applications.filter((a) => a.status !== 'hired');
  const earned = contracts.filter((c) => c.status === 'released').reduce((s, c) => s + c.amountPence, 0);
  const held = contracts.filter((c) => ['funded', 'delivered', 'disputed'].includes(c.status)).reduce((s, c) => s + c.amountPence, 0);
  const yourMove = active.filter((c) => contractFlow(c, 'student').tone === 'action').length;

  return (
    <Screen title="My work" refreshable>
      <FadeIn>
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
      </FadeIn>

      <SegmentedControl
        testID="work-tabs"
        value={segment}
        onChange={setSegment}
        segments={[
          { key: 'active', label: 'Active', count: yourMove },
          { key: 'applications', label: `Applied ${pendingApps.length || ''}`.trim() },
          { key: 'done', label: 'Done' },
        ]}
      />

      {segment === 'active' ? (
        active.length === 0 ? (
          <Empty icon="briefcase-outline" title="No active projects" text="When a business hires you, it shows up here." action={<Button small title="Find projects" onPress={() => router.push('/student')} />} />
        ) : (
          active.map((c, i) => <FadeIn key={c.id} index={i}><ContractCard c={c} /></FadeIn>)
        )
      ) : null}

      {segment === 'applications' ? (
        pendingApps.length === 0 ? (
          <Empty icon="paper-plane-outline" title="No open applications" text="Apply to a few projects. Most students hear back within a day." />
        ) : (
          pendingApps.map((a, i) => (
            <FadeIn key={a.id} index={i}>
              <Card onPress={() => router.push(`/project/${a.projectId}`)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Heading style={{ flex: 1 }} numberOfLines={1}>{a.projectTitle}</Heading>
                  <Pill label={APPLICATION_LABEL[a.status]} tone={a.status === 'shortlisted' ? 'primary' : 'neutral'} />
                </Row>
                <Muted style={{ fontSize: 13, marginTop: 4 }}>Applied {timeAgo(a.createdAt)}</Muted>
              </Card>
            </FadeIn>
          ))
        )
      ) : null}

      {segment === 'done' ? (
        done.length === 0 ? (
          <Empty icon="trophy-outline" title="Nothing finished yet" text="Completed projects and what you earned will collect here." />
        ) : (
          <View>{done.map((c, i) => <FadeIn key={c.id} index={i}><ContractCard c={c} /></FadeIn>)}</View>
        )
      ) : null}
    </Screen>
  );
}
