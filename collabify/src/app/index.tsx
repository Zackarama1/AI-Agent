import { Redirect } from 'expo-router';
import { Loading } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function Index() {
  const { profile } = useSession();
  if (profile === undefined) return <Loading />;
  if (!profile) return <Redirect href="/welcome" />;
  if (profile.role === 'admin') return <Redirect href="/admin" />;
  return <Redirect href={profile.role === 'student' ? '/student' : '/business'} />;
}
