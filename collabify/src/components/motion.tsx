import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

/** Transforms and opacity run on the native thread on iOS/Android; web falls back to JS. */
export const nativeDriver = Platform.OS !== 'web';

/** Respect the system "Reduce Motion" setting. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => alive && setReduced(Boolean(v))).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduced(Boolean(v)));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/**
 * Pressable that springs down slightly while held and back on release, like iOS controls.
 */
export function PressableScale({
  children, style, scaleTo = 0.97, disabled, onPressIn, onPressOut, ...props
}: Omit<PressableProps, 'style' | 'children'> & { children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const [scale] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: nativeDriver, speed: 40, bounciness: value === 1 ? 6 : 0 }).start();
  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPressIn={(e) => {
        if (!reduced) to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Fades and slides its children in on mount. Pass `index` to stagger items in a list.
 */
export function FadeIn({ children, index = 0, style, distance = 12 }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle>; distance?: number }) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : 380,
      delay: reduced ? 0 : Math.min(index, 8) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    }).start();
  }, [progress, index, reduced]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** Placeholder block with a gentle pulse while content loads. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: nativeDriver }),
        Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceAlt, opacity: pulse }, style]} />;
}

/** A card-shaped skeleton matching ProjectCard, so loading doesn't make the layout jump. */
export function SkeletonCard() {
  const { colors } = useTheme();
  return (
    <Animated.View style={{ borderRadius: 20, padding: 24, marginBottom: 12, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, gap: 12 }}>
      <Skeleton width={90} height={20} radius={10} />
      <Skeleton width="80%" height={22} />
      <Skeleton width="45%" height={14} />
      <Skeleton width={120} height={26} style={{ marginTop: 8 }} />
    </Animated.View>
  );
}
