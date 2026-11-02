import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  type StyleProp, type TextStyle, type ViewStyle, type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radius, space, useTheme } from '@/theme';
import { haptic } from '@/lib/haptics';
import { formatGBP } from '@/lib/fees';
import { initials } from '@/lib/format';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------- Layout ----------

export function Screen({
  children, scroll = true, title, subtitle, right, padded = true, edges = ['top'],
}: {
  children?: ReactNode; scroll?: boolean; title?: string; subtitle?: string; right?: ReactNode; padded?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const { colors } = useTheme();
  const header = title ? (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Title>{title}</Title>
        {subtitle ? <Muted style={{ marginTop: space.xs }}>{subtitle}</Muted> : null}
      </View>
      {right}
    </View>
  ) : null;
  const body = (
    <>
      {header}
      {children}
    </>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padded && styles.padded, { paddingBottom: space.xxxl }]}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padded && styles.padded]}>{body}</View>
      )}
    </SafeAreaView>
  );
}

export const Row = ({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const Gap = ({ size = space.lg }: { size?: number }) => <View style={{ height: size }} />;

// ---------- Text ----------

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export function Hero({ children, style }: TextProps) {
  const { colors } = useTheme();
  return <RNText style={[styles.hero, { color: colors.text }, style]}>{children}</RNText>;
}
export function Title({ children, style, numberOfLines }: TextProps) {
  const { colors } = useTheme();
  return <RNText numberOfLines={numberOfLines} style={[styles.title, { color: colors.text }, style]}>{children}</RNText>;
}
export function Heading({ children, style, numberOfLines }: TextProps) {
  const { colors } = useTheme();
  return <RNText numberOfLines={numberOfLines} style={[styles.heading, { color: colors.text }, style]}>{children}</RNText>;
}
export function Body({ children, style, numberOfLines }: TextProps) {
  const { colors } = useTheme();
  return <RNText numberOfLines={numberOfLines} style={[styles.body, { color: colors.text }, style]}>{children}</RNText>;
}
export function Muted({ children, style, numberOfLines }: TextProps) {
  const { colors } = useTheme();
  return <RNText numberOfLines={numberOfLines} style={[styles.muted, { color: colors.textMuted }, style]}>{children}</RNText>;
}
export function Label({ children, style }: TextProps) {
  const { colors } = useTheme();
  return <RNText style={[styles.label, { color: colors.textMuted }, style]}>{children}</RNText>;
}
export function Money({ pence, size = 17, style, exact }: { pence: number; size?: number; style?: StyleProp<TextStyle>; exact?: boolean }) {
  const { colors } = useTheme();
  return (
    <RNText style={[{ fontFamily: fonts.bold, fontSize: size, color: colors.moneyText, letterSpacing: size > 24 ? -0.8 : -0.2 }, style]}>
      {formatGBP(pence, { exact })}
    </RNText>
  );
}
export function ErrorText({ children }: { children?: string | null }) {
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft }]}>
      <RNText style={[styles.small, { color: colors.danger }]}>{children}</RNText>
    </View>
  );
}

// ---------- Controls ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'money' | 'danger';

export function Button({
  title, onPress, variant = 'primary', disabled, loading, icon, small, hapticKind = 'tap', style, testID,
}: {
  title: string; onPress?: () => void; variant?: ButtonVariant; disabled?: boolean; loading?: boolean; icon?: IconName;
  small?: boolean; hapticKind?: 'tap' | 'success' | 'none'; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.surfaceAlt, ghost: 'transparent', money: colors.money, danger: colors.dangerSoft }[variant];
  const fg = { primary: colors.primaryText, secondary: colors.text, ghost: colors.primary, money: '#FFFFFF', danger: colors.danger }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={() => {
        if (hapticKind !== 'none') haptic[hapticKind === 'success' ? 'success' : 'tap']();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: inactive ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row gap={6} style={{ justifyContent: 'center' }}>
          {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={fg} /> : null}
          <RNText style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</RNText>
        </Row>
      )}
    </Pressable>
  );
}

