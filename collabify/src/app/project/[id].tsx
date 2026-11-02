import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { FeeBreakdown, ProjectPill } from '@/components/domain';
import { Avatar, Body, Button, Card, Chips, Empty, ErrorText, Field, Gap, Heading, Label, Loading, Money, Muted, Pill, Row, Screen, Stars } from '@/components/ui';
import { getApi } from '@/lib/api';
import { formatGBP, hourlyRatePence } from '@/lib/fees';
import { APPLICATION_LABEL, timeAgo } from '@/lib/format';
import { matchScore } from '@/lib/matching';
import { useMe } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import type { Application, Project } from '@/lib/types';
import { fonts, space, useTheme } from '@/theme';

function ApplyBox({ project }: { project: Project }) {
  const { data: mine } = useQuery((api) => api.getMyApplication(project.id), [project.id]);
  const { data: contract } = useQuery((api) => api.getContractForProject(project.id), [project.id]);
  const [pitch, setPitch] = useState('');
  const { busy, error, run } = useAction();
  if (mine === undefined) return <Loading />;
  if (contract) return <Button title="Open project" onPress={() => router.push(`/contract/${contract.id}`)} />;
  if (mine) {
    return (
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Your application</Heading>
          <Pill label={APPLICATION_LABEL[mine.status]} tone={mine.status === 'shortlisted' ? 'primary' : 'neutral'} />
        </Row>
        <Muted style={{ marginTop: space.sm }}>{mine.pitch}</Muted>
      </Card>
    );
  }
  if (project.status !== 'open') return <Muted>This project is no longer taking applications.</Muted>;
  return (
    <View>
      <Heading style={{ marginBottom: space.md }}>Apply</Heading>
      <Field testID="pitch" value={pitch} onChangeText={setPitch} multiline placeholder="Why you? Mention relevant work, coursework or links." />
      <ErrorText>{error}</ErrorText>
      <Button
        testID="apply"
        title="Send application"
        hapticKind="success"
        loading={busy}
        disabled={pitch.trim().length < 20}
        onPress={() => run(() => getApi().apply(project.id, pitch))}
      />
      <Muted style={{ textAlign: 'center', marginTop: space.sm, fontSize: 13 }}>You keep 100% · {formatGBP(project.budgetPence)}</Muted>
    </View>
  );
}

function Applicant({ a, project }: { a: Application; project: Project }) {
  const { busy, error, run } = useAction();
  const open = project.status === 'open';
  return (
    <Card>
      <Row gap={space.md}>
        <Avatar name={a.student.fullName} />
        <View style={{ flex: 1 }}>
          <Body style={{ fontFamily: fonts.semibold }} >{a.student.fullName}</Body>
          <Muted style={{ fontSize: 13 }}>{a.student.university} · {a.student.course}</Muted>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Pill label={`${matchScore(project, a.student)}% match`} tone="primary" />
          <Stars value={a.student.rating.average} />
        </View>
      </Row>
      <Body style={{ marginTop: space.md }}>{a.pitch}</Body>
      <View style={{ marginTop: space.md }}><Chips items={a.student.skills.slice(0, 5)} /></View>
      <ErrorText>{error}</ErrorText>
      <Row style={{ marginTop: space.lg, flexWrap: 'wrap' }}>
        <Pill label={APPLICATION_LABEL[a.status]} tone={a.status === 'hired' ? 'money' : a.status === 'shortlisted' ? 'primary' : 'neutral'} />
        <View style={{ flex: 1 }} />
        <Button small variant="ghost" title="Profile" onPress={() => router.push(`/people/${a.studentId}`)} />
        {open && a.status === 'applied' ? (
          <Button small variant="secondary" title="Shortlist" disabled={busy} onPress={() => run(() => getApi().setApplicationStatus(a.id, 'shortlisted'))} />
        ) : null}
        {open && a.status !== 'declined' ? (
          <>
            <Button small variant="ghost" title="Decline" disabled={busy} onPress={() => run(() => getApi().setApplicationStatus(a.id, 'declined'))} />
            <Button
              testID={`hire-${a.id}`}
              small
              title="Hire"
              hapticKind="success"
              loading={busy}
              onPress={() => run(async () => {
                const c = await getApi().hire(a.id);
                router.push(`/contract/${c.id}`);
              })}
            />
          </>
        ) : null}
      </Row>
    </Card>
  );
}

