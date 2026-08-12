import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import { PortfolioScreen } from "./src/screens/PortfolioScreen";
import { StockDetailScreen } from "./src/screens/StockDetailScreen";
import { AddHoldingScreen } from "./src/screens/AddHoldingScreen";
import { theme } from "./src/theme";

const Stack = createNativeStackNavigator();

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

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen
          name="Portfolio"
          component={PortfolioScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="StockDetail" component={StockDetailScreen} options={{ title: "" }} />
        <Stack.Screen name="AddHolding" component={AddHoldingScreen} options={{ title: "Add Holding" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