export function Field({
  label, hint, style, multiline, ...props
}: TextInputProps & { label?: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: space.lg }}>
      {label ? <Label style={{ marginBottom: 6 }}>{label}</Label> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          { backgroundColor: colors.surfaceAlt, color: colors.text },
          multiline && { minHeight: 120, textAlignVertical: 'top', paddingTop: 14 },
          style,
        ]}
        {...props}
      />
      {hint ? <Muted style={[styles.small, { marginTop: 6 }]}>{hint}</Muted> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surfaceAlt }]}
    >
      <RNText style={[styles.chipText, { color: selected ? colors.primaryText : colors.text }]}>{label}</RNText>
    </Pressable>
  );
}

export function Chips({ items }: { items: string[] }) {
  return (
    <View style={styles.chips}>
      {items.map((s) => <Chip key={s} label={s} />)}
    </View>
  );
}

type Tone = 'neutral' | 'primary' | 'money' | 'warning' | 'danger';
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const map: Record<Tone, [string, string]> = {
    neutral: [colors.surfaceAlt, colors.textMuted],
    primary: [colors.primarySoft, colors.primary],
    money: [colors.moneySoft, colors.moneyText],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <RNText style={[styles.pillText, { color: fg }]}>{label}</RNText>
    </View>
  );
}

// ---------- Containers ----------

export function Card({ children, onPress, style, testID }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { colors } = useTheme();
  const base = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}>
      {children}
    </Pressable>
  );
}

export function Avatar({ name, size = 40, tone = 'primary' }: { name: string; size?: number; tone?: 'primary' | 'ink' }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'primary' ? colors.primarySoft : colors.surfaceAlt }}>
      <RNText style={{ fontFamily: fonts.bold, fontSize: size * 0.38, color: tone === 'primary' ? colors.primary : colors.text }}>{initials(name)}</RNText>
    </View>
  );
}

export function Empty({ icon = 'sparkles-outline', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {text ? <Muted style={{ textAlign: 'center', marginTop: 6 }}>{text}</Muted> : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ padding: space.xxxl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function Stars({ value, size = 14 }: { value: number | null; size?: number }) {
  if (!value) return <Muted style={styles.small}>New</Muted>;
  return (
    <Row gap={4}>
      <Ionicons name="star" size={size} color="#FF9F0A" />
      <Body style={[styles.small, { fontFamily: fonts.semibold }]}>{value.toFixed(1)}</Body>
    </Row>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Row gap={6}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} accessibilityLabel={`${n} stars`} onPress={() => { haptic.tap(); onChange(n); }} hitSlop={6}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={32} color="#FF9F0A" />
        </Pressable>
      ))}
    </Row>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: space.md }} />;
}

export function LineItem({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      {strong ? <Body style={{ fontFamily: fonts.semibold }}>{label}</Body> : <Muted>{label}</Muted>}
      {typeof value === 'string' ? <Body style={strong ? { fontFamily: fonts.bold } : undefined}>{value}</Body> : value}
    </Row>
  );
}

export const styles = StyleSheet.create({
  padded: { paddingHorizontal: space.xl, paddingTop: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: space.xl, marginTop: space.sm, gap: space.md },
  hero: { fontFamily: fonts.heavy, fontSize: 46, lineHeight: 50, letterSpacing: -1.8 },
  title: { fontFamily: fonts.heavy, fontSize: 34, lineHeight: 39, letterSpacing: -1.1 },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.4 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  muted: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.2, textTransform: 'uppercase' },
  button: { minHeight: 54, borderRadius: radius.md, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { minHeight: 38, borderRadius: radius.sm, paddingHorizontal: space.lg },
  buttonText: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.2 },
  input: { fontFamily: fonts.regular, fontSize: 17, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 54 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.semibold, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.semibold, fontSize: 12 },
  card: { borderRadius: radius.lg, padding: space.xl, borderWidth: StyleSheet.hairlineWidth, marginBottom: space.md },
  empty: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  errorBox: { borderRadius: radius.sm, padding: space.md, marginBottom: space.md },
});
