import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CompanyLogo } from '@/components/company';
import { ProjectCard } from '@/components/domain';
import { FadeIn, PressableScale, SkeletonCard } from '@/components/motion';
import { Body, Chip, Empty, Field, Heading, Label, Money, Muted, Row, Screen } from '@/components/ui';
import { CATEGORIES } from '@/lib/brief';
import { matchScore } from '@/lib/matching';
import { studentStrength } from '@/lib/profileStrength';
import { whereLabel } from '@/lib/projectRules';
import { useMe } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Project } from '@/lib/types';
import { fonts, radius, space, useTheme } from '@/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Compact card for the "Top matches" carousel. */
function MatchCard({ project, score }: { project: Project; score: number }) {
  const { colors } = useTheme();
  return (
    <PressableScale testID={`match-${project.id}`} onPress={() => router.push(`/project/${project.id}`)} style={{ width: 250, height: 190, borderRadius: radius.xl, padding: space.lg, backgroundColor: colors.primary, justifyContent: 'space-between' }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <CompanyLogo name={project.companyName} size={32} />
        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Ionicons name="sparkles" size={12} color="#fff" />
          <Body style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 12 }}>{score}% match</Body>
        </View>
      </Row>
      <View>
        <Heading style={{ color: '#fff' }} numberOfLines={2}>{project.title}</Heading>
        <Body style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }} numberOfLines={1}>{project.companyName} · {whereLabel(project)}</Body>
      </View>
      <Money pence={project.budgetPence} size={22} style={{ color: '#fff' }} />
    </PressableScale>
  );
}

function StrengthCard({ score, next }: { score: number; next: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale testID="profile-strength" onPress={() => router.push('/student/profile')} style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: colors.surfaceAlt, marginBottom: space.lg }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Label>Profile strength</Label>
        <Body style={{ fontFamily: fonts.bold, color: colors.primary }}>{Math.round(score * 100)}%</Body>
      </Row>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, marginVertical: space.md, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(score, 0.04) * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 4 }} />
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body style={{ fontFamily: fonts.semibold, fontSize: 15, flex: 1 }}>{next}</Body>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Row>
    </PressableScale>
  );
}

export default function ProjectsFeed() {
  const me = useMe();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const { data: projects } = useQuery((api) => api.listOpenProjects({ search, category }), [search, category]);
  const { data: student } = useQuery((api) => api.getStudent(me.id), [me.id]);
  const { data: priv } = useQuery((api) => api.getMyStudentPrivate());
  const { data: invites } = useQuery((api) => api.listMyInvites());
  const invitedIds = new Set(invites ?? []);
  const browsing = !search.trim() && !category;

  // Projects you've been invited to come first.
  const sorted = projects ? [...projects].sort((a, b) => Number(invitedIds.has(b.id)) - Number(invitedIds.has(a.id))) : undefined;
  const top = student && sorted && browsing
    ? sorted.map((p) => ({ p, score: matchScore(p, student) })).filter((x) => x.score >= 50).sort((a, b) => b.score - a.score).slice(0, 3)
    : [];
  const strength = student && priv ? studentStrength(student, priv) : null;

  return (
    <Screen title="Discover" subtitle={`${greeting()}, ${me.fullName.split(' ')[0]}.`} refreshable>
      {strength?.next ? <FadeIn><StrengthCard score={strength.score} next={strength.next} /></FadeIn> : null}

      {top.length > 0 ? (
        <FadeIn index={1}>
          <Label style={{ marginBottom: space.md }}>Top matches for you</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={262} decelerationRate="fast" style={{ marginHorizontal: -space.xl, marginBottom: space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl, gap: 12 }}>
            {top.map(({ p, score }) => <MatchCard key={p.id} project={p} score={score} />)}
          </ScrollView>
        </FadeIn>
      ) : null}

      <Field value={search} onChangeText={setSearch} placeholder="Search projects or skills" returnKeyType="search" autoCapitalize="none" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.lg, marginHorizontal: -space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl }}>
        <Row>
          <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
          {CATEGORIES.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? undefined : c)} />)}
        </Row>
      </ScrollView>
      {!sorted ? (
        <View><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
      ) : sorted.length === 0 ? (
        <Empty icon="search" title={browsing ? 'Nothing here yet' : 'No matching projects'} text={browsing ? 'New projects are posted every week.' : 'Try another search or category.'} />
      ) : (
        <View>
          {browsing ? <Muted style={{ marginBottom: space.md }}>{sorted.length} open project{sorted.length === 1 ? '' : 's'}</Muted> : null}
          {sorted.map((p, i) => (
            <FadeIn key={p.id} index={i}>
              <ProjectCard project={p} saveable invited={invitedIds.has(p.id)} matchScore={student ? matchScore(p, student) : undefined} onPress={() => router.push(`/project/${p.id}`)} />
            </FadeIn>
          ))}
        </View>
      )}
    </Screen>
  );
}
