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

import { api, PortfolioSummary } from "../api/client";
import { AIBrief } from "../components/AIBrief";
import { HoldingRow } from "../components/HoldingRow";
import { gainColor, money, pct, theme } from "../theme";

export function PortfolioScreen({ navigation }: any) {
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .getPortfolio()
      .then(setData)
      .catch(() =>
        setError("Can't reach the backend. Is it running, and is the API URL right?"),
      )
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  const empty = data && data.holdings.length === 0;

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
            <Text style={styles.h1}>Portfolio</Text>
            {data && (
              <View style={styles.hero}>
                <Text style={styles.total}>{money(data.total_value)}</Text>
                <Text style={[styles.heroChange, { color: gainColor(data.day_change) }]}>
                  {money(data.day_change)} ({pct(data.day_change_percent)}) today
                </Text>
                <Text style={[styles.heroSub, { color: gainColor(data.total_gain) }]}>
                  {money(data.total_gain)} ({pct(data.total_gain_percent)}) all time
                </Text>
              </View>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            {data && data.holdings.length > 0 && <AIBrief />}
            {empty && (
              <Text style={styles.empty}>
                No holdings yet. Tap + to add your first position.
              </Text>
            )}
          </View>
        }
        data={data?.holdings ?? []}
        keyExtractor={(h) => String(h.id)}
        renderItem={({ item }) => (
          <HoldingRow
            h={item}
            onPress={() => navigation.navigate("StockDetail", { symbol: item.symbol })}
          />
        )}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddHolding")}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
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
