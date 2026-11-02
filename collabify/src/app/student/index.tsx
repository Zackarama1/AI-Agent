import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ProjectCard } from '@/components/domain';
import { Button, Card, Chip, Empty, Field, Heading, Loading, Muted, Row, Screen } from '@/components/ui';
import { CATEGORIES } from '@/lib/brief';
import { matchScore } from '@/lib/matching';
import { useMe } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import { space } from '@/theme';

export default function ProjectsFeed() {
  const me = useMe();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const { data: projects } = useQuery((api) => api.listOpenProjects({ search, category }), [search, category]);
  const { data: student } = useQuery((api) => api.getStudent(me.id), [me.id]);
  const { data: priv } = useQuery((api) => api.getMyStudentPrivate());

  return (
    <Screen title="Projects" subtitle={`Hi ${me.fullName.split(' ')[0]}. Find something worth doing.`}>
      {priv && !priv.payoutsEnabled ? (
        <Card style={{ marginBottom: space.lg }}>
          <Heading>Set up payouts</Heading>
          <Muted style={{ marginTop: 4, marginBottom: space.md }}>Connect your bank so you can get paid. Takes two minutes.</Muted>
          <Button small title="Set up payouts" onPress={() => router.push('/student/profile')} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : null}
      <Field value={search} onChangeText={setSearch} placeholder="Search projects or skills" returnKeyType="search" autoCapitalize="none" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.lg, marginHorizontal: -space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl }}>
        <Row>
          <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
          {CATEGORIES.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? undefined : c)} />)}
        </Row>
      </ScrollView>
      {!projects ? (
        <Loading />
      ) : projects.length === 0 ? (
        <Empty icon="search" title="Nothing here yet" text="New projects are posted every week." />
      ) : (
        <View>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} matchScore={student ? matchScore(p, student) : undefined} onPress={() => router.push(`/project/${p.id}`)} />
          ))}
        </View>
      )}
    </Screen>
  );
}
