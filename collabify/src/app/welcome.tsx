import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Body, Chip, Gap, Hero, Label, Muted, Screen } from '@/components/ui';
import { getApi } from '@/lib/api';
import { DEMO_ACCOUNTS } from '@/lib/demo/seed';
import { haptic } from '@/lib/haptics';
import { fonts, radius, space, useTheme } from '@/theme';
import type { Role } from '@/lib/types';

function RoleCard({ role, title, text, icon }: { role: Role; title: string; text: string; icon: 'school' | 'rocket' }) {
  const { colors } = useTheme();
  const primary = role === 'student';
  return (
    <Pressable
      testID={`role-${role}`}
      onPress={() => {
        haptic.tap();
        router.push({ pathname: '/sign-in', params: { role } });
      }}
      style={({ pressed }) => ({
        backgroundColor: primary ? colors.primary : colors.surfaceAlt,
        borderRadius: radius.xl,
        padding: space.xl,
        marginBottom: space.md,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Ionicons name={icon} size={28} color={primary ? '#fff' : colors.primary} />
        <Ionicons name="arrow-forward" size={22} color={primary ? '#fff' : colors.text} />
      </View>
      <Body style={{ fontFamily: fonts.heavy, fontSize: 26, letterSpacing: -0.8, marginTop: space.xl, color: primary ? '#fff' : colors.text }}>{title}</Body>
      <Body style={{ marginTop: 4, color: primary ? 'rgba(255,255,255,0.85)' : colors.textMuted }}>{text}</Body>
    </Pressable>
  );
}

export default function Welcome() {
  const { colors } = useTheme();
  const demo = getApi().mode === 'demo';
  return (
    <Screen>
      <Gap size={space.xxl} />
      <Body style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: 17 }}>Collabify</Body>
      <Gap size={space.md} />
      <Hero>Real projects.{'\n'}Real pay.</Hero>
      <Gap size={space.md} />
      <Muted style={{ fontSize: 18, lineHeight: 25 }}>UK students and startups, working together on short paid projects.</Muted>
      <Gap size={space.xxl} />
      <RoleCard role="student" icon="school" title="I'm a student" text="Find paid projects. Keep 100% of what you earn." />
      <RoleCard role="business" icon="rocket" title="I'm hiring" text="Post a project. Pay only when you approve the work." />
      {demo ? (
        <View style={{ marginTop: space.xl }}>
          <Label>Demo mode · try an account</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            {DEMO_ACCOUNTS.map((a) => (
              <Chip
                key={a.email}
                label={a.label}
                onPress={() => router.push({ pathname: '/sign-in', params: { role: a.role === 'admin' ? 'business' : a.role, email: a.email } })}
              />
            ))}
          </View>
          <Muted style={{ fontSize: 13, marginTop: space.sm }}>All businesses, people and projects in demo mode are fictional.</Muted>
        </View>
      ) : null}
    </Screen>
  );
}
