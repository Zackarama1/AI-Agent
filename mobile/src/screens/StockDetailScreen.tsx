import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { api, Candle, NewsItem, Quote } from "../api/client";
import { AlertsSection } from "../components/AlertsSection";
import { LineChart } from "../components/LineChart";
import { gainColor, money, pct, theme } from "../theme";

const RANGES = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
];

export function StockDetailScreen({ route }: any) {
  const { symbol } = route.params as { symbol: string };
  const [quote, setQuote] = useState<Quote | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [days, setDays] = useState(30);
  const [watched, setWatched] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getQuote(symbol), api.getNews(symbol)])
      .then(([q, n]) => {
        setQuote(q);
        setNews(n);
      })
      .finally(() => setLoading(false));
  }, [symbol]);

  useEffect(() => {
    api.getHistory(symbol, days).then((h) => setCandles(h.candles)).catch(() => {});
  }, [symbol, days]);

  const toggleWatch = async () => {
    try {
      if (watched) await api.removeWatch(symbol);
      else await api.addWatch(symbol);
      setWatched(!watched);
    } catch {
      /* best-effort */
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing(2) }}>
      <View style={styles.topRow}>
        <Text style={styles.symbol}>{symbol}</Text>
        <TouchableOpacity
          style={[styles.watchBtn, watched && styles.watchBtnOn]}
          onPress={toggleWatch}
        >
          <Text style={[styles.watchText, watched && { color: "#fff" }]}>
            {watched ? "★ Watching" : "☆ Watch"}
          </Text>
        </TouchableOpacity>
      </View>
      {quote && (
        <View style={styles.quoteCard}>
          <Text style={styles.price}>{money(quote.price)}</Text>
          <Text style={[styles.change, { color: gainColor(quote.change) }]}>
            {money(quote.change)} ({pct(quote.percent_change)})
          </Text>
          {candles.length > 1 && (
            <View style={{ marginTop: 16, alignItems: "center" }}>
              <LineChart candles={candles} />
              <View style={styles.ranges}>
                {RANGES.map((r) => (
                  <TouchableOpacity
                    key={r.label}
                    style={[styles.range, days === r.days && styles.rangeOn]}
                    onPress={() => setDays(r.days)}
                  >
                    <Text
                      style={[styles.rangeText, days === r.days && { color: "#fff" }]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <View style={styles.stats}>
            <Stat label="Open" value={money(quote.open)} />
            <Stat label="High" value={money(quote.high)} />
            <Stat label="Low" value={money(quote.low)} />
            <Stat label="Prev" value={money(quote.prev_close)} />
          </View>
        </View>
      )}

      <AlertsSection symbol={symbol} />

      <Text style={styles.section}>Latest News</Text>
      {news.map((n, i) => (
        <TouchableOpacity
          key={i}
          style={styles.newsCard}
          onPress={() => n.url && Linking.openURL(n.url)}
        >
          <Text style={styles.newsHead}>{n.headline}</Text>
          {!!n.summary && (
            <Text style={styles.newsSummary} numberOfLines={3}>
              {n.summary}
            </Text>
          )}
          <Text style={styles.newsSource}>{n.source}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { justifyContent: "center", alignItems: "center" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  symbol: { color: theme.colors.text, fontSize: 28, fontWeight: "800" },
  watchBtn: {
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  watchBtnOn: { backgroundColor: theme.colors.accent },
  watchText: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
  ranges: { flexDirection: "row", marginTop: 12, gap: 8 },
  range: {
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  rangeOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  rangeText: { color: theme.colors.textDim, fontSize: 13, fontWeight: "600" },
  quoteCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(3),
  },
  price: { color: theme.colors.text, fontSize: 32, fontWeight: "800" },
  change: { fontSize: 16, marginTop: 4, fontWeight: "600" },
  stats: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  stat: { alignItems: "center" },
  statLabel: { color: theme.colors.textDim, fontSize: 12 },
  statValue: { color: theme.colors.text, fontSize: 14, fontWeight: "600", marginTop: 2 },
  section: { color: theme.colors.text, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  newsCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
  },
  newsHead: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  newsSummary: { color: theme.colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6 },
  newsSource: { color: theme.colors.accent, fontSize: 12, marginTop: 8 },
});
