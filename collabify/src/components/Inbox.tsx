import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ActivityFeed } from './ActivityFeed';
import { CompanyLogo } from './company';
import { FadeIn, PressableScale, SkeletonCard } from './motion';
import { SegmentedControl } from './SegmentedControl';
import { Avatar, Body, Empty, Muted, Row, Screen } from './ui';
import { timeAgo } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import type { Conversation } from '@/lib/types';
import { fonts, radius, space, useTheme } from '@/theme';

function ConversationRow({ c }: { c: Conversation }) {
  const { colors } = useTheme();
  const unread = c.unread > 0;
  return (
    <PressableScale
      testID={`conversation-${c.contractId}`}
      scaleTo={0.98}
      onPress={() => router.push(`/chat/${c.contractId}`)}
      style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.sm, borderRadius: radius.lg }}
    >
      {c.otherIsCompany ? <CompanyLogo name={c.otherName} size={52} /> : <Avatar name={c.otherName} size={52} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body style={{ fontFamily: unread ? fonts.bold : fonts.semibold, flex: 1 }} numberOfLines={1}>{c.otherName}</Body>
          {c.lastMessage ? <Muted style={{ fontSize: 12 }}>{timeAgo(c.lastMessage.createdAt)}</Muted> : null}
        </Row>
        <Muted style={{ fontSize: 13 }} numberOfLines={1}>{c.projectTitle}</Muted>
        <Row style={{ marginTop: 2 }}>
          <Body numberOfLines={1} style={{ flex: 1, fontSize: 15, color: unread ? colors.text : colors.textMuted, fontFamily: unread ? fonts.semibold : fonts.regular }}>
            {c.lastMessage ? `${c.lastMessage.mine ? 'You: ' : ''}${c.lastMessage.body}` : 'No messages yet. Say hello.'}
          </Body>
          {unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
        </Row>
      </View>
    </PressableScale>
  );
}

/** Inbox tab: conversations (one per project) and the activity feed. */
export function Inbox() {
  const [tab, setTab] = useState<'messages' | 'activity'>('messages');
  const { data: conversations } = useQuery((api) => api.listConversations());
  const { data: notifications } = useQuery((api) => api.listNotifications());
  const unreadMessages = conversations?.reduce((s, c) => s + c.unread, 0) ?? 0;
  const unreadActivity = notifications?.filter((n) => !n.readAt && n.kind !== 'message').length ?? 0;

  return (
    <Screen title="Inbox" refreshable>
      <SegmentedControl
        testID="inbox-tabs"
        value={tab}
        onChange={setTab}
        segments={[
          { key: 'messages', label: 'Messages', count: unreadMessages },
          { key: 'activity', label: 'Activity', count: unreadActivity },
        ]}
      />
      {tab === 'messages' ? (
        !conversations ? <><SkeletonCard /><SkeletonCard /></> : conversations.length === 0 ? (
          <Empty icon="chatbubbles-outline" title="No conversations yet" text="Once you're hired or hire someone, you'll chat here." />
        ) : (
          conversations.map((c, i) => (
            <FadeIn key={c.contractId} index={i}>
              <ConversationRow c={c} />
              {i < conversations.length - 1 ? <View style={{ height: 0.5, marginLeft: 72, opacity: 0.6 }}><ContractDivider /></View> : null}
            </FadeIn>
          ))
        )
      ) : !notifications ? (
        <SkeletonCard />
      ) : notifications.filter((n) => n.kind !== 'message').length === 0 ? (
        <Empty icon="notifications-outline" title="Nothing yet" text="Applications, payments and updates show up here." />
      ) : (
        <ActivityFeed items={notifications.filter((n) => n.kind !== 'message')} />
      )}
    </Screen>
  );
}

function ContractDivider() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.border }} />;
}
