import { router } from 'expo-router';
import { ProjectCard } from '@/components/domain';
import { FadeIn, SkeletonCard } from '@/components/motion';
import { Button, Empty, Muted, Screen } from '@/components/ui';
import { matchScore } from '@/lib/matching';
import { useMe } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import { space } from '@/theme';

export default function Saved() {
  const me = useMe();
  const { data: projects } = useQuery((api) => api.listSavedProjects());
  const { data: student } = useQuery((api) => api.getStudent(me.id), [me.id]);
  const open = projects?.filter((p) => p.status === 'open') ?? [];
  const closed = projects?.filter((p) => p.status !== 'open') ?? [];

  return (
    <Screen title="Saved" subtitle="Projects you're thinking about." refreshable>
      {!projects ? <><SkeletonCard /><SkeletonCard /></> : projects.length === 0 ? (
        <Empty
          icon="bookmark-outline"
          title="Nothing saved yet"
          text="Tap the bookmark on any project to keep it here."
          action={<Button small title="Discover projects" onPress={() => router.push('/student')} />}
        />
      ) : (
        <>
          {open.map((p, i) => (
            <FadeIn key={p.id} index={i}>
              <ProjectCard project={p} saveable matchScore={student ? matchScore(p, student) : undefined} onPress={() => router.push(`/project/${p.id}`)} />
            </FadeIn>
          ))}
          {closed.length ? <Muted style={{ marginTop: space.lg, marginBottom: space.md }}>No longer open</Muted> : null}
          {closed.map((p) => <ProjectCard key={p.id} project={p} saveable showStatus onPress={() => router.push(`/project/${p.id}`)} />)}
        </>
      )}
    </Screen>
  );
}
