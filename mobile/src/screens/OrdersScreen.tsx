import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert as RNAlert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { api, Trade } from "../api/client";
import { money, theme } from "../theme";

const fmt = (ts: number) =>
  new Date(ts * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function OrdersScreen({ navigation }: any) {
  const [trades, setTrades] = useState<Trade[]>([]);

  const load = useCallback(() => {
    api.getOrders().then(setTrades).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => load(), [load]));

  const confirmReset = () => {
    RNAlert.alert(
      "Reset paper account?",
      "This clears all trades and restores your starting cash. Can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => api.resetAccount().then(() => navigation.goBack()),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: theme.spacing(2) }}
        data={trades}
        keyExtractor={(t) => String(t.id)}
        ListEmptyComponent={<Text style={styles.empty}>No trades yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: item.side === "buy" ? theme.colors.up : theme.colors.down }]}>
              <Text style={styles.badgeText}>{item.side === "buy" ? "BUY" : "SELL"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sym}>{item.symbol}</Text>
              <Text style={styles.meta}>{fmt(item.ts)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.qty}>
                {item.quantity} @ {money(item.price)}
              </Text>
              <Text style={styles.total}>{money(item.quantity * item.price)}</Text>
            </View>
          </View>
        )}
      />
      <TouchableOpacity style={styles.reset} onPress={confirmReset}>
        <Text style={styles.resetText}>Reset paper account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  empty: { color: theme.colors.textDim, textAlign: "center", marginTop: 40, fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
  },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  sym: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  qty: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  total: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  reset: {
    margin: theme.spacing(2),
    padding: 14,
    borderRadius: 12,
    borderColor: theme.colors.down,
    borderWidth: 1,
    alignItems: "center",
  },
  resetText: { color: theme.colors.down, fontSize: 14, fontWeight: "700" },
});
