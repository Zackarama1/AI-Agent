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

import { api, EarningsEvent } from "../api/client";
import { theme } from "../theme";

const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const daysAway = (iso: string) => {
  const ms = new Date(iso + "T00:00:00").getTime() - Date.now();
  const d = Math.ceil(ms / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
};

const hourLabel = (h: string) =>
  h === "bmo" ? "Before open" : h === "amc" ? "After close" : "";

export function CalendarScreen({ navigation }: any) {
  const [events, setEvents] = useState<EarningsEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api
      .getEarnings()
      .then(setEvents)
      .catch(() => {})
      .finally(() => {
        setRefreshing(false);
        setLoaded(true);
      });
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: theme.spacing(2), paddingTop: 60, paddingBottom: 100 }}
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
            <Text style={styles.h1}>Earnings</Text>
            <Text style={styles.sub}>Upcoming reports for your holdings & watchlist</Text>
          </View>
        }
        data={events}
        keyExtractor={(e, i) => `${e.symbol}-${e.date}-${i}`}
        ListEmptyComponent={
          loaded ? (
            <Text style={styles.empty}>
              No upcoming earnings. Add holdings or watchlist symbols to populate this.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("StockDetail", { symbol: item.symbol })}
          >
            <View style={styles.dateBox}>
              <Text style={styles.dateText}>{fmtDate(item.date)}</Text>
              <Text style={styles.away}>{daysAway(item.date)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sym}>{item.symbol}</Text>
              <Text style={styles.meta}>
                {hourLabel(item.hour)}
                {item.eps_estimate != null
                  ? `${item.hour ? " · " : ""}Est. EPS ${item.eps_estimate.toFixed(2)}`
                  : ""}
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
  h1: { color: theme.colors.text, fontSize: 28, fontWeight: "800" },
  sub: { color: theme.colors.textDim, fontSize: 14, marginTop: 4, marginBottom: 16 },
  empty: { color: theme.colors.textDim, textAlign: "center", marginTop: 40, fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
  },
  dateBox: {
    width: 96,
    borderRightColor: theme.colors.cardBorder,
    borderRightWidth: 1,
    paddingRight: 12,
  },
  dateText: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  away: { color: theme.colors.accent, fontSize: 12, marginTop: 2 },
  sym: { color: theme.colors.text, fontSize: 17, fontWeight: "700" },
  meta: { color: theme.colors.textDim, fontSize: 13, marginTop: 2 },
});
