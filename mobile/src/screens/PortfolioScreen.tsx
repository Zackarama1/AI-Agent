import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { api, AccountSummary } from "../api/client";
import { AIBrief } from "../components/AIBrief";
import { PositionRow } from "../components/PositionRow";
import { ModeSwitch } from "../components/ModeSwitch";
import { useApp } from "../state/AppState";
import { gainColor, money, pct, theme } from "../theme";

export function PortfolioScreen({ navigation }: any) {
  const { logout } = useApp();
  const [data, setData] = useState<AccountSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .getAccount()
      .then(setData)
      .catch(() =>
        setError("Can't reach the backend. Is it running, and is the API URL right?"),
      )
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  const empty = data && data.positions.length === 0;

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.colors.text}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <ModeSwitch />
              <View style={styles.topRight}>
                <TouchableOpacity onPress={() => navigation.navigate("Orders")}>
                  <Text style={styles.link}>Activity</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={logout}>
                  <Text style={styles.logout}>Log out</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.h1}>Portfolio</Text>
            {data && (
              <View style={styles.hero}>
                <Text style={styles.total}>{money(data.total_value)}</Text>
                <Text style={[styles.heroChange, { color: gainColor(data.day_change) }]}>
                  {money(data.day_change)} ({pct(data.day_change_percent)}) today
                </Text>
                <Text style={[styles.heroSub, { color: gainColor(data.total_pl) }]}>
                  {money(data.total_pl)} ({pct(data.total_pl_percent)}) total P/L
                </Text>
                <View style={styles.cashRow}>
                  <View>
                    <Text style={styles.cashLabel}>Cash / buying power</Text>
                    <Text style={styles.cashValue}>{money(data.buying_power)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.cashLabel}>Invested</Text>
                    <Text style={styles.cashValue}>{money(data.market_value)}</Text>
                  </View>
                </View>
              </View>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            {data && data.positions.length > 0 && <AIBrief />}
            {empty && (
              <Text style={styles.empty}>
                All cash. Tap + to find a stock and place your first trade.
              </Text>
            )}
          </View>
        }
        data={data?.positions ?? []}
        keyExtractor={(p) => p.symbol}
        renderItem={({ item }) => (
          <PositionRow
            p={item}
            onPress={() => navigation.navigate("StockDetail", { symbol: item.symbol })}
          />
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("SearchTab")}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  link: { color: theme.colors.accent, fontSize: 12, fontWeight: "600" },
  logout: { color: theme.colors.textDim, fontSize: 12 },
  h1: { color: theme.colors.text, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  hero: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(2),
  },
  total: { color: theme.colors.text, fontSize: 36, fontWeight: "800" },
  heroChange: { fontSize: 16, marginTop: 6, fontWeight: "600" },
  heroSub: { fontSize: 14, marginTop: 2 },
  cashRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopColor: theme.colors.cardBorder,
    borderTopWidth: 1,
  },
  cashLabel: { color: theme.colors.textDim, fontSize: 12 },
  cashValue: { color: theme.colors.text, fontSize: 15, fontWeight: "700", marginTop: 2 },
  empty: { color: theme.colors.textDim, textAlign: "center", marginTop: 40, fontSize: 15 },
  error: { color: theme.colors.down, marginBottom: 12, fontSize: 14 },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 36,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 30, marginTop: -2 },
});
