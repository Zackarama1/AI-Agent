import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, Empty, Muted } from '@/components/ui';
import { getApi } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useMe } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import { fonts, radius, space, useTheme } from '@/theme';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const { data: contract } = useQuery((api) => api.getContract(id), [id]);
  const { data: messages, reload } = useQuery((api) => api.listMessages(id), [id]);
  const [text, setText] = useState('');
  const list = useRef<FlatList>(null);

  // Opening the conversation clears its unread count.
  useEffect(() => {
    getApi().markConversationRead(id).catch(() => {});
  }, [id, messages?.length]);

  // Live updates arrive through onChange in demo mode; poll as a fallback for the network back end.
  useEffect(() => {
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    await getApi().sendMessage(id, body);
    reload();
  };
  const other = contract ? (me.id === contract.studentId ? contract.companyName : contract.studentName) : '';

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: other || 'Messages' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={list}
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={messages ? <Empty icon="chatbubbles-outline" title="Say hello" text={`Start the conversation with ${other}.`} /> : undefined}
          renderItem={({ item }) => {
            const mine = item.senderId === me.id;
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <View style={{ backgroundColor: mine ? colors.primary : colors.surfaceAlt, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 }}>
                  <Body style={{ color: mine ? '#fff' : colors.text }}>{item.body}</Body>
                </View>
                <Muted style={{ fontSize: 11, marginTop: 2, alignSelf: mine ? 'flex-end' : 'flex-start' }}>{timeAgo(item.createdAt)}</Muted>
              </View>
            );
          }}
        />
        <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={send}
            returnKeyType="send"
            style={{ flex: 1, backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: radius.pill, paddingHorizontal: space.lg, fontFamily: fonts.regular, fontSize: 16, minHeight: 44 }}
          />
          <Button testID="chat-send" small title="Send" onPress={send} disabled={!text.trim()} style={{ minHeight: 44 }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