function OwnerView({ project }: { project: Project }) {
  const { data: applicants } = useQuery((api) => api.listApplicants(project.id), [project.id]);
  const { data: contract } = useQuery((api) => api.getContractForProject(project.id), [project.id]);
  const { data: business } = useQuery((api) => api.getBusiness(project.businessId), [project.businessId]);
  return (
    <View>
      {contract ? <Button title="Open project with your student" onPress={() => router.push(`/contract/${contract.id}`)} style={{ marginBottom: space.xl }} /> : null}
      {project.status === 'open' && business ? (
        <Card>
          <Label style={{ marginBottom: space.sm }}>When you hire</Label>
          <FeeBreakdown amountPence={project.budgetPence} plan={business.plan} />
        </Card>
      ) : null}
      <Gap size={space.md} />
      <Heading style={{ marginBottom: space.md }}>Applicants</Heading>
      {!applicants ? <Loading /> : applicants.length === 0 ? (
        <Empty icon="people-outline" title="No applicants yet" text="Most projects get their first application within a day." />
      ) : (
        applicants.map((a) => <Applicant key={a.id} a={a} project={project} />)
      )}
    </View>
  );
}

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const { data: project, error } = useQuery((api) => api.getProject(id), [id]);
  if (error) return <Screen edges={[]}><ErrorText>{error.message}</ErrorText></Screen>;
  if (project === undefined) return <Loading />;
  if (!project) return <Screen edges={[]}><Empty title="Project not found" /></Screen>;
  const isOwner = project.businessId === me.id;

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: '' }} />
      <Row gap={6}>
        {project.featured ? <Pill label="Featured" tone="primary" /> : null}
        <Pill label={project.category} />
        <ProjectPill status={project.status} />
      </Row>
      <Gap size={space.md} />
      <Heading style={{ fontSize: 30, lineHeight: 34, letterSpacing: -1, fontFamily: fonts.heavy }}>{project.title}</Heading>
      <Muted style={{ marginTop: space.xs }}>{project.companyName} · posted {timeAgo(project.createdAt)}</Muted>

      <Row gap={space.xl} style={{ marginVertical: space.xl }}>
        <View>
          <Label>Pay</Label>
          <Money pence={project.budgetPence} size={30} />
        </View>
        <View>
          <Label>Time</Label>
          <Body style={{ fontFamily: fonts.bold, fontSize: 22, marginTop: 4 }}>{project.estimatedHours}h</Body>
        </View>
        <View>
          <Label>Rate</Label>
          <Body style={{ fontFamily: fonts.bold, fontSize: 22, marginTop: 4 }}>{formatGBP(hourlyRatePence(project.budgetPence, project.estimatedHours))}/h</Body>
        </View>
      </Row>

      <Card style={{ backgroundColor: colors.surfaceAlt, borderWidth: 0 }}>
        <Body>{project.brief}</Body>
        <Gap size={space.lg} />
        <Chips items={project.skills} />
        <Muted style={{ marginTop: space.lg, fontSize: 13 }}>Due within {project.durationDays} days of starting</Muted>
      </Card>
      <Row gap={6} style={{ marginBottom: space.xl, marginTop: space.sm }}>
        <Body style={{ color: colors.moneyText, fontSize: 13, fontFamily: fonts.semibold }}>Protected payment</Body>
        <Muted style={{ fontSize: 13 }}>· held before work starts</Muted>
      </Row>

      {isOwner || me.role === 'admin' ? <OwnerView project={project} /> : me.role === 'student' ? <ApplyBox project={project} /> : null}
    </Screen>
  );
}
