import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Loading, type IconName } from './ui';
import { usePush } from '@/lib/push';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Role } from '@/lib/types';
import { fonts, useTheme } from '@/theme';

/** Bottom tabs for one role; bounces anyone else back to the router. */
export function RoleTabs({ role, tabs }: { role: Role; tabs: { name: string; title: string; icon: IconName; badge?: 'inbox' }[] }) {
  const { profile } = useSession();
  const { colors } = useTheme();
  usePush(Boolean(profile && profile.role === role));
  // Unread messages and activity, shown on the Inbox tab.
  const { data: notifications } = useQuery((api) => (profile ? api.listNotifications() : Promise.resolve([])), [profile?.id]);
  const unread = notifications?.filter((n) => !n.readAt).length ?? 0;
  if (profile === undefined) return <Loading />;
  if (!profile) return <Redirect href="/welcome" />;
  if (profile.role !== role) return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarBadge: t.badge === 'inbox' && unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.primary, fontFamily: fonts.bold, fontSize: 11 },
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} color={typeof color === 'string' ? color : undefined} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
