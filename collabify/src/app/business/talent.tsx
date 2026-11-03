import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFeedback } from '@/components/feedback';
import { FadeIn, SkeletonCard } from '@/components/motion';
import { Avatar, Body, Button, Card, Chip, Chips, Empty, ErrorText, Field, Heading, Label, Muted, Pill, Row, Screen, Stars } from '@/components/ui';
import { getApi } from '@/lib/api';
import { SKILL_OPTIONS } from '@/lib/brief';
import { useAction, useQuery } from '@/lib/useQuery';
import type { Project, Student } from '@/lib/types';
import { fonts, space } from '@/theme';

function InvitePicker({ student, projects, onDone }: { student: Student; projects: Project[]; onDone: () => void }) {
  const { toast } = useFeedback();
  const { busy, error, run } = useAction();
  if (projects.length === 0) {
    return (
      <View style={{ marginTop: space.md }}>
        <Muted style={{ marginBottom: space.sm }}>Post a project first, then invite {student.fullName.split(' ')[0]} to it.</Muted>
        <Button small title="Post a project" onPress={() => router.push('/business/post')} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }
  return (
    <View style={{ marginTop: space.md }}>
      <Label style={{ marginBottom: space.sm }}>Invite to</Label>
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {projects.map((p) => (
          <Chip
            key={p.id}
            label={p.title}
            onPress={busy ? undefined : () => run(async () => {
              await getApi().inviteStudent(p.id, student.id);
              toast(`Invited ${student.fullName.split(' ')[0]} to ${p.title}`, 'mail');
              onDone();
            })}
          />
        ))}
      </View>
    </View>
  );
}

function StudentCard({ student, openProjects }: { student: Student; openProjects: Project[] }) {
  const [inviting, setInviting] = useState(false);
  return (
    <Card onPress={() => router.push(`/people/${student.id}`)} testID={`talent-${student.id}`}>
      <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
        <Avatar name={student.fullName} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading numberOfLines={1} style={{ flex: 1 }}>{student.fullName}</Heading>
            <Stars value={student.rating.average} />
          </Row>
          <Muted style={{ fontSize: 13 }} numberOfLines={1}>{[student.course, student.university, student.year].filter(Boolean).join(' · ')}</Muted>
          <Row style={{ marginTop: 6 }}>
            <Pill label="Verified student" tone="money" />
            {student.completedCount ? <Muted style={{ fontSize: 12 }}>{student.completedCount} project{student.completedCount === 1 ? '' : 's'} done</Muted> : null}
          </Row>
        </View>
      </Row>
      {student.bio ? <Body style={{ marginTop: space.md, fontSize: 15 }} numberOfLines={2}>{student.bio}</Body> : null}
      <View style={{ marginTop: space.md }}><Chips items={student.skills.slice(0, 5)} /></View>
      {inviting ? (
        <InvitePicker student={student} projects={openProjects} onDone={() => setInviting(false)} />
      ) : (
        <Row style={{ marginTop: space.lg }}>
          <Button testID={`invite-open-${student.id}`} small icon="mail" title="Invite to apply" onPress={() => setInviting(true)} />
          <Button small variant="ghost" title="View profile" onPress={() => router.push(`/people/${student.id}`)} />
        </Row>
      )}
    </Card>
  );
}

export default function Talent() {
  const [search, setSearch] = useState('');
  const [skill, setSkill] = useState<string | undefined>();
  const { data: students } = useQuery((api) => api.listStudents({ search, skill }), [search, skill]);
  const { data: mine } = useQuery((api) => api.listMyProjects());
  const openProjects = mine?.filter((p) => p.status === 'open') ?? [];

  return (
    <Screen title="Talent" subtitle="Verified UK students, ready to work." refreshable>
      <Field value={search} onChangeText={setSearch} placeholder="Search by name, university or skill" autoCapitalize="none" returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, marginBottom: space.lg }} contentContainerStyle={{ paddingHorizontal: space.xl }}>
        <Row>
          <Chip label="All skills" selected={!skill} onPress={() => setSkill(undefined)} />
          {SKILL_OPTIONS.map((s) => <Chip key={s} label={s} selected={skill === s} onPress={() => setSkill(skill === s ? undefined : s)} />)}
        </Row>
      </ScrollView>
      {!students ? <><SkeletonCard /><SkeletonCard /></> : students.length === 0 ? (
        <Empty icon="people-outline" title="No students match" text="Try a different skill or search." />
      ) : (
        <>
          <Muted style={{ marginBottom: space.md, fontFamily: fonts.semibold }}>{students.length} student{students.length === 1 ? '' : 's'}</Muted>
          {students.map((s, i) => <FadeIn key={s.id} index={i}><StudentCard student={s} openProjects={openProjects} /></FadeIn>)}
        </>
      )}
    </Screen>
  );
}
