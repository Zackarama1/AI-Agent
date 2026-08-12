import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";

import { PortfolioTab } from "./src/screens/PortfolioTab";
import { StockDetailScreen } from "./src/screens/StockDetailScreen";
import { AddHoldingScreen } from "./src/screens/AddHoldingScreen";
import { WatchlistScreen } from "./src/screens/WatchlistScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { AppProvider, useApp } from "./src/state/AppState";
import { usePushRegistration } from "./src/usePushRegistration";
import { theme } from "./src/theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.bg,
    card: theme.colors.bg,
    text: theme.colors.text,
    border: theme.colors.cardBorder,
    primary: theme.colors.accent,
  },
};

const icon =
  (glyph: string) =>
  ({ focused }: { focused: boolean }) =>
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.cardBorder,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textDim,
      }}
    >
      <Tab.Screen
        name="PortfolioTab"
        component={PortfolioTab}
        options={{ title: "Portfolio", tabBarIcon: icon("📊") }}
      />
      <Tab.Screen
        name="WatchlistTab"
        component={WatchlistScreen}
        options={{ title: "Watchlist", tabBarIcon: icon("★") }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        options={{ title: "Earnings", tabBarIcon: icon("📅") }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{ title: "Search", tabBarIcon: icon("🔍") }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const { ready, user } = useApp();
  usePushRegistration();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="StockDetail" component={StockDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="AddHolding" component={AddHoldingScreen} options={{ title: "Add Holding" }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Root />
      </NavigationContainer>
    </AppProvider>
  );
}
