import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '@/lib/haptics';
import { fonts, palette, radius, space, useTheme } from '@/theme';
import { nativeDriver, useReducedMotion } from './motion';
import type { IconName } from './ui';

type Toast = { id: number; text: string; icon?: IconName };
type Celebration = { title: string; subtitle?: string; icon?: IconName };

type FeedbackValue = {
  /** Short confirmation at the bottom of the screen ("Saved", "Invite sent"). */
  toast: (text: string, icon?: IconName) => void;
  /** Full-screen moment for milestones: hired, paid, first project posted. */
  celebrate: (c: Celebration) => void;
};

const FeedbackContext = createContext<FeedbackValue>({ toast: () => {}, celebrate: () => {} });
export const useFeedback = () => useContext(FeedbackContext);

const CONFETTI_COLORS = [palette.purple, palette.green, '#FF9F0A', '#FF375F', '#64D2FF', '#FFD60A'];

/** Small seeded PRNG (mulberry32): each celebration gets its own pattern while render stays pure. */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function Confetti({ run }: { run: number }) {
  const { width, height } = useWindowDimensions();
  // New random pieces for every celebration.
  const pieces = useMemo(() => {
    const rand = seeded(run * 9973);
    return Array.from({ length: 42 }, (_, i) => ({
        key: `${run}-${i}`,
        x: rand() * width,
        drift: (rand() - 0.5) * 120,
        size: 6 + rand() * 7,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: rand() * 250,
        spin: (rand() > 0.5 ? 1 : -1) * (360 + rand() * 360),
        fall: new Animated.Value(0),
        duration: 1700 + rand() * 700,
      }));
  }, [run, width]);
  useEffect(() => {
    Animated.parallel(
      pieces.map((p) =>
        Animated.timing(p.fall, { toValue: 1, duration: p.duration, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
      ),
    ).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.size,
            height: p.size * 1.6,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.fall.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
              { translateX: p.fall.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [toastState, setToast] = useState<Toast | null>(null);
  const [celebration, setCelebration] = useState<(Celebration & { run: number }) | null>(null);
  const [toastAnim] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  const timers = useRef<{ toast?: ReturnType<typeof setTimeout>; party?: ReturnType<typeof setTimeout> }>({});
  const seq = useRef(0);

  const toast = useCallback((text: string, icon?: IconName) => {
    clearTimeout(timers.current.toast);
    setToast({ id: ++seq.current, text, icon });
    toastAnim.setValue(0);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: nativeDriver, speed: 18, bounciness: 8 }).start();
    timers.current.toast = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: nativeDriver }).start(() => setToast(null));
    }, 2200);
  }, [toastAnim]);

  const dismiss = useCallback(() => {
    clearTimeout(timers.current.party);
    Animated.timing(pop, { toValue: 0, duration: 180, useNativeDriver: nativeDriver }).start(() => setCelebration(null));
  }, [pop]);

  const celebrate = useCallback((c: Celebration) => {
    clearTimeout(timers.current.party);
    clearTimeout(timers.current.toast);
    setToast(null); // the celebration says it all
    haptic.success();
    setCelebration({ ...c, run: ++seq.current });
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: nativeDriver, speed: 12, bounciness: 12 }).start();
    timers.current.party = setTimeout(dismiss, 2800);
  }, [pop, dismiss]);

  const value = useMemo(() => ({ toast, celebrate }), [toast, celebrate]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {toastState ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            {
              bottom: insets.bottom + 96,
              backgroundColor: colors.text,
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            },
          ]}
        >
          <Ionicons name={toastState.icon ?? 'checkmark-circle'} size={18} color={colors.background} />
          <Text style={[styles.toastText, { color: colors.background }]}>{toastState.text}</Text>
        </Animated.View>
      ) : null}
      {celebration ? (
        <Pressable testID="celebration" accessibilityLabel={celebration.title} onPress={dismiss} style={[StyleSheet.absoluteFill, styles.party]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.94] }) }]} />
          {reduced ? null : <Confetti run={celebration.run} />}
          <Animated.View style={{ alignItems: 'center', paddingHorizontal: space.xxl, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
            <View style={[styles.partyIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name={celebration.icon ?? 'sparkles'} size={44} color="#fff" />
            </View>
            <Text style={[styles.partyTitle, { color: colors.text }]}>{celebration.title}</Text>
            {celebration.subtitle ? <Text style={[styles.partySub, { color: colors.textMuted }]}>{celebration.subtitle}</Text> : null}
            <Text style={[styles.partyHint, { color: colors.textMuted }]}>Tap to continue</Text>
          </Animated.View>
        </Pressable>
      ) : null}
    </FeedbackContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, maxWidth: '90%',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  toastText: { fontFamily: fonts.semibold, fontSize: 15 },
  party: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  partyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: space.xl },
  partyTitle: { fontFamily: fonts.heavy, fontSize: 40, lineHeight: 44, letterSpacing: -1.4, textAlign: 'center' },
  partySub: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 25, textAlign: 'center', marginTop: space.md },
  partyHint: { fontFamily: fonts.semibold, fontSize: 13, marginTop: space.xxl, opacity: 0.6 },
});
