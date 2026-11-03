import { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { haptic } from '@/lib/haptics';
import { fonts, radius, useTheme } from '@/theme';
import { nativeDriver } from './motion';

export type Segment<K extends string> = { key: K; label: string; count?: number };

/** iOS-style segmented control: the highlight slides to the selected option. */
export function SegmentedControl<K extends string>({ segments, value, onChange, testID }: { segments: Segment<K>[]; value: K; onChange: (k: K) => void; testID?: string }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const index = Math.max(0, segments.findIndex((s) => s.key === value));
  const segWidth = width / segments.length;

  useEffect(() => {
    Animated.spring(x, { toValue: index * segWidth, useNativeDriver: nativeDriver, speed: 20, bounciness: 4 }).start();
  }, [index, segWidth, x]);

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 4)}
      style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 2, marginBottom: 20 }}
    >
      {width > 0 ? (
        <Animated.View
          style={{
            position: 'absolute', top: 2, bottom: 2, left: 2, width: segWidth, borderRadius: radius.md - 2,
            backgroundColor: colors.surface, transform: [{ translateX: x }],
            shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
          }}
        />
      ) : null}
      {segments.map((s) => {
        const selected = s.key === value;
        return (
          <Pressable
            key={s.key}
            testID={testID ? `${testID}-${s.key}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) haptic.tap();
              onChange(s.key);
            }}
            style={{ flex: 1, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
          >
            <Text style={{ fontFamily: selected ? fonts.semibold : fonts.regular, fontSize: 14, color: selected ? colors.text : colors.textMuted }}>{s.label}</Text>
            {s.count ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 11 }}>{s.count > 9 ? '9+' : s.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
