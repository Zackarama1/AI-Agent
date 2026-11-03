import 'react-native-url-polyfill/auto';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/lib/session';
import { fonts, useTheme } from '@/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const { colors, isDark } = useTheme();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.background, text: colors.text, border: colors.border },
  };
  const detail = {
    headerShown: true,
    title: '',
    headerShadowVisible: false,
    headerBackTitle: 'Back',
    headerTintColor: colors.primary,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
  } as const;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <SessionProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="sign-in" options={detail} />
            <Stack.Screen name="onboarding" options={{ ...detail, headerBackVisible: false, gestureEnabled: false }} />
            <Stack.Screen name="student" />
            <Stack.Screen name="business" />
            <Stack.Screen name="project/[id]" options={detail} />
            <Stack.Screen name="contract/[id]" options={detail} />
            <Stack.Screen name="chat/[id]" options={{ ...detail, title: 'Messages' }} />
            <Stack.Screen name="people/[id]" options={detail} />
            <Stack.Screen name="plans" options={{ ...detail, presentation: 'modal' }} />
            <Stack.Screen name="admin" />
            <Stack.Screen name="activity" options={detail} />
            <Stack.Screen name="stripe-return" />
          </Stack>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
