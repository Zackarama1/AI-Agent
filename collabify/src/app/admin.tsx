import { resetTo } from '@/lib/nav';
import { Redirect, router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Avatar, Body, Button, Card, Empty, ErrorText, Gap, Heading, Label, Loading, Money, Muted, Pill, Row, Screen } from '@/components/ui';
import { getApi } from '@/lib/api';
import { useMe, useSession } from '@/lib/session';
import { useAction, useQuery } from '@/lib/useQuery';
import { fonts, space } from '@/theme';

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card style={{ flexBasis: '47%', flexGrow: 1, marginBottom: 0 }}>
      <Label>{label}</Label>
      {typeof value === 'string' ? <Body style={{ fontFamily: fonts.heavy, fontSize: 28, letterSpacing: -0.8, marginTop: 4 }}>{value}</Body> : value}
    </Card>
  );
}

export default function Admin() {
  const { profile, signOut } = useSession();
  if (profile === undefined) return <Loading />;
  if (profile?.role !== 'admin') return <Redirect href="/" />;
  return <AdminInner onSignOut={async () => { await signOut(); resetTo('/welcome'); }} />;
}

function AdminInner({ onSignOut }: { onSignOut: () => void }) {
  useMe();
  const { data } = useQuery((api) => api.adminOverview());
  const { error, run, busy } = useAction();
  if (!data) return <Screen title="Matching"><Loading /></Screen>;
  const m = data.metrics;
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <Screen title="Matching" subtitle="Hand-match the first projects." right={<Button small variant="ghost" title="Sign out" onPress={onSignOut} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.xl }}>
        <Metric label="Fill rate" value={pct(m.fillRate)} />
        <Metric label="Time to match" value={m.medianHoursToMatch == null ? '–' : `${m.medianHoursToMatch}h`} />
        <Metric label="Repeat clients" value={pct(m.repeatClientRate)} />
        <Metric label="Open projects" value={String(m.openProjects)} />
        <Metric label="Value booked" value={<Money pence={m.gmvPence} size={28} />} />
        <Metric label="Fee revenue" value={<Money pence={m.feeRevenuePence} size={28} />} />
      </View>
      <ErrorText>{error}</ErrorText>
      <Heading style={{ marginBottom: space.md }}>Open projects</Heading>
      {data.unmatched.length === 0 ? <Empty title="Everything is matched" /> : data.unmatched.map(({ project, suggestions }) => (
        <Card key={project.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading style={{ flex: 1 }} numberOfLines={1}>{project.title}</Heading>
            <Money pence={project.budgetPence} />
          </Row>
          <Muted>{project.companyName} · {project.applicantCount} applied</Muted>
          <Gap size={space.md} />
          {suggestions.length === 0 ? <Muted style={{ fontSize: 13 }}>No strong matches outside current applicants.</Muted> : suggestions.map(({ student, score }) => (
            <Row key={student.id} style={{ marginBottom: space.sm }}>
              <Avatar name={student.fullName} size={32} />
              <View style={{ flex: 1 }}>
                <Body numberOfLines={1}>{student.fullName}</Body>
                <Muted style={{ fontSize: 12 }} numberOfLines={1}>{student.university}</Muted>
              </View>
              <Pill label={`${score}%`} tone="primary" />
              <Button testID={`shortlist-${project.id}-${student.id}`} small variant="secondary" title="Shortlist" disabled={busy} onPress={() => run(() => getApi().adminShortlist(project.id, student.id))} />
            </Row>
          ))}
          <Button small variant="ghost" title="Open project" onPress={() => router.push(`/project/${project.id}`)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ))}
    </Screen>
  );
}
