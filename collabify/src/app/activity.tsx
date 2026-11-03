import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Body, Empty, Heading, Loading, Muted, Screen, type IconName } from '@/components/ui';
import { getApi } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import type { AppNotification } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

const ICON: Record<string, IconName> = {
  application: 'person-add', recommended: 'sparkles', shortlisted: 'star', declined: 'close-circle', filled: 'checkmark-done',
  closed: 'close-circle', hired: 'rocket', funded: 'lock-closed', changes: 'create', delivered: 'cube', paid: 'cash',
  completed: 'checkmark-circle', problem: 'alert-circle', refunded: 'arrow-undo', cancelled: 'close-circle',
  message: 'chatbubble', invited: 'mail', reviews: 'star', review_waiting: 'star-half',
};
const MONEY = new Set(['paid', 'funded', 'refunded']);

function Row({ n, isNew }: { n: AppNotification; isNew: boolean }) {
  const { colors } = useTheme();
  const unread = isNew;
  return (
    <Pressable
      testID={`notification-${n.kind}`}
      onPress={() => n.link && router.push(n.link as Href)}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, marginBottom: space.sm,
        backgroundColor: unread ? colors.primarySoft : colors.surface, opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: MONEY.has(n.kind) ? colors.moneySoft : colors.surfaceAlt }}>
        <Ionicons name={ICON[n.kind] ?? 'notifications'} size={20} color={MONEY.has(n.kind) ? colors.moneyText : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Heading style={{ fontSize: 16 }}>{n.title}</Heading>
        {n.body ? <Body style={{ fontSize: 15 }} numberOfLines={3}>{n.body}</Body> : null}
        <Muted style={{ fontSize: 12, marginTop: 4 }}>{timeAgo(n.createdAt)}</Muted>
      </View>
    </Pressable>
  );
}

function Feed({ items }: { items: AppNotification[] }) {
  // What was new when the feed opened stays highlighted after it's marked read.
  const [newIds] = useState(() => new Set(items.filter((n) => !n.readAt).map((n) => n.id)));
  const hasUnread = items.some((n) => !n.readAt);
  useEffect(() => {
    if (hasUnread) getApi().markNotificationsRead().catch(() => {});
  }, [hasUnread]);
  return <>{items.map((n) => <Row key={n.id} n={n} isNew={newIds.has(n.id)} />)}</>;
}

export default function Activity() {
  const { data } = useQuery((api) => api.listNotifications());
  return (
    <Screen title="Activity" edges={[]}>
      {!data ? <Loading /> : data.length === 0 ? (
        <Empty icon="notifications-outline" title="Nothing yet" text="Applications, payments and messages will show up here." />
      ) : (
        <Feed items={data} />
      )}
    </Screen>
  );
}
