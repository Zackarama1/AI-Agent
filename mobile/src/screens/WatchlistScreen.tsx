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

import { api, WatchItem } from "../api/client";
import { gainColor, money, pct, theme } from "../theme";

export function WatchlistScreen({ navigation }: any) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api
      .getWatchlist()
      .then(setItems)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 60 }}
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
        ListHeaderComponent={<Text style={styles.h1}>Watchlist</Text>}
        data={items}
        keyExtractor={(w) => String(w.id)}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing here yet. Find a stock in Search and tap ☆ Watch.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("StockDetail", { symbol: item.symbol })}
          >
            <Text style={styles.symbol}>{item.symbol}</Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.price}>{money(item.price)}</Text>
              <Text style={[styles.change, { color: gainColor(item.change) }]}>
                {pct(item.percent_change)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  h1: { color: theme.colors.text, fontSize: 28, fontWeight: "800", marginBottom: 16 },
  empty: { color: theme.colors.textDim, textAlign: "center", marginTop: 40, fontSize: 15 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
  },
  symbol: { color: theme.colors.text, fontSize: 17, fontWeight: "700" },
  price: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  change: { fontSize: 13, marginTop: 2 },
});
