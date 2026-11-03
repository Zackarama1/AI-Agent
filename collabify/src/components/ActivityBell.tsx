import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@/lib/useQuery';
import { fonts, useTheme } from '@/theme';

/** Bell with an unread count; opens the activity feed. */
export function ActivityBell() {
  const { colors } = useTheme();
  const { data } = useQuery((api) => api.listNotifications());
  const unread = data?.filter((n) => !n.readAt).length ?? 0;
  return (
    <Pressable
      testID="activity-bell"
      accessibilityRole="button"
      accessibilityLabel={unread ? `Activity, ${unread} new` : 'Activity'}
      onPress={() => router.push('/activity')}
      hitSlop={10}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}
    >
      <Ionicons name="notifications" size={22} color={colors.text} />
      {unread > 0 ? (
        <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 11 }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
