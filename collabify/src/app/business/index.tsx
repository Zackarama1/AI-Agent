import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ContractPill, ProjectPill } from '@/components/domain';
import { FadeIn, PressableScale, SkeletonCard } from '@/components/motion';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Body, Button, Card, Empty, Gap, Heading, Label, Money, Muted, Row, Screen, type IconName } from '@/components/ui';
import { formatGBP } from '@/lib/fees';
import { daysUntil } from '@/lib/format';
import { useMe } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Contract, Project } from '@/lib/types';
import { fonts, radius, space, useTheme } from '@/theme';

const NEXT_STEP: Partial<Record<Contract['status'], string>> = {
  awaiting_funding: 'Pay to get started',
  delivered: 'Review the delivery',
  disputed: 'We’re looking into this',
};

type Filter = 'all' | 'open' | 'active' | 'done';
const IN_FILTER: Record<Filter, (p: Project) => boolean> = {
  all: (p) => p.status !== 'cancelled',
  open: (p) => p.status === 'open',
  active: (p) => p.status === 'in_progress' || p.status === 'delivered',
  done: (p) => p.status === 'completed',
};

function Stat({ icon, label, value, onPress }: { icon: IconName; label: string; value: React.ReactNode; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={!onPress} style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: space.lg, gap: space.sm }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      {typeof value === 'string' ? <Body style={{ fontFamily: fonts.heavy, fontSize: 24, letterSpacing: -0.6 }}>{value}</Body> : value}
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </PressableScale>
  );
}

export default function BusinessHome() {
  const me = useMe();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: projects } = useQuery((api) => api.listMyProjects());
  const { data: all } = useQuery((api) => api.listMyContracts());
  const contracts = all?.filter((c) => c.status !== 'cancelled');
  if (!projects || !contracts) return <Screen title="Home"><SkeletonCard /><SkeletonCard /></Screen>;

  const action = contracts.filter((c) => NEXT_STEP[c.status]);
  const byProject = new Map(contracts.map((c) => [c.projectId, c]));
  const heldPence = contracts.filter((c) => ['funded', 'delivered', 'disputed'].includes(c.status)).reduce((s, c) => s + c.totalPence, 0);
  const hired = new Set(contracts.map((c) => c.studentId)).size;
  const count = (f: Filter) => projects.filter(IN_FILTER[f]).length;
  const shown = projects.filter(IN_FILTER[filter]);

  return (
    <Screen title="Home" subtitle={`Hi ${me.fullName.split(' ')[0]}. Here's where things stand.`} refreshable>
      <FadeIn>
        <Row gap={space.sm} style={{ marginBottom: space.xl }}>
          <Stat icon="megaphone" label="open projects" value={String(count('open'))} onPress={() => setFilter('open')} />
          <Stat icon="lock-closed" label="payment held" value={<Money pence={heldPence} size={24} />} />
          <Stat icon="people" label={hired === 1 ? 'student hired' : 'students hired'} value={String(hired)} onPress={() => router.push('/business/talent')} />
        </Row>
      </FadeIn>

      {action.length > 0 ? (
        <FadeIn index={1}>
          <Label style={{ marginBottom: space.md }}>Needs you</Label>
          {action.map((c) => (
            <Card key={c.id} onPress={() => router.push(`/contract/${c.id}`)} testID={`action-${c.id}`} style={{ borderColor: colors.primary, borderWidth: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <ContractPill status={c.status} />
                <Money pence={c.amountPence} />
              </Row>
              <Heading style={{ marginTop: space.md }}>{c.projectTitle}</Heading>
              <Muted>
                {NEXT_STEP[c.status]} · {c.studentName}
                {c.status === 'delivered' && c.autoReleaseAt ? ` · auto-pays in ${daysUntil(c.autoReleaseAt)}d` : ''}
              </Muted>
            </Card>
          ))}
          <Gap size={space.md} />
        </FadeIn>
      ) : null}

      <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
        <Label>Your projects</Label>
        <Button small variant="ghost" icon="add" title="New" onPress={() => router.push('/business/post')} />
      </Row>
      {projects.length === 0 ? (
        <Empty
          icon="rocket-outline"
          title="Post your first project"
          text="Verified UK students apply, usually within a day. You pay only when you approve."
          action={<Button title="Post a project" onPress={() => router.push('/business/post')} />}
        />
      ) : (
        <>
          <SegmentedControl
            testID="project-filter"
            value={filter}
            onChange={setFilter}
            segments={[
              { key: 'all', label: 'All' },
              { key: 'open', label: `Open ${count('open')}` },
              { key: 'active', label: `Active ${count('active')}` },
              { key: 'done', label: `Done ${count('done')}` },
            ]}
          />
          {shown.length === 0 ? (
            <Muted style={{ textAlign: 'center', marginVertical: space.xl }}>Nothing here.</Muted>
          ) : (
            shown.map((p, i) => {
              const c = byProject.get(p.id);
              return (
                <FadeIn key={p.id} index={i}>
                  <Card onPress={() => router.push(`/project/${p.id}`)} testID={`project-${p.id}`}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <ProjectPill status={p.status} />
                      <Money pence={p.budgetPence} />
                    </Row>
                    <Heading style={{ marginTop: space.md }}>{p.title}</Heading>
                    <Muted>
                      {c ? `With ${c.studentName}` : `${p.applicantCount} applicant${p.applicantCount === 1 ? '' : 's'}`}
                      {p.featured ? ' · Featured' : ''}
                    </Muted>
                  </Card>
                </FadeIn>
              );
            })
          )}
          {heldPence > 0 ? <Muted style={{ fontSize: 12, textAlign: 'center', marginTop: space.md }}>{formatGBP(heldPence, { exact: true })} is held safely until you approve the work.</Muted> : null}
          <View />
        </>
      )}
    </Screen>
  );
}
