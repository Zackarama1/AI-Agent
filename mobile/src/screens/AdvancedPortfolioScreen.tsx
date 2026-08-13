import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
   RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { api, AccountSummary, Candle, WatchItem } from "../api/client";
import { AIBrief } from "../components/AIBrief";
import { LineChart } from "../components/LineChart";
import { ModeSwitch } from "../components/ModeSwitch";
import { useApp } from "../state/AppState";
import { gainColor, money, pct, theme } from "../theme";

type Filter = "All" | "Holdings" | "Watchlist";
const CENTS = (v: number) => v.toFixed(2).split(".")[1];

// Data-dense dashboard styled after the reference fintech design:
// greeting, gradient balance hero, quick actions, performance card, assets.
export function AdvancedPortfolioScreen({ navigation }: any) {
  const { user, logout } = useApp();
  const [data, setData] = useState<AccountSummary | null>(null);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [spark, setSpark] = useState<Candle[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api
      .getAccount()
      .then((p) => {
        setData(p);
        const top = [...p.positions].sort((a, b) => b.market_value - a.market_value)[0];
        if (top) api.getHistory(top.symbol, 30).then((h) => setSpark(h.candles)).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
    api.getWatchlist().then(setWatch).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  const name = user?.email?.split("@")[0] ?? "there";
  const positions = data?.positions ?? [];
  const marketValue = data?.market_value ?? 0;
  const showWatch = filter === "Watchlist";

  return (
    <ScrollView
      style={styles.container}
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
    >
      {/* Greeting row */}
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.hi}>Hi {name}!</Text>
        </View>
        <View style={styles.headerRight}>
          <ModeSwitch />
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {(["All", "Holdings", "Watchlist"] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipOn]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && { color: "#fff" }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Gradient balance hero */}
      <LinearGradient
        colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroLabel}>Portfolio balance • USD</Text>
        <Text style={styles.heroValue}>
          {money(data?.total_value ?? 0).split(".")[0]}
          <Text style={styles.heroCents}>.{CENTS(data?.total_value ?? 0)}</Text>
        </Text>
        {data && (
          <>
            <Text style={styles.heroChange}>
              {pct(data.day_change_percent)} · {money(data.day_change)} today
            </Text>
            <Text style={styles.heroCash}>
              {money(data.buying_power)} buying power · {money(data.market_value)} invested
            </Text>
          </>
        )}
      </LinearGradient>

      {/* Quick actions + performance */}
      <View style={styles.midRow}>
        <View style={styles.actionsGrid}>
          <Action glyph="＋" label="Trade" onPress={() => navigation.navigate("SearchTab")} />
          <Action glyph="🔍" label="Search" onPress={() => navigation.navigate("SearchTab")} />
          <Action glyph="★" label="Watchlist" onPress={() => navigation.navigate("WatchlistTab")} />
          <Action glyph="🧾" label="Activity" onPress={() => navigation.navigate("Orders")} />
        </View>
        <View style={styles.perfCard}>
          <View style={styles.perfHead}>
            <Text style={styles.perfLabel}>Performance</Text>
            {data && (
              <Text style={[styles.perfPct, { color: gainColor(data.day_change_percent) }]}>
                {pct(data.day_change_percent)}
              </Text>
            )}
          </View>
          {spark.length > 1 ? (
            <LineChart candles={spark} height={70} width={130} />
          ) : (
            <Text style={styles.perfEmpty}>Buy a stock to see performance</Text>
          )}
        </View>
      </View>

      {positions.length > 0 && <AIBrief />}

      {/* Assets */}
      <View style={styles.assetsHead}>
        <Text style={styles.assetsTitle}>{showWatch ? "Watchlist" : "Positions"}</Text>
        <Text style={styles.viewAll}>
          {showWatch ? `${watch.length} tracked` : `${positions.length} positions`}
        </Text>
      </View>

      {showWatch
        ? watch.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={styles.asset}
              onPress={() => navigation.navigate("StockDetail", { symbol: w.symbol })}
            >
              <View style={styles.assetLeft}>
                <View style={styles.coin}>
                  <Text style={styles.coinText}>{w.symbol[0]}</Text>
                </View>
                <Text style={styles.assetSym}>{w.symbol}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.assetVal}>{money(w.price)}</Text>
                <Text style={[styles.assetChange, { color: gainColor(w.percent_change) }]}>
                  {pct(w.percent_change)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        : positions.map((p) => (
            <TouchableOpacity
              key={p.symbol}
              style={styles.asset}
              onPress={() => navigation.navigate("StockDetail", { symbol: p.symbol })}
            >
              <View style={styles.assetLeft}>
                <View style={styles.coin}>
                  <Text style={styles.coinText}>{p.symbol[0]}</Text>
                </View>
                <View>
                  <Text style={styles.assetSym}>{p.symbol}</Text>
                  <Text style={styles.assetShares}>
                    {p.quantity} sh ·{" "}
                    {marketValue ? ((p.market_value / marketValue) * 100).toFixed(1) : "0"}%
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.assetVal}>{money(p.market_value)}</Text>
                <Text style={[styles.assetChange, { color: gainColor(p.day_change_percent) }]}>
                  {pct(p.day_change_percent)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

      {showWatch && watch.length === 0 && (
        <Text style={styles.empty}>Watchlist is empty. Add symbols from Search.</Text>
      )}
      {!showWatch && positions.length === 0 && (
        <Text style={styles.empty}>All cash. Tap Trade to buy your first stock.</Text>
      )}
    </ScrollView>
  );
}

function Action({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress}>
      <Text style={styles.actionGlyph}>{glyph}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  hi: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  logout: { color: theme.colors.textDim, fontSize: 12 },
  chips: { flexDirection: "row", marginTop: 18, marginBottom: 4 },
  chip: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textDim, fontSize: 13, fontWeight: "600" },
  hero: { borderRadius: 22, padding: theme.spacing(3), marginTop: 12, marginBottom: 16 },
  heroLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  heroValue: { color: "#fff", fontSize: 42, fontWeight: "800", marginTop: 8 },
  heroCents: { fontSize: 24, fontWeight: "700", color: "rgba(255,255,255,0.75)" },
  heroChange: { color: "rgba(255,255,255,0.9)", fontSize: 14, marginTop: 6, fontWeight: "600" },
  heroCash: { color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 4 },
  midRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  actionsGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: {
    width: "47%",
    backgroundColor: theme.colors.tile,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionGlyph: { fontSize: 20 },
  actionLabel: { color: theme.colors.text, fontSize: 12, marginTop: 6, fontWeight: "600" },
  perfCard: {
    flex: 1,
    backgroundColor: theme.colors.tile,
    borderRadius: 14,
    padding: 12,
    justifyContent: "space-between",
  },
  perfHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  perfLabel: { color: theme.colors.textDim, fontSize: 12 },
  perfPct: { fontSize: 12, fontWeight: "700" },
  perfEmpty: { color: theme.colors.textDim, fontSize: 11, marginTop: 12 },
  assetsHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  assetsTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  viewAll: { color: theme.colors.textDim, fontSize: 13 },
  empty: { color: theme.colors.textDim, textAlign: "center", marginTop: 20, fontSize: 14 },
  asset: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
  },
  assetLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  coin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  coinText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  assetSym: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  assetShares: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  assetVal: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  assetChange: { fontSize: 13, marginTop: 2 },
});
