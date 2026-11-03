import { router } from 'expo-router';
import { ActivityBell } from '@/components/ActivityBell';
import { ContractPill, ProjectPill } from '@/components/domain';
import { Button, Card, Empty, Gap, Heading, Loading, Money, Muted, Row, Screen } from '@/components/ui';
import { daysUntil } from '@/lib/format';
import { useMe } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Contract } from '@/lib/types';
import { space } from '@/theme';

const NEXT_STEP: Partial<Record<Contract['status'], string>> = {
  awaiting_funding: 'Pay to get started',
  delivered: 'Review the delivery',
  disputed: 'We’re looking into this',
};

export default function BusinessProjects() {
  const me = useMe();
  const { data: projects } = useQuery((api) => api.listMyProjects());
  const { data: all } = useQuery((api) => api.listMyContracts());
  const contracts = all?.filter((c) => c.status !== 'cancelled');
  if (!projects || !contracts) return <Screen title="Projects"><Loading /></Screen>;
  const action = contracts.filter((c) => NEXT_STEP[c.status]);
  const byProject = new Map(contracts.map((c) => [c.projectId, c]));

  return (
    <Screen title="Projects" subtitle={`Hi ${me.fullName.split(' ')[0]}.`} right={<ActivityBell />}>
      {action.length > 0 ? (
        <>
          <Heading style={{ marginBottom: space.md }}>Needs you</Heading>
          {action.map((c) => (
            <Card key={c.id} onPress={() => router.push(`/contract/${c.id}`)} testID={`action-${c.id}`}>
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
        </>
      ) : null}

      <Heading style={{ marginBottom: space.md }}>All projects</Heading>
      {projects.length === 0 ? (
        <Empty
          icon="rocket-outline"
          title="Post your first project"
          text="Verified UK students apply, usually within a day. You pay only when you approve."
          action={<Button title="Post a project" onPress={() => router.push('/business/post')} />}
        />
      ) : (
        projects.map((p) => {
          const c = byProject.get(p.id);
          return (
            <Card key={p.id} onPress={() => router.push(`/project/${p.id}`)} testID={`project-${p.id}`}>
              <Row style={{ justifyContent: 'space-between' }}>
                <ProjectPill status={p.status} />
                <Money pence={p.budgetPence} />
              </Row>
              <Heading style={{ marginTop: space.md }}>{p.title}</Heading>
              <Muted>{c ? `With ${c.studentName}` : `${p.applicantCount} applicant${p.applicantCount === 1 ? '' : 's'}`}</Muted>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
